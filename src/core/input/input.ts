/**
 * The action map. Every input device (touch, keyboard, gamepad) reduces to a set of held actions per tick;
 * the interpreter turns that into taps, holds, double-tap dashes and guard presses. Nothing here knows about
 * the DOM, Phaser or wall-clock time — everything is counted in 60 Hz ticks.
 */
export const ACTIONS = [
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "MOVE_UP",
  "MOVE_DOWN",
  "GUARD",
  "PUNCH",
  "ELBOW",
  "KICK",
  "KNEE",
  "SPECIAL_1",
  "SPECIAL_2",
  "ITEM",
] as const;

export type Action = (typeof ACTIONS)[number];

export type ActionSet = Readonly<Partial<Record<Action, boolean>>>;

export const LIMBS = ["punch", "elbow", "kick", "knee"] as const;
export type Limb = (typeof LIMBS)[number];

export type PressKind = "tap" | "hold";

/** Direction modifier relative to the fighter's facing. `dash` wins over forward/back. */
export type DirMod = "neutral" | "forward" | "back" | "dash";

export const STRIKE_ACTIONS: ReadonlyArray<{ action: Action; limb: Limb }> = [
  { action: "PUNCH", limb: "punch" },
  { action: "ELBOW", limb: "elbow" },
  { action: "KICK", limb: "kick" },
  { action: "KNEE", limb: "knee" },
];

/** SPECIAL_1 and SPECIAL_2 are defined but bound to nothing in v1 (plan §6). */
export const RESERVED_ACTIONS: readonly Action[] = ["SPECIAL_1", "SPECIAL_2"];

export interface StrikeInput {
  limb: Limb;
  press: PressKind;
  /** Horizontal direction held when the press resolved: -1 left, 0 none, 1 right. */
  moveX: -1 | 0 | 1;
}

export interface InputFrame {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  guardHeld: boolean;
  /** True only on the tick the guard hub went down — the check window opens here. */
  guardPressed: boolean;
  /** Strike presses that resolved this tick (a tap resolves on release, a hold at the threshold). */
  strikes: StrikeInput[];
  /** Double-tap direction this tick, or 0. */
  dash: -1 | 0 | 1;
  item: boolean;
  /** Buttons newly pressed this tick — used to mash out of a clinch. */
  mash: number;
}

export interface InputTuning {
  /** A press held this many ticks becomes a hold. */
  holdTicks: number;
  /** Two presses of the same direction within this many ticks is a dash. */
  doubleTapTicks: number;
  /** A resolved strike stays usable this many ticks. */
  bufferTicks: number;
}

export const DEFAULT_INPUT_TUNING: InputTuning = { holdTicks: 10, doubleTapTicks: 14, bufferTicks: 6 };

export const EMPTY_FRAME: InputFrame = {
  moveX: 0,
  moveY: 0,
  guardHeld: false,
  guardPressed: false,
  strikes: [],
  dash: 0,
  item: false,
  mash: 0,
};

interface ButtonTrack {
  down: boolean;
  heldFor: number;
  /** A hold already fired for this press, so the release must not also fire a tap. */
  consumed: boolean;
}

export class InputInterpreter {
  private readonly tuning: InputTuning;
  private readonly buttons = new Map<Limb, ButtonTrack>();
  private prev: ActionSet = {};
  private lastDirTap: { dir: -1 | 1; age: number } | null = null;

  constructor(tuning: InputTuning = DEFAULT_INPUT_TUNING) {
    this.tuning = tuning;
    for (const { limb } of STRIKE_ACTIONS) this.buttons.set(limb, { down: false, heldFor: 0, consumed: false });
  }

  /** Advance one tick with the set of actions currently held. */
  step(held: ActionSet): InputFrame {
    const left = !!held.MOVE_LEFT;
    const right = !!held.MOVE_RIGHT;
    const up = !!held.MOVE_UP;
    const down = !!held.MOVE_DOWN;
    const moveX: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    const moveY: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;

    let mash = 0;
    const strikes: StrikeInput[] = [];
    for (const { action, limb } of STRIKE_ACTIONS) {
      const track = this.buttons.get(limb)!;
      const isDown = !!held[action];
      if (isDown && !track.down) {
        track.down = true;
        track.heldFor = 0;
        track.consumed = false;
        mash++;
      } else if (isDown && track.down) {
        track.heldFor++;
        if (!track.consumed && track.heldFor >= this.tuning.holdTicks) {
          track.consumed = true;
          strikes.push({ limb, press: "hold", moveX });
        }
      } else if (!isDown && track.down) {
        track.down = false;
        if (!track.consumed) strikes.push({ limb, press: "tap", moveX });
      }
    }

    const guardHeld = !!held.GUARD;
    const guardPressed = guardHeld && !this.prev.GUARD;
    if (guardPressed) mash++;

    // Double-tap: a fresh press of a direction soon after a press of the same direction.
    let dash: -1 | 0 | 1 = 0;
    if (this.lastDirTap) {
      this.lastDirTap.age++;
      if (this.lastDirTap.age > this.tuning.doubleTapTicks) this.lastDirTap = null;
    }
    const pressedLeft = left && !this.prev.MOVE_LEFT;
    const pressedRight = right && !this.prev.MOVE_RIGHT;
    const tapDir: -1 | 0 | 1 = pressedRight ? 1 : pressedLeft ? -1 : 0;
    if (tapDir !== 0) {
      if (this.lastDirTap && this.lastDirTap.dir === tapDir) {
        dash = tapDir;
        this.lastDirTap = null;
      } else {
        this.lastDirTap = { dir: tapDir, age: 0 };
      }
    }

    const item = !!held.ITEM && !this.prev.ITEM;
    this.prev = { ...held };
    return { moveX, moveY, guardHeld, guardPressed, strikes, dash, item, mash };
  }

  reset(): void {
    this.prev = {};
    this.lastDirTap = null;
    for (const track of this.buttons.values()) {
      track.down = false;
      track.heldFor = 0;
      track.consumed = false;
    }
  }
}

/** Keeps the most recent resolved strike alive for a few ticks so a slightly early press still comes out. */
export class StrikeBuffer {
  private entry: { strike: StrikeInput; tick: number } | null = null;

  constructor(private readonly bufferTicks: number) {}

  push(strike: StrikeInput, tick: number): void {
    this.entry = { strike, tick };
  }

  peek(tick: number): StrikeInput | null {
    if (this.entry && tick - this.entry.tick > this.bufferTicks) this.entry = null;
    return this.entry ? this.entry.strike : null;
  }

  consume(): void {
    this.entry = null;
  }
}

/** Translate a held horizontal direction into forward/back for a fighter facing `facing`. */
export const directionModifier = (moveX: number, facing: 1 | -1, dashing: boolean): DirMod => {
  if (dashing) return "dash";
  if (moveX === 0) return "neutral";
  return moveX === facing ? "forward" : "back";
};

export type InputKey = `${Limb}.${PressKind}.${DirMod}`;

export const inputKey = (limb: Limb, press: PressKind, dir: DirMod): InputKey => `${limb}.${press}.${dir}`;
