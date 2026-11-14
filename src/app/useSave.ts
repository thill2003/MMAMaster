import { useCallback, useEffect, useRef, useState } from "react";

import { LIVES_RULES } from "@/content/fighters/tuning";
import { STRINGS } from "@/content/strings";
import { dayKey, grantDaily, migrate, newSave, type SaveData } from "@/core/progress";
import { storage } from "@/platform";
import { savesSync } from "@/services";

const KEY = "mma-master.save.v1";

/**
 * The save: loaded once, migrated, topped up with the daily lives, and written back on every change.
 * Local first (MM-131); the services stub is where the cloud merge will go (MM-133).
 */
export const useSave = (): {
  save: SaveData | null;
  update: (fn: (s: SaveData) => SaveData) => void;
  reset: () => void;
  toast: string | null;
} => {
  const [save, setSave] = useState<SaveData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const latest = useRef<SaveData | null>(null);

  const persist = useCallback((s: SaveData) => {
    latest.current = s;
    setSave(s);
    void storage.set(KEY, JSON.stringify(s));
    void savesSync.push(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const today = dayKey(new Date());
      let raw: unknown = null;
      try {
        const text = await storage.get(KEY);
        raw = text ? JSON.parse(text) : null;
      } catch {
        raw = null;
      }
      const loaded = await savesSync.merge(migrate(raw, LIVES_RULES, today));
      const { save: granted, granted: n } = grantDaily(loaded, today, LIVES_RULES);
      if (cancelled) return;
      persist(granted);
      if (n > 0) {
        setToast(STRINGS.dailyGrant(n));
        setTimeout(() => setToast(null), 3600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const update = useCallback(
    (fn: (s: SaveData) => SaveData) => {
      if (latest.current) persist(fn(latest.current));
    },
    [persist],
  );

  const reset = useCallback(() => persist(newSave(LIVES_RULES, dayKey(new Date()))), [persist]);

  return { save, update, reset, toast };
};
