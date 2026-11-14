import { blankCommand, canAct, type Command, type Fighter, isHittable, type StrikeDef } from "@/core/combat";
import { withinDepth } from "@/core/depth";
import { clamp, sign } from "@/shared/math";

import { moveToward, playerThreatens } from "./grunt";
import type { AiView, BossDef, BossStyleId, Brain } from "./types";

/**
 * Gym leaders and the champion. Each style has a key the player has to work out (plan §5):
 *
 *  brawler         telegraphed haymakers            → guard, then punish the long recovery
 *  teepMaster      keeps you at the end of his leg  → come in off his depth line, or dash in
 *  lowKicker       chops the legs and backs away    → check the kick (tap guard as it lands)
 *  clincher        walks through strikes to grab    → teep him off; a teep staggers him
 *  runner          in and out too fast to catch     → low kick (back + Kick) slows him down
 *  ironGuard       blocks everything                → clinch: knees, or elbow out to stun him
 *  elbowBrawler    armored elbow flurries           → guard the flurry, punish while he's winded
 *  counterStriker  turns any rush back on you       → wait for his lunge, then punish
 *  kneeRusher      flying knee across the mat       → step out of his depth line, hit his back
 */
type StyleFn = (b: BossBrain, self: Fighter, view: AiView, cmd: Command) => void;

export class BossBrain implements Brain {
  engaged = true;
  mode = "stalk";
  timer = 0;
  cd = 60;
  guardUntil = 0;
  queue: string[] = [];
  lockedZ = 0;
  phase = 0;
  private styleIndex = 0;
  private styleTimer = 0;
  private activeStyle: BossStyleId;

  constructor(
    readonly fighterId: number,
    readonly def: BossDef,
  ) {
    this.activeStyle = def.phases?.[0]?.styles[0] ?? def.style;
  }

  wantsToken(): boolean {
    return false;
  }

  strike(view: AiView, role: string): StrikeDef | null {
    const id = this.def.strikes[role];
    return id ? (view.strikes[id] ?? null) : null;
  }

  rollCd(view: AiView, scale = 1): number {
    return Math.round(view.rng.range(this.def.cooldown[0], this.def.cooldown[1]) * scale);
  }

  /** Cover up when the player swings. Returns true while guarding. */
  reactGuard(self: Fighter, view: AiView, cmd: Command, chance: number): boolean {
    if (playerThreatens(self, view.player, 110) && view.rng.chance(clamp(chance, 0, 1))) {
      this.guardUntil = view.tick + 24;
    }
    if (view.tick < this.guardUntil) {
      cmd.guard = true;
      return true;
    }
    return false;
  }

  /** Throw the queued strikes one after another, chaining on hit where the cancel window allows. */
  runQueue(self: Fighter, view: AiView, cmd: Command): boolean {
    if (this.queue.length === 0) return false;
    const ready =
      canAct(self) ||
      (self.state === "strike" &&
        !!self.strike &&
        self.stateTick >= self.strike.startup + self.strike.active + Math.min(4, self.strike.recovery));
    if (!ready) return true;
    const def = view.strikes[this.queue[0]];
    this.queue.shift();
    if (def) {
      if (self.state === "strike") {
        // Force the chain even on a whiff or a block — boss flurries don't stop.
        self.strike = null;
        self.state = "idle";
      }
      cmd.strike = def;
    }
    return true;
  }

  setMode(mode: string, timer = 0): void {
    this.mode = mode;
    this.timer = timer;
  }

  private updatePhase(self: Fighter, view: AiView): void {
    const phases = this.def.phases;
    if (!phases) return;
    const frac = self.hp / self.stats.maxHp;
    let target = 0;
    for (let i = 0; i < phases.length; i++) if (frac <= phases[i].below) target = i;
    if (target !== this.phase) {
      this.phase = target;
      this.styleIndex = 0;
      this.styleTimer = 0;
      this.activeStyle = phases[target].styles[0];
      this.setMode("stalk");
      this.queue = [];
      this.cd = 50;
      self.invuln = Math.max(self.invuln, 70);
      view.emit({ type: "bossPhase", fighterId: self.id, phase: target });
      return;
    }
    const phase = phases[this.phase];
    this.styleTimer++;
    // Rotate styles only between exchanges so a move in progress finishes.
    if (this.styleTimer >= phase.swapTicks && this.mode === "stalk" && canAct(self) && phase.styles.length > 1) {
      this.styleTimer = 0;
      this.styleIndex = (this.styleIndex + 1) % phase.styles.length;
      this.activeStyle = phase.styles[this.styleIndex];
      this.cd = Math.max(this.cd, 30);
    }
  }

  get style(): BossStyleId {
    return this.activeStyle;
  }

  think(self: Fighter, view: AiView): Command {
    const cmd = blankCommand();
    self.armor = false;
    self.parry = false;
    self.pushBreaksArmor = false;
    self.tired = false;
    self.telegraph = false;
    if (this.cd > 0) this.cd--;
    if (self.state === "ko" || self.state === "intro") return cmd;
    this.updatePhase(self, view);

    const p = view.player;
    if (canAct(self)) cmd.face = (sign(p.x - self.x) || self.facing) as 1 | -1;
    STYLES[this.activeStyle](this, self, view, cmd);
    return cmd;
  }
}

const aligned = (self: Fighter, p: Fighter, tol = 10): boolean => withinDepth(self.z, p.z, tol);
const distTo = (self: Fighter, p: Fighter): number => Math.abs(p.x - self.x);
const sideOf = (self: Fighter, p: Fighter): 1 | -1 => (sign(self.x - p.x) || 1) as 1 | -1;

/** Shared tail: after an attack, stand winded for `ticks`, then go back to stalking. */
const winded = (b: BossBrain, self: Fighter, view: AiView, scale = 1): boolean => {
  if (b.mode !== "winded") return false;
  if (canAct(self)) {
    self.tired = true;
    b.timer--;
    if (b.timer <= 0) {
      b.setMode("stalk");
      b.cd = b.rollCd(view, scale);
    }
  }
  return true;
};

const brawler: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (b.runQueue(self, view, cmd)) return;
  if (b.mode === "attacking") {
    if (canAct(self)) b.setMode("winded", b.timer);
    return;
  }
  if (winded(b, self, view)) return;
  if (!canAct(self)) return;
  if (b.reactGuard(self, view, cmd, b.def.guardChance)) return;
  const heavy = b.strike(view, "heavy");
  const jab = b.strike(view, "jab");
  if (!heavy || !jab) return;
  moveToward(self, p.x + sideOf(self, p) * (heavy.reach - 14), p.z, cmd, 8, 5);
  if (b.cd <= 0 && distTo(self, p) <= heavy.reach + (heavy.lunge ?? 0) - 4 && aligned(self, p) && isHittable(p)) {
    cmd.moveX = 0;
    cmd.moveZ = 0;
    if (view.rng.chance(0.3)) {
      b.queue = [jab.id, jab.id];
      b.setMode("attacking", 18);
    } else {
      b.queue = [heavy.id];
      b.setMode("attacking", 46);
    }
    b.runQueue(self, view, cmd);
  }
};

const teepMaster: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (!canAct(self)) return;
  const teep = b.strike(view, "teep");
  const shove = b.strike(view, "shove");
  if (!teep || !shove) return;
  const dist = distTo(self, p);
  // Weak inside: he rarely covers up once you're past the leg.
  if (b.reactGuard(self, view, cmd, dist < 60 ? b.def.guardChance * 0.25 : b.def.guardChance)) return;
  const side = sideOf(self, p);
  const want = teep.reach - 12;
  if (dist < want - 18) cmd.moveX = side;
  else if (dist > want + 14) cmd.moveX = -side;
  // He tracks depth slowly — that's the opening.
  if (!aligned(self, p, 6)) cmd.moveZ = sign(p.z - self.z) * 0.45;
  if (b.cd > 0 || !isHittable(p)) return;
  if (dist <= teep.reach && dist >= (teep.minReach ?? 0) && aligned(self, p, 12)) {
    cmd.strike = teep;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    b.cd = b.rollCd(view);
  } else if (dist < 44 && aligned(self, p, 12)) {
    cmd.strike = shove;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    b.cd = b.rollCd(view, 1.3);
  }
};

const lowKicker: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (!canAct(self)) return;
  const low = b.strike(view, "low");
  if (!low) return;
  if (b.reactGuard(self, view, cmd, b.def.guardChance)) return;
  const dist = distTo(self, p);
  const side = sideOf(self, p);
  const want = low.reach - 10;
  if (dist < want - 22) cmd.moveX = side;
  else if (dist > want + 8) cmd.moveX = -side;
  if (!aligned(self, p, 6)) cmd.moveZ = sign(p.z - self.z);
  if (b.cd <= 0 && dist <= low.reach && aligned(self, p, 12) && isHittable(p)) {
    cmd.strike = low;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    b.cd = b.rollCd(view);
  }
};

const clincher: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (self.state === "clinch") {
    if (b.mode !== "holding") b.setMode("holding", 10);
    b.timer++;
    if (b.timer >= 30 && !self.clinchAction) {
      cmd.clinchAction = "knee";
      b.timer = 0;
    }
    return;
  }
  if (b.mode === "holding") b.setMode("winded", 60);
  if (self.state === "stagger") b.cd = Math.max(b.cd, 50); // teeped: the charge is off for a moment
  if (winded(b, self, view, 0.6)) return;
  if (!canAct(self)) return;
  if (b.cd > 0) {
    // Catching his breath between charges — hittable.
    moveToward(self, p.x + sideOf(self, p) * 150, p.z, cmd, 20, 8, 0.6);
    return;
  }
  // The charge: shrugs off everything except a teep.
  self.armor = true;
  self.pushBreaksArmor = true;
  cmd.moveX = sign(p.x - self.x);
  if (!aligned(self, p, 5)) cmd.moveZ = sign(p.z - self.z);
  cmd.wantClinch = distTo(self, p) < 70;
};

const runner: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (b.runQueue(self, view, cmd)) return;
  if (!canAct(self)) return;
  const jab = b.strike(view, "jab");
  const cross = b.strike(view, "cross");
  if (!jab || !cross) return;
  const dist = distTo(self, p);
  const side = sideOf(self, p);
  const slowed = self.slow > 0;
  if (b.mode === "out") {
    b.timer--;
    if (!slowed && b.timer > 14) cmd.dash = side;
    else cmd.moveX = side;
    if (b.timer <= 0 || dist > 230) b.setMode("stalk");
    return;
  }
  if (b.reactGuard(self, view, cmd, b.def.guardChance)) return;
  if (b.cd > 0) {
    // Circle at range, drifting off the player's line.
    const want = 200;
    if (dist < want - 30) cmd.moveX = side;
    else if (dist > want + 30) cmd.moveX = -side;
    if (aligned(self, p, 30)) cmd.moveZ = self.z > view.band.max / 2 ? -0.7 : 0.7;
    return;
  }
  // Blitz in.
  if (!aligned(self, p, 8)) cmd.moveZ = sign(p.z - self.z);
  if (dist > jab.reach + 60 && !slowed && aligned(self, p, 24)) {
    cmd.dash = -side as 1 | -1;
  } else if (dist > jab.reach - 6) {
    cmd.moveX = -side;
  } else if (aligned(self, p) && isHittable(p)) {
    b.queue = [jab.id, cross.id];
    b.runQueue(self, view, cmd);
    b.setMode("out", 34);
    b.cd = b.rollCd(view);
  }
};

const ironGuard: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (b.runQueue(self, view, cmd)) return;
  if (b.mode === "attacking") {
    if (canAct(self)) {
      b.setMode("stalk");
      b.cd = b.rollCd(view);
    }
    return;
  }
  if (!canAct(self)) return;
  // The shell: every swing meets the guard.
  if (b.reactGuard(self, view, cmd, b.def.guardChance)) return;
  const cross = b.strike(view, "cross");
  const hook = b.strike(view, "hook");
  if (!cross || !hook) return;
  const dist = distTo(self, p);
  moveToward(self, p.x + sideOf(self, p) * (cross.reach - 12), p.z, cmd, 8, 5, 0.7);
  if (b.cd <= 0 && dist <= cross.reach - 2 && aligned(self, p) && isHittable(p)) {
    cmd.moveX = 0;
    cmd.moveZ = 0;
    b.queue = [cross.id, hook.id];
    b.setMode("attacking");
    b.runQueue(self, view, cmd);
  }
};

const elbowBrawler: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  if (b.runQueue(self, view, cmd)) return;
  if (b.mode === "attacking") {
    if (canAct(self)) b.setMode("winded", 78);
    return;
  }
  if (winded(b, self, view)) return;
  if (!canAct(self)) return;
  if (b.reactGuard(self, view, cmd, b.def.guardChance)) return;
  const e1 = b.strike(view, "elbow1");
  const e2 = b.strike(view, "elbow2");
  const e3 = b.strike(view, "elbow3");
  if (!e1 || !e2 || !e3) return;
  const dist = distTo(self, p);
  moveToward(self, p.x + sideOf(self, p) * (e1.reach - 4), p.z, cmd, 8, 5);
  if (b.cd <= 0 && dist <= e1.reach + (e1.lunge ?? 0) && aligned(self, p) && isHittable(p)) {
    cmd.moveX = 0;
    cmd.moveZ = 0;
    b.queue = [e1.id, e2.id, e3.id];
    b.setMode("attacking");
    b.runQueue(self, view, cmd);
  }
};

const counterStriker: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  const lunge = b.strike(view, "lunge");
  const counter = b.strike(view, "counter");
  if (!lunge || !counter) return;
  if (b.mode === "attacking") {
    if (canAct(self)) b.setMode("winded", 52);
    return;
  }
  if (winded(b, self, view)) return;
  if (!canAct(self)) return;
  // Parried something last tick: answer immediately.
  const parried = view.events.some((e) => e.type === "hit" && e.targetId === self.id && e.result === "parry");
  if (parried && distTo(self, p) <= counter.reach + (counter.lunge ?? 0)) {
    cmd.strike = counter;
    b.cd = Math.max(b.cd, 40);
    return;
  }
  self.parry = true;
  const dist = distTo(self, p);
  const reach = lunge.reach + (lunge.lunge ?? 0);
  // He doesn't chase — he walks you down slowly until the lunge will reach.
  if (dist > reach - 26) cmd.moveX = sign(p.x - self.x) * 0.6;
  if (!aligned(self, p, 6)) cmd.moveZ = sign(p.z - self.z) * 0.8;
  if (b.cd <= 0 && dist <= reach - 6 && dist >= 50 && aligned(self, p) && isHittable(p)) {
    self.parry = false;
    cmd.strike = lunge;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    b.setMode("attacking");
  }
};

const kneeRusher: StyleFn = (b, self, view, cmd) => {
  const p = view.player;
  const knee = b.strike(view, "flyknee");
  if (!knee) return;
  if (b.mode === "rushing") {
    if (canAct(self)) b.setMode("winded", 26);
    return;
  }
  if (winded(b, self, view)) return;
  if (!canAct(self)) return;
  if (b.mode === "coil") {
    // The tell: he drops into a crouch on the player's line, then goes.
    self.telegraph = true;
    b.timer--;
    cmd.face = (sign(p.x - self.x) || self.facing) as 1 | -1;
    if (b.timer <= 0) {
      cmd.strike = knee;
      b.setMode("rushing");
    }
    return;
  }
  if (b.reactGuard(self, view, cmd, b.def.guardChance)) return;
  const dist = distTo(self, p);
  const side = sideOf(self, p);
  if (b.cd > 0) {
    // Back off to get a run-up.
    const cornered = self.x <= view.minX + 30 || self.x >= view.maxX - 30;
    if (dist < 220 && !cornered) cmd.moveX = side;
    if (!aligned(self, p, 6)) cmd.moveZ = sign(p.z - self.z) * 0.6;
    return;
  }
  if (!aligned(self, p, 6)) {
    cmd.moveZ = sign(p.z - self.z);
    return;
  }
  b.lockedZ = self.z;
  b.setMode("coil", 36);
  b.cd = b.rollCd(view);
};

const STYLES: Record<BossStyleId, StyleFn> = {
  brawler,
  teepMaster,
  lowKicker,
  clincher,
  runner,
  ironGuard,
  elbowBrawler,
  counterStriker,
  kneeRusher,
};
