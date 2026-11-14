import { Haptics, ImpactStyle } from "@capacitor/haptics";

let enabled = true;
// Browsers refuse to vibrate before the first touch; wait for one rather than log an error per hit.
let armed = false;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => (armed = true), { once: true, capture: true });
}

/** Taptic / vibration feedback. A no-op where the device has none. */
export const haptics = {
  setEnabled(on: boolean): void {
    enabled = on;
  },
  tap(): void {
    if (!enabled || !armed) return;
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  },
  thud(): void {
    if (!enabled || !armed) return;
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  },
};
