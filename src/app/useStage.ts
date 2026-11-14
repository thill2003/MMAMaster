import { useEffect, useState } from "react";

import { type DeviceProfile, DISPLAY, pickDeviceProfile } from "@/content/display";

export interface Stage {
  /** CSS size of the stage: the window, clamped to the supported aspect range (plan §7). */
  width: number;
  height: number;
  /** CSS px per logical px — screens are laid out in these units. */
  unit: number;
  portrait: boolean;
  profile: DeviceProfile;
}

const measure = (): Stage => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  let width = w;
  let height = h;
  if (aspect > DISPLAY.maxAspect)
    width = Math.round(h * DISPLAY.maxAspect); // ultra-wide: pillarbox
  else if (aspect < DISPLAY.minAspect) height = Math.round(w / DISPLAY.minAspect); // tall: letterbox
  return { width, height, unit: height / DISPLAY.logicalHeight, portrait: h > w, profile: pickDeviceProfile(w, h) };
};

/** Tracks the window and returns the stage rectangle, layout unit and device profile. */
export const useStage = (): Stage => {
  const [stage, setStage] = useState<Stage>(measure);
  useEffect(() => {
    const on = () => setStage(measure());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return stage;
};
