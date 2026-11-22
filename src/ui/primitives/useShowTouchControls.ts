import { useEffect, useState } from "react";

const padConnected = (): boolean =>
  typeof navigator.getGamepads === "function" && Array.from(navigator.getGamepads()).some((p) => p?.connected);

const touchScreen = (): boolean => navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;

/**
 * Whether to draw the on-screen D-pad and strike buttons. Hidden when there is no touch screen (keyboard
 * play) or a gamepad is connected; a touch on the screen brings them back.
 */
export const useShowTouchControls = (): boolean => {
  const [show, setShow] = useState(() => touchScreen() && !padConnected());

  useEffect(() => {
    const onPad = (): void => setShow(touchScreen() && !padConnected());
    const onTouch = (): void => setShow(true);
    window.addEventListener("gamepadconnected", onPad);
    window.addEventListener("gamepaddisconnected", onPad);
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      window.removeEventListener("gamepadconnected", onPad);
      window.removeEventListener("gamepaddisconnected", onPad);
      window.removeEventListener("touchstart", onTouch);
    };
  }, []);

  return show;
};
