import { GAMEPAD_BUTTONS, GAMEPAD_STICK_DEADZONE, KEY_BINDINGS } from "@/content/bindings";
import type { Action } from "@/core/input";

export type Held = Partial<Record<Action, boolean>>;

/** Keyboard and gamepad for the web build. Both feed the same action map the touch controls do. */
export class InputDevices {
  readonly keys: Held = {};
  private readonly onDown = (e: KeyboardEvent): void => {
    const a = KEY_BINDINGS[e.code];
    if (!a) return;
    this.keys[a] = true;
    e.preventDefault();
  };
  private readonly onUp = (e: KeyboardEvent): void => {
    const a = KEY_BINDINGS[e.code];
    if (a) this.keys[a] = false;
  };
  private readonly onBlur = (): void => {
    for (const k of Object.keys(this.keys) as Action[]) this.keys[k] = false;
  };

  attach(): void {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    this.onBlur();
  }

  private pad(): Held {
    const out: Held = {};
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      for (const [index, action] of Object.entries(GAMEPAD_BUTTONS)) {
        if (p.buttons[Number(index)]?.pressed) out[action] = true;
      }
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if (ax < -GAMEPAD_STICK_DEADZONE) out.MOVE_LEFT = true;
      if (ax > GAMEPAD_STICK_DEADZONE) out.MOVE_RIGHT = true;
      if (ay < -GAMEPAD_STICK_DEADZONE) out.MOVE_UP = true;
      if (ay > GAMEPAD_STICK_DEADZONE) out.MOVE_DOWN = true;
    }
    return out;
  }

  /** Everything held right now, across touch (passed in), keyboard and gamepad. */
  merged(touch: Held): Held {
    const pad = this.pad();
    const out: Held = {};
    for (const src of [touch, this.keys, pad]) {
      for (const k of Object.keys(src) as Action[]) if (src[k]) out[k] = true;
    }
    return out;
  }
}
