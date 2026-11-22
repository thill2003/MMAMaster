import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

import type { DeviceProfile } from "@/content/display";
import type { TownDef } from "@/content/towns";
import type { FightResult, HudState } from "@/core/fight";
import type { Action } from "@/core/input";
import type { Settings } from "@/core/progress";
import { audio, type GameBridge } from "@/engine";
import { onAppActiveChange } from "@/platform";

import { Controls } from "../controls/Controls";
import { Hud } from "../hud/Hud";
import { useGamepadPause } from "../primitives/useGamepadMenu";
import { useShowTouchControls } from "../primitives/useShowTouchControls";

import { Pause } from "./Screens";

interface Props {
  bridge: GameBridge;
  town: TownDef;
  /** Bumps on every retry so the fight restarts. */
  attempt: number;
  settings: Settings;
  lives: number;
  profile: DeviceProfile;
  /** CSS px per logical px of the stage. */
  unit: number;
  onFinished: (result: FightResult) => void;
  onQuit: () => void;
  onSettings: (patch: Partial<Settings>) => void;
  /** Demo mode: the scripted bot plays. */
  autoplay?: boolean;
}

/** One attempt at a town: starts the fight on the bridge and lays the HUD, controls and pause menu over it. */
export const FightScreen = ({
  bridge,
  town,
  attempt,
  settings,
  lives,
  profile,
  unit,
  onFinished,
  onQuit,
  onSettings,
  autoplay,
}: Props): ReactElement => {
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [god, setGod] = useState(false);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const startSettings = useRef(settings);
  startSettings.current = settings;

  useEffect(() => {
    const s = startSettings.current;
    setHud(null);
    setPaused(false);
    setGod(false);
    bridge.startFight(
      { town, difficulty: s.difficulty, reduceShake: s.reduceShake, debug: s.debug, autoplay },
      { onHud: setHud, onFinished: (r) => finished.current(r) },
    );
    return () => bridge.stopFight();
  }, [bridge, town, attempt, autoplay]);

  // Settings that can change mid-fight.
  useEffect(() => {
    if (bridge.request) {
      bridge.request.reduceShake = settings.reduceShake;
      bridge.request.debug = settings.debug;
    }
  }, [bridge, settings.reduceShake, settings.debug]);

  useEffect(() => {
    bridge.setPaused(paused);
  }, [bridge, paused]);

  // Pause when the app goes to the background; Escape or P toggles on a keyboard.
  useEffect(() => {
    const off = onAppActiveChange((active) => {
      audio.setActive(active);
      if (!active) setPaused(true);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyP") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      off();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const setAction = useCallback((action: Action, down: boolean) => bridge.setAction(action, down), [bridge]);
  const live = hud !== null && hud.phase !== "won" && hud.phase !== "ko" && hud.phase !== "timeout";

  const showTouch = useShowTouchControls();

  // Start on a gamepad toggles pause, but only while the fight is still on.
  const liveRef = useRef(live);
  liveRef.current = live;
  useGamepadPause(() => {
    if (liveRef.current) setPaused((p) => !p);
  });

  return (
    <>
      {hud && (
        <Hud
          hud={hud}
          lives={lives}
          isChampion={town.isChampion}
          showHints={settings.showHints && town.index === 0}
          unit={unit * profile.hudScale}
          onPause={() => setPaused(true)}
        />
      )}
      {live && !paused && showTouch && (
        <Controls
          setAction={setAction}
          profile={profile}
          buttonScale={settings.buttonScale}
          leftHanded={settings.leftHanded}
          items={hud?.items ?? 0}
        />
      )}
      {settings.debug && !paused && (
        <div className="debug-panel">
          <button type="button" onClick={() => bridge.debugCommand("clear")}>
            KO all
          </button>
          <button type="button" onClick={() => bridge.debugCommand("skip")}>
            Skip to leader
          </button>
          <button
            type="button"
            onClick={() => {
              bridge.debugCommand("god");
              setGod((g) => !g);
            }}
          >
            Invincible: {god ? "on" : "off"}
          </button>
        </div>
      )}
      {paused && <Pause settings={settings} onChange={onSettings} onResume={() => setPaused(false)} onQuit={onQuit} />}
    </>
  );
};
