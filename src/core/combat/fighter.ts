import { clampDepth, withinDepth } from "@/core/depth";
import { sign } from "@/shared/math";

import type {
  ClinchBreakReason,
  ClinchMoves,
  Command,
  CombatTuning,
  CombatWorld,
  Fighter,
  FighterState,
  FighterStats,
  StrikeDef,
  Team,
} from "./types";

export interface FighterInit {
  id: number;
  team: Team;
  kind: string;
  name?: string;
  rank?: number;
  isBoss?: boolean;
  x: number;
  z: number;
  facing?: 1 | -1;
  stats: FighterStats;
  clinchMoves: ClinchMoves;
  clinchable?: boolean;
  clinchKneeCap?: number;
}

export const createFighter = (init: FighterInit): Fighter => ({
  id: init.id,
  team: init.team,
  kind: init.kind,
  rank: init.rank ?? 0,
  name: init.name ?? init.kind,
  isBoss: init.isBoss ?? false,
  x: init.x,
  z: init.z,
  vx: 0,
  facing: init.facing ?? 1,
  hp: init.stats.maxHp,
  stats: init.stats,
  state: "idle",
  stateTick: 0,
  stun: 0,
  strike: null,
  strikeHit: [],
  landed: false,
  lastStrikeId: null,
  lastStrikeEnd: -9999,
  stringLen: 0,
  stringLimbs: [],
  dashDir: 1,
  invuln: 0,
  slow: 0,
  guardPressedAt: -9999,
  clinchWith: null,
  clinchCharge: 0,
  clinchKnees: 0,
  clinchAction: null,
  clinchActionTick: 0,
  clinchMoves: init.clinchMoves,
  clinchKneeCap: init.clinchKneeCap ?? 3,
  clinchable: init.clinchable ?? true,
  mashCount: 0,
  armor: false,
  pushBreaksArmor: false,
  parry: false,
  tired: false,
  telegraph: false,
  hitChain: 0,
  thrown: false,
  thrownHit: [],
  remove: false,
});

export const setState = (f: Fighter, state: FighterState): void => {
  if (f.state !== state) {
    f.state = state;
    f.stateTick = 0;
  }
};

export const isAlive = (f: Fighter): boolean => f.state !== "ko";

/** Can be struck right now. */
export const isHittable = (f: Fighter): boolean =>
  f.invuln === 0 && f.state !== "knockdown" && f.state !== "getup" && f.state !== "ko" && f.state !== "intro" && f.state !== "win";

/** Free to take a new order (move, guard, strike). */
export const canAct = (f: Fighter): boolean => f.state === "idle" || f.state === "walk" || f.state === "guard";

const GRABBABLE: ReadonlySet<FighterState> = new Set(["idle", "walk", "guard", "blockstun", "hit", "stagger"]);

export type StrikeGate = "open" | "grace" | "link" | "closed";

/**
 * When may this fighter start a strike?
 *  open   — free to open a new string
 *  grace  — just finished a strike; the next step of the string is still available
 *  link   — mid-strike, the hit landed and the cancel window is open
 *  closed — not now
 */
export const strikeGate = (f: Fighter, tick: number, tuning: CombatTuning): StrikeGate => {
  switch (f.state) {
    case "idle":
    case "walk":
    case "guard":
      return f.lastStrikeId !== null && tick - f.lastStrikeEnd <= tuning.linkGrace ? "grace" : "open";
    case "dash":
      return "open";
    case "strike": {
      const s = f.strike;
      if (!s || !f.landed) return "closed";
      return f.stateTick >= (s.cancelAt ?? s.startup + s.active) ? "link" : "closed";
    }
    default:
      return "closed";
  }
};

export const startStrike = (f: Fighter, def: StrikeDef, continues: boolean, w: CombatWorld): void => {
  if (!continues) {
    f.stringLen = 0;
    f.stringLimbs = [];
  }
  f.stringLen++;
  if (!f.stringLimbs.includes(def.limb)) f.stringLimbs.push(def.limb);
  f.strike = def;
  f.strikeHit = [];
  f.landed = false;
  f.lastStrikeId = def.id;
  f.clinchCharge = 0;
  f.state = "strike";
  f.stateTick = 0;
  w.events.push({ type: "strike", fighterId: f.id, strikeId: def.id, limb: def.limb });
};

export const findFighter = (w: CombatWorld, id: number | null): Fighter | undefined =>
  id === null ? undefined : w.fighters.find((o) => o.id === id);

/** Nearest opposing fighter standing right in front, close enough to grab. */
export const clinchCandidate = (f: Fighter, w: CombatWorld): Fighter | null => {
  let best: Fighter | null = null;
  let bestDx = Infinity;
  for (const o of w.fighters) {
    if (o.team === f.team || !o.clinchable || o.invuln > 0 || !GRABBABLE.has(o.state)) continue;
    const dx = (o.x - f.x) * f.facing;
    if (dx <= 0 || dx > w.tuning.clinchRange) continue;
    if (!withinDepth(f.z, o.z, w.tuning.clinchDepth)) continue;
    if (dx < bestDx) {
      best = o;
      bestDx = dx;
    }
  }
  return best;
};

export const beginClinch = (holder: Fighter, held: Fighter, w: CombatWorld): void => {
  breakClinchOf(held, w, "hit");
  holder.state = "clinch";
  holder.stateTick = 0;
  holder.clinchWith = held.id;
  holder.clinchKnees = 0;
  holder.clinchAction = null;
  holder.clinchActionTick = 0;
  holder.clinchCharge = 0;
  holder.vx = 0;
  holder.strike = null;
  held.state = "clinched";
  held.stateTick = 0;
  held.clinchWith = holder.id;
  held.mashCount = 0;
  held.strike = null;
  held.vx = 0;
  held.x = holder.x + holder.facing * w.tuning.clinchHold;
  held.z = holder.z;
  held.facing = holder.facing === 1 ? -1 : 1;
  w.events.push({ type: "clinch", attackerId: holder.id, targetId: held.id });
};

/** End a clinch. The held fighter goes back to idle unless something else already changed its state. */
export const releaseClinch = (holder: Fighter, w: CombatWorld, reason: ClinchBreakReason): void => {
  const held = findFighter(w, holder.clinchWith);
  holder.clinchWith = null;
  holder.clinchAction = null;
  if (holder.state === "clinch") setState(holder, "idle");
  if (held) {
    held.clinchWith = null;
    if (held.state === "clinched") setState(held, "idle");
    w.events.push({ type: "clinchBreak", attackerId: holder.id, targetId: held.id, reason });
  }
};

/** If `f` is part of a clinch (either side), break it. */
export const breakClinchOf = (f: Fighter, w: CombatWorld, reason: ClinchBreakReason): void => {
  if (f.clinchWith === null) return;
  if (f.state === "clinch") {
    releaseClinch(f, w, reason);
  } else {
    const holder = findFighter(w, f.clinchWith);
    if (holder && holder.clinchWith === f.id) releaseClinch(holder, w, reason);
    else f.clinchWith = null;
  }
};

export const knockDown = (f: Fighter, vx: number, w: CombatWorld): void => {
  breakClinchOf(f, w, "hit");
  f.state = "knockdown";
  f.stateTick = 0;
  f.hitChain = 0;
  f.vx = vx;
  f.strike = null;
  f.lastStrikeId = null;
  f.clinchCharge = 0;
};

export const knockOut = (f: Fighter, vx: number, w: CombatWorld, byId: number | null): void => {
  breakClinchOf(f, w, "ko");
  f.hp = 0;
  f.state = "ko";
  f.stateTick = 0;
  f.vx = vx;
  f.strike = null;
  f.armor = false;
  f.parry = false;
  w.events.push({ type: "ko", fighterId: f.id, byId });
};

export const stagger = (f: Fighter, ticks: number, w: CombatWorld): void => {
  breakClinchOf(f, w, "hit");
  f.state = "stagger";
  f.stateTick = 0;
  f.stun = ticks;
  f.strike = null;
  f.lastStrikeId = null;
};

const free = (f: Fighter, cmd: Command, w: CombatWorld): void => {
  const t = w.tuning;
  if (cmd.guardPressed) f.guardPressedAt = w.tick;
  if (cmd.face !== 0) f.facing = cmd.face;
  else if (cmd.moveX !== 0) f.facing = sign(cmd.moveX) as 1 | -1;

  if (cmd.strike) {
    startStrike(f, cmd.strike, cmd.continuesString, w);
    return;
  }
  if (cmd.guard) {
    setState(f, "guard");
    f.clinchCharge = 0;
    return;
  }
  if (cmd.dash !== 0 && f.slow === 0) {
    f.dashDir = cmd.dash;
    if (cmd.face === 0) f.facing = cmd.dash;
    f.clinchCharge = 0;
    f.state = "dash";
    f.stateTick = 0;
    return;
  }

  let blockedForward = false;
  if (cmd.wantClinch) {
    const target = clinchCandidate(f, w);
    if (target) {
      blockedForward = true;
      f.clinchCharge++;
      if (f.clinchCharge >= t.clinchBeat) {
        beginClinch(f, target, w);
        return;
      }
    } else {
      f.clinchCharge = 0;
    }
  } else {
    f.clinchCharge = 0;
  }

  const slow = f.slow > 0 ? t.slowFactor : 1;
  let mx = cmd.moveX;
  if (blockedForward && sign(mx) === f.facing) mx = 0;
  const back = mx !== 0 && sign(mx) !== f.facing ? t.backpedal : 1;
  f.x += mx * f.stats.walkSpeed * slow * back;
  f.z += cmd.moveZ * f.stats.depthSpeed * slow;
  setState(f, cmd.moveX !== 0 || cmd.moveZ !== 0 ? "walk" : "idle");
};

const stepStrike = (f: Fighter, cmd: Command, w: CombatWorld): void => {
  const s = f.strike;
  if (!s) {
    setState(f, "idle");
    return;
  }
  if (s.lunge && f.stateTick <= s.startup) f.x += (f.facing * s.lunge) / Math.max(1, s.startup);
  if (s.travel && f.stateTick > s.startup && f.stateTick <= s.startup + s.active) f.x += f.facing * s.travel;
  if (cmd.strike && f.landed && f.stateTick >= (s.cancelAt ?? s.startup + s.active)) {
    startStrike(f, cmd.strike, true, w);
    return;
  }
  if (f.stateTick >= s.startup + s.active + s.recovery) {
    f.strike = null;
    f.lastStrikeEnd = w.tick;
    setState(f, "idle");
  }
};

const stepClinchHolder = (f: Fighter, cmd: Command, w: CombatWorld): void => {
  const t = w.tuning;
  const held = findFighter(w, f.clinchWith);
  if (!held || held.state !== "clinched") {
    f.clinchWith = null;
    f.clinchAction = null;
    setState(f, "idle");
    return;
  }
  held.x = f.x + f.facing * t.clinchHold;
  held.z = f.z;

  if (f.clinchAction) {
    const action = f.clinchAction;
    const def = f.clinchMoves[action];
    f.clinchActionTick++;
    if (f.clinchActionTick === def.startup) {
      const damage = Math.max(1, Math.round(def.damage * f.stats.damageDealt));
      held.hp -= damage;
      const ko = held.hp <= 0;
      w.events.push({
        type: "hit",
        attackerId: f.id,
        targetId: held.id,
        strikeId: def.id,
        limb: def.limb,
        result: "hit",
        damage,
        x: held.x,
        z: held.z,
        heavy: action !== "knee",
        knockdown: action === "dump",
        ko,
      });
      w.hitStop = Math.max(w.hitStop, ko ? t.koHitStop : action === "knee" ? t.hitStop : t.heavyHitStop);
      if (action === "knee") f.clinchKnees++;
      if (ko) {
        knockOut(held, f.facing * 6, w, f.id);
        return;
      }
      if (action === "elbow") {
        releaseClinch(f, w, "elbow");
        stagger(held, def.effectTicks ?? 60, w);
        held.vx = f.facing * def.knockback * held.stats.knockbackTaken;
        return;
      }
      if (action === "dump") {
        releaseClinch(f, w, "dump");
        knockDown(held, -f.facing * t.throwSpeed, w);
        held.thrown = true;
        held.thrownHit = [];
        return;
      }
    }
    if (f.clinchActionTick >= def.startup + def.recovery) {
      f.clinchAction = null;
      if (f.clinchKnees >= Math.min(3, held.clinchKneeCap)) {
        releaseClinch(f, w, "knees");
        held.state = "hit";
        held.stateTick = 0;
        held.stun = 22;
        held.vx = f.facing * 5 * held.stats.knockbackTaken;
      }
    }
    return;
  }

  if (cmd.clinchAction) {
    f.clinchAction = cmd.clinchAction;
    f.clinchActionTick = 0;
    return;
  }
  if (f.stateTick >= t.clinchTimeout) {
    releaseClinch(f, w, "timeout");
    held.vx = f.facing * 3;
  }
};

const stepClinched = (f: Fighter, cmd: Command, w: CombatWorld): void => {
  const holder = findFighter(w, f.clinchWith);
  if (!holder || holder.state !== "clinch") {
    f.clinchWith = null;
    setState(f, "idle");
    return;
  }
  f.mashCount += cmd.mash;
  if (f.mashCount >= w.tuning.clinchEscapeMash) {
    releaseClinch(holder, w, "escape");
    stagger(holder, 40, w);
    holder.vx = -holder.facing * 4;
  }
};

/** Advance one fighter by one tick. Hits are resolved afterwards by `resolveStrikes`. */
export const stepFighter = (f: Fighter, cmd: Command, w: CombatWorld): void => {
  const t = w.tuning;
  if (f.invuln > 0) f.invuln--;
  if (f.slow > 0) f.slow--;
  if (f.vx !== 0) {
    f.x += f.vx;
    f.vx *= t.friction;
    if (Math.abs(f.vx) < 0.15) f.vx = 0;
  }
  f.stateTick++;

  switch (f.state) {
    case "idle":
    case "walk":
      free(f, cmd, w);
      break;
    case "guard":
      if (cmd.guard && !cmd.strike) {
        if (cmd.guardPressed) f.guardPressedAt = w.tick;
        if (cmd.face !== 0) f.facing = cmd.face;
      } else {
        free(f, cmd, w);
      }
      break;
    case "dash": {
      const slow = f.slow > 0 ? t.slowFactor : 1;
      f.x += f.dashDir * f.stats.dashSpeed * slow;
      f.z += cmd.moveZ * f.stats.depthSpeed * 0.5;
      if (cmd.strike) startStrike(f, cmd.strike, false, w);
      else if (f.stateTick >= f.stats.dashTicks) setState(f, "idle");
      break;
    }
    case "strike":
      stepStrike(f, cmd, w);
      break;
    case "blockstun":
      if (f.stateTick >= f.stun) setState(f, cmd.guard ? "guard" : "idle");
      break;
    case "hit":
    case "stagger":
      if (f.stateTick >= f.stun) {
        f.hitChain = 0;
        setState(f, "idle");
      }
      break;
    case "knockdown":
      if (f.vx === 0) f.thrown = false;
      if (f.stateTick >= t.knockdownFall + t.knockdownDown) {
        f.thrown = false;
        f.invuln = t.getUp + t.getUpInvuln;
        setState(f, "getup");
      }
      break;
    case "getup":
      if (f.stateTick >= t.getUp) setState(f, "idle");
      break;
    case "ko":
      if (f.team === "enemy" && f.stateTick >= t.koTicks) f.remove = true;
      break;
    case "clinch":
      stepClinchHolder(f, cmd, w);
      break;
    case "clinched":
      stepClinched(f, cmd, w);
      break;
    case "intro":
    case "win":
      break;
  }
  f.z = clampDepth(f.z, w.band);
};
