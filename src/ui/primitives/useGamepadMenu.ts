import { useEffect, useRef } from "react";

import { GAMEPAD_MENU, GAMEPAD_MENU_TIMING, GAMEPAD_STICK_DEADZONE } from "@/content/bindings";

type MenuButton = keyof typeof GAMEPAD_MENU;
type Dir = "up" | "down" | "left" | "right";

/** HTML buttons and inputs, and SVG elements such as the map stops. */
type Focusable = HTMLElement | SVGElement;

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [tabindex="0"]';

/** Which menu buttons are down on any connected pad right now. */
const readPads = (): Record<MenuButton, boolean> => {
  const out: Record<MenuButton, boolean> = { confirm: false, back: false, pause: false, up: false, down: false, left: false, right: false };
  const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    for (const key of Object.keys(GAMEPAD_MENU) as MenuButton[]) {
      if (GAMEPAD_MENU[key].some((i) => p.buttons[i]?.pressed)) out[key] = true;
    }
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    if (ax < -GAMEPAD_STICK_DEADZONE) out.left = true;
    if (ax > GAMEPAD_STICK_DEADZONE) out.right = true;
    if (ay < -GAMEPAD_STICK_DEADZONE) out.up = true;
    if (ay > GAMEPAD_STICK_DEADZONE) out.down = true;
  }
  return out;
};

/** The menu on top: the `.screen` with the highest z-index, the later one on a tie. None during live play. */
const topScreen = (): Focusable | null => {
  let best: Focusable | null = null;
  let bestZ = -Infinity;
  for (const el of Array.from(document.querySelectorAll<Focusable>(".screen"))) {
    const z = Number.parseInt(getComputedStyle(el).zIndex, 10) || 0;
    if (z >= bestZ) {
      best = el;
      bestZ = z;
    }
  }
  return best;
};

const candidates = (root: Focusable): Focusable[] =>
  Array.from(root.querySelectorAll<Focusable>(FOCUSABLE)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

const centre = (el: Element): { x: number; y: number } => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** The nearest candidate in a direction, weighting sideways drift so rows and columns win. */
const nearest = (from: Focusable, all: Focusable[], dir: Dir): Focusable | null => {
  const a = centre(from);
  let best: Focusable | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === from) continue;
    const b = centre(el);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) continue;
    const score = along + across * 2.5;
    if (score < bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
};

const isFocusable = (el: Element | null): el is Focusable => el instanceof HTMLElement || el instanceof SVGElement;

/** First pick on a menu: the element marked `data-pad-first`, else its primary button, else the first one. */
const firstPick = (all: Focusable[]): Focusable | undefined =>
  all.find((el) => el.hasAttribute("data-pad-first")) ??
  all.find((el) => el.classList.contains("btn") && !el.classList.contains("secondary")) ??
  all[0];

const press = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
};

const focus = (el: Focusable): void => {
  document.body.classList.add("pad-nav");
  el.focus({ preventScroll: false });
};

/** Nudges a range input one step and lets React see it as a change. */
const nudge = (input: HTMLInputElement, up: boolean): void => {
  if (up) input.stepUp();
  else input.stepDown();
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

/**
 * Drives the DOM menus from a gamepad: D-pad or left stick moves focus between the buttons of the top
 * `.screen`, A presses, B presses the screen's back button (`data-pad-back`), and left/right adjust a
 * focused slider. Fights are untouched — the bridge reads the pad for those, and a live fight has no
 * `.screen` on top. Mount it once, at the composition root.
 */
export const useGamepadMenu = (): void => {
  useEffect(() => {
    let raf = 0;
    let prev = readPads();
    let lastRoot: Focusable | null = null;
    let rootSince = 0;
    let heldDir: Dir | null = null;
    let nextRepeat = 0;

    const clearPadNav = (): void => document.body.classList.remove("pad-nav");
    window.addEventListener("pointerdown", clearPadNav);

    const move = (root: Focusable, dir: Dir): void => {
      const all = candidates(root);
      if (all.length === 0) return;
      const current = isFocusable(document.activeElement) && root.contains(document.activeElement) ? document.activeElement : null;
      if (!current) {
        const first = firstPick(all);
        if (first) focus(first);
        return;
      }
      if ((dir === "left" || dir === "right") && current instanceof HTMLInputElement && current.type === "range") {
        nudge(current, dir === "right");
        return;
      }
      const next = nearest(current, all, dir);
      if (next) focus(next);
    };

    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      const pad = readPads();
      const edge = (k: MenuButton): boolean => pad[k] && !prev[k];

      const root = topScreen();
      if (root !== lastRoot) {
        lastRoot = root;
        rootSince = now;
        heldDir = null;
      }

      if (root) {
        const dirs: Dir[] = ["up", "down", "left", "right"];
        const fresh = dirs.find((d) => edge(d));
        if (fresh) {
          heldDir = fresh;
          nextRepeat = now + GAMEPAD_MENU_TIMING.repeatDelay;
          move(root, fresh);
        } else if (heldDir && pad[heldDir] && now >= nextRepeat) {
          nextRepeat = now + GAMEPAD_MENU_TIMING.repeatEvery;
          move(root, heldDir);
        } else if (heldDir && !pad[heldDir]) {
          heldDir = null;
        }

        if (edge("confirm") && now - rootSince >= GAMEPAD_MENU_TIMING.confirmGrace) {
          const active = document.activeElement;
          if (isFocusable(active) && root.contains(active) && active.matches(FOCUSABLE)) {
            if (!(active instanceof HTMLInputElement)) press(active);
          } else {
            const first = firstPick(candidates(root));
            if (first) focus(first);
          }
        }

        if (edge("back") && now - rootSince >= GAMEPAD_MENU_TIMING.confirmGrace) {
          const back = root.querySelector<HTMLElement>("[data-pad-back]:not(:disabled)");
          if (back) press(back);
        }
      }

      prev = pad;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", clearPadNav);
    };
  }, []);
};

/** Calls `onPress` each time Start is pressed on any pad. */
export const useGamepadPause = (onPress: () => void): void => {
  const cb = useRef(onPress);
  cb.current = onPress;
  useEffect(() => {
    let raf = 0;
    let was = readPads().pause;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const now = readPads().pause;
      if (now && !was) cb.current();
      was = now;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
};
