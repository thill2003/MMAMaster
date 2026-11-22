import type { Action } from "@/core/input";

/** Keyboard for the web build. KeyboardEvent.code → action. */
export const KEY_BINDINGS: Record<string, Action> = {
  ArrowLeft: "MOVE_LEFT",
  ArrowRight: "MOVE_RIGHT",
  ArrowUp: "MOVE_UP",
  ArrowDown: "MOVE_DOWN",
  KeyA: "MOVE_LEFT",
  KeyD: "MOVE_RIGHT",
  KeyW: "MOVE_UP",
  KeyS: "MOVE_DOWN",
  Space: "GUARD",
  ShiftLeft: "GUARD",
  KeyJ: "PUNCH",
  KeyK: "KICK",
  KeyU: "ELBOW",
  KeyI: "KNEE",
  KeyZ: "PUNCH",
  KeyX: "KICK",
  KeyC: "ELBOW",
  KeyV: "KNEE",
  KeyE: "ITEM",
  KeyH: "ITEM",
};

/** Standard-mapping gamepad button index → action. */
export const GAMEPAD_BUTTONS: Record<number, Action> = {
  2: "PUNCH", // X / Square
  0: "KICK", // A / Cross
  3: "ELBOW", // Y / Triangle
  1: "KNEE", // B / Circle
  4: "GUARD", // LB
  5: "GUARD", // RB
  6: "GUARD", // LT
  7: "ITEM", // RT
  12: "MOVE_UP",
  13: "MOVE_DOWN",
  14: "MOVE_LEFT",
  15: "MOVE_RIGHT",
};

export const GAMEPAD_STICK_DEADZONE = 0.4;

/** Standard-mapping gamepad buttons for the menus, and Start to pause a fight. */
export const GAMEPAD_MENU = {
  confirm: [0], // A / Cross
  back: [1], // B / Circle
  pause: [9], // Start / Options
  up: [12],
  down: [13],
  left: [14],
  right: [15],
} as const;

/** Menu repeat while a direction is held, in ms; and how long a newly opened menu ignores confirm. */
export const GAMEPAD_MENU_TIMING = { repeatDelay: 380, repeatEvery: 130, confirmGrace: 400 } as const;

export const KEYBOARD_HELP = "Move: arrows / WASD · Guard: Space · Punch J · Kick K · Elbow U · Knee I · Drink E · Pause Esc";
