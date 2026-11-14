import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Tell the game when the app goes to the background or comes back, on device and in a browser tab.
 * Returns an unsubscribe function.
 */
export const onAppActiveChange = (cb: (active: boolean) => void): (() => void) => {
  const onVisibility = () => cb(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", onVisibility);
  let remove: (() => void) | null = null;
  if (isNative()) {
    void App.addListener("appStateChange", (s) => cb(s.isActive))
      .then((h) => {
        remove = () => void h.remove();
      })
      .catch(() => undefined);
  }
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    remove?.();
  };
};

/** Billing port (plan §9): a web no-op until monetization is decided (MM-226). */
export const billing = {
  available: (): boolean => false,
};
