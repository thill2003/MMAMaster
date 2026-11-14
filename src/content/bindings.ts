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

export const KEYBOARD_HELP = "Move: arrows / WASD · Guard: Space · Punch J · Kick K · Elbow U · Knee I · Drink E · Pause Esc";
