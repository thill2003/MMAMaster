import { withinDepth } from "@/core/depth";
import {
  type DirMod,
  directionModifier,
  EMPTY_FRAME,
  type InputFrame,
  inputKey,
  type Limb,
  type PressKind,
  StrikeBuffer,
} from "@/core/input";

import { isAlive, strikeGate, type StrikeGate } from "./fighter";
import { blankCommand, type Command, type CombatWorld, type Fighter, type MoveSet, type StrikeDef } from "./types";

export interface StrikePick {
  def: StrikeDef;
  continues: boolean;
}

const opener = (moves: MoveSet, limb: Limb, press: PressKind, dir: DirMod): StrikeDef | null => {
  const id =
    moves.openers[inputKey(limb, press, dir)] ??
    moves.openers[inputKey(limb, press, "neutral")] ??
    moves.openers[inputKey(limb, "tap", dir)] ??
    moves.openers[inputKey(limb, "tap", "neutral")];
  return id ? (moves.strikes[id] ?? null) : null;
};

/**
 * Which strike does this input produce, given where the fighter is in a string?
 * Order: an explicit link from the last strike → (if the direction has no opener of its own) the neutral
 * link → a limb switch into that limb's opener. The same limb with no link ends the string.
 */
export const resolveStrike = (
  moves: MoveSet,
  f: Fighter,
  gate: StrikeGate,
  limb: Limb,
  press: PressKind,
  dir: DirMod,
): StrikePick | null => {
  if (gate === "closed") return null;
  const last = f.lastStrikeId ? moves.strikes[f.lastStrikeId] : undefined;
  const fresh = (): StrikePick | null => {
    const def = opener(moves, limb, press, dir);
    return def ? { def, continues: false } : null;
  };
  if (gate === "open" || !last || dir === "dash") return fresh();

  if (f.stringLen < moves.maxString) {
    const links = moves.links[last.id] ?? {};
    let id: string | undefined = links[inputKey(limb, press, dir)];
    if (!id && dir !== "neutral" && !moves.openers[inputKey(limb, press, dir)]) {
      id = links[inputKey(limb, press, "neutral")];
    }
    if (id && moves.strikes[id]) return { def: moves.strikes[id], continues: true };
    if (limb !== last.limb) {
      const def = opener(moves, limb, press, dir);
      if (def) return { def, continues: true };
    }
  }
  return gate === "grace" ? fresh() : null;
};

/** Turns the player's input frames into combat commands: buffering, string lookup, lock-on facing, clinch inputs. */
export class PlayerController {
  private readonly buffer: StrikeBuffer;
  private latest: InputFrame = EMPTY_FRAME;
  private pendingDash: -1 | 0 | 1 = 0;
  private pendingGuardPress = false;
  private pendingMash = 0;

  constructor(
    private readonly moves: MoveSet,
    bufferTicks: number,
  ) {
    this.buffer = new StrikeBuffer(bufferTicks);
  }

  /** Call every tick, even while the fight is frozen in hit-stop, so no press is lost. */
  feed(input: InputFrame, tick: number): void {
    this.latest = input;
    for (const s of input.strikes) this.buffer.push(s, tick);
    if (input.dash !== 0) this.pendingDash = input.dash;
    if (input.guardPressed) this.pendingGuardPress = true;
    this.pendingMash += input.mash;
  }

  /** Face the nearest enemy in reach; pressing toward another enemy turns to it; pressing away backpedals. */
  private lockOn(f: Fighter, moveX: number, w: CombatWorld): 1 | -1 | 0 {
    const t = w.tuning;
    let nearest: Fighter | null = null;
    let nearestAhead: Fighter | null = null;
    for (const o of w.fighters) {
      if (o.team === f.team || !isAlive(o) || o.state === "knockdown") continue;
      const dx = o.x - f.x;
      if (Math.abs(dx) > t.lockOnRange || !withinDepth(f.z, o.z, t.lockOnDepth)) continue;
      if (!nearest || Math.abs(dx) < Math.abs(nearest.x - f.x)) nearest = o;
      if (moveX !== 0 && Math.sign(dx) === moveX) {
        if (!nearestAhead || Math.abs(dx) < Math.abs(nearestAhead.x - f.x)) nearestAhead = o;
      }
    }
    const target = nearestAhead ?? nearest;
    if (!target) return 0;
    if (!nearestAhead && moveX === 0) {
      // Standing still: keep the current facing if someone is there, otherwise turn to the nearest.
      const inFront = w.fighters.some(
        (o) =>
          o.team !== f.team &&
          isAlive(o) &&
          (o.x - f.x) * f.facing > 0 &&
          Math.abs(o.x - f.x) <= t.lockOnRange &&
          withinDepth(f.z, o.z, t.lockOnDepth),
      );
      if (inFront) return f.facing;
    }
    return target.x >= f.x ? 1 : -1;
  }

  command(f: Fighter, w: CombatWorld): Command {
    const input = this.latest;
    const cmd = blankCommand();
    cmd.moveX = input.moveX;
    cmd.moveZ = input.moveY;
    cmd.guard = input.guardHeld;
    cmd.guardPressed = this.pendingGuardPress;
    cmd.dash = this.pendingDash;
    cmd.mash = this.pendingMash;
    this.pendingGuardPress = false;
    this.pendingDash = 0;
    this.pendingMash = 0;

    cmd.face = this.lockOn(f, input.moveX, w);
    const facing = cmd.face !== 0 ? cmd.face : input.moveX !== 0 ? (input.moveX as 1 | -1) : f.facing;
    cmd.wantClinch = input.moveX !== 0 && input.moveX === facing && !input.guardHeld;

    const buffered = this.buffer.peek(w.tick);
    if (!buffered) return cmd;

    if (f.state === "clinch") {
      if (!f.clinchAction) {
        const back = buffered.moveX !== 0 && buffered.moveX !== f.facing;
        if (buffered.limb === "knee") cmd.clinchAction = back ? "dump" : "knee";
        else if (buffered.limb === "elbow") cmd.clinchAction = "elbow";
        this.buffer.consume();
      }
      return cmd;
    }

    const gate = strikeGate(f, w.tick, w.tuning);
    if (gate === "closed") return cmd;
    const strikeFacing = gate === "link" ? f.facing : facing;
    const dir = directionModifier(buffered.moveX, strikeFacing, f.state === "dash");
    const pick = resolveStrike(this.moves, f, gate, buffered.limb, buffered.press, dir);
    if (pick) {
      cmd.strike = pick.def;
      cmd.continuesString = pick.continues;
      this.buffer.consume();
    } else if (gate !== "link") {
      this.buffer.consume();
    }
    return cmd;
  }
}
