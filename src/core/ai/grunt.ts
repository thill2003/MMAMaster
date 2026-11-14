import { blankCommand, canAct, type Command, type Fighter, isHittable, type StrikeDef } from "@/core/combat";
import { withinDepth } from "@/core/depth";
import { clamp, sign } from "@/shared/math";

import type { AiView, ArchetypeDef, Brain, RankDef } from "./types";

/** Set moveX/moveZ toward a point. Returns true once inside the dead zone on both axes. */
export const moveToward = (self: Fighter, tx: number, tz: number, cmd: Command, deadX = 6, deadZ = 5, speed = 1): boolean => {
  const dx = tx - self.x;
  const dz = tz - self.z;
  const nearX = Math.abs(dx) <= deadX;
  const nearZ = Math.abs(dz) <= deadZ;
  if (!nearX) cmd.moveX = sign(dx) * speed;
  if (!nearZ) cmd.moveZ = sign(dz) * speed;
  return nearX && nearZ;
};

/** Did the player just start a strike that threatens this fighter? */
export const playerThreatens = (self: Fighter, player: Fighter, reach = 96, depth = 26): boolean =>
  player.state === "strike" &&
  player.stateTick === 0 &&
  (self.x - player.x) * player.facing > 0 &&
  Math.abs(self.x - player.x) < reach &&
  withinDepth(self.z, player.z, depth);

/** Nudge depth away from other enemies standing on the same spot. */
const separation = (self: Fighter, view: AiView): number => {
  let push = 0;
  for (const o of view.fighters) {
    if (o === self || o.team !== self.team || o.state === "ko") continue;
    if (Math.abs(o.x - self.x) < 34 && Math.abs(o.z - self.z) < 18) push += self.z >= o.z ? 1 : -1;
  }
  return sign(push);
};

/** Far enough onto the screen to be seen before it swings. */
const onScreen = (self: Fighter, view: AiView): boolean => self.x >= view.minX - 22 && self.x <= view.maxX + 22;

/**
 * Where to stand to attack: `range` out on the grunt's own side of the player, but never off the screen.
 * With the player backed against an edge the spot is squeezed in beside them, and the bodies push apart.
 */
const attackSpot = (p: Fighter, side: 1 | -1, range: number, view: AiView): number =>
  clamp(p.x + side * range, view.minX - 20, view.maxX + 20);

type Mode = "hover" | "engage" | "rest";

export class GruntBrain implements Brain {
  engaged = false;
  private mode: Mode = "hover";
  private cooldown: number;
  private restTimer = 0;
  private guardUntil = 0;
  private side: 1 | -1;
  private zOffset: number;
  private next: StrikeDef | null = null;
  private followUpPending = false;
  private attacksLeft = 1;
  private kneeTimer = 0;
  private inClinch = false;

  constructor(
    readonly fighterId: number,
    private readonly archetype: ArchetypeDef,
    private readonly rank: RankDef,
    side: 1 | -1,
    zOffset: number,
    firstDelay: number,
  ) {
    this.side = side;
    this.zOffset = zOffset;
    this.cooldown = firstDelay;
  }

  wantsToken(): boolean {
    return this.mode === "hover";
  }

  private pickAttack(view: AiView): StrikeDef | null {
    const weights: Record<string, number> = {};
    for (const a of this.archetype.attacks) weights[a.strike] = a.weight;
    const id = view.rng.weighted(weights);
    return view.strikes[id] ?? null;
  }

  private rollCooldown(view: AiView): number {
    const [lo, hi] = this.archetype.cooldown;
    return Math.round(view.rng.range(lo, hi) * this.rank.cooldown);
  }

  private finishAttack(view: AiView): void {
    this.attacksLeft--;
    this.cooldown = this.rollCooldown(view);
    this.next = null;
    if (this.attacksLeft <= 0) {
      this.mode = "rest";
      this.engaged = false;
      this.restTimer = Math.round(view.rng.range(50, 110) * this.rank.cooldown);
    }
  }

  think(self: Fighter, view: AiView): Command {
    const cmd = blankCommand();
    const p = view.player;
    const t = view.tick;
    if (this.cooldown > 0) this.cooldown--;

    if (self.state === "clinch") {
      // Holding the player: a knee every so often until the cap or the player mashes out.
      this.inClinch = true;
      this.kneeTimer++;
      if (this.kneeTimer >= 44 && !self.clinchAction) {
        cmd.clinchAction = "knee";
        this.kneeTimer = 0;
      }
      return cmd;
    }
    this.kneeTimer = 20;
    if (this.inClinch) {
      this.inClinch = false;
      this.attacksLeft = 1;
      this.finishAttack(view);
    }

    if (!canAct(self)) {
      // Knocked around mid-attack: the planned follow-up is off.
      if (self.state === "hit" || self.state === "knockdown" || self.state === "stagger") this.followUpPending = false;
      return cmd;
    }

    const dxToPlayer = p.x - self.x;
    cmd.face = (sign(dxToPlayer) || self.facing) as 1 | -1;
    const dist = Math.abs(dxToPlayer);

    // React to the player's strikes by covering up — more often at higher ranks.
    if (playerThreatens(self, p) && view.rng.chance(clamp(this.archetype.guardChance + this.rank.guard, 0, 0.9))) {
      this.guardUntil = t + 26;
    }
    if (t < this.guardUntil) {
      cmd.guard = true;
      return cmd;
    }

    if (this.followUpPending) {
      // Second strike of a combination, thrown as soon as the first finishes.
      this.followUpPending = false;
      const def = this.archetype.followUp ? view.strikes[this.archetype.followUp] : null;
      if (def && dist <= def.reach + 6 && isHittable(p) && withinDepth(self.z, p.z, 12)) {
        cmd.strike = def;
        this.finishAttack(view);
        return cmd;
      }
      this.finishAttack(view);
    }

    const sep = separation(self, view);
    const currentSide = (sign(self.x - p.x) || this.side) as 1 | -1;

    if (this.mode === "rest") {
      this.restTimer--;
      if (this.restTimer <= 0) this.mode = "hover";
      moveToward(self, p.x + currentSide * (this.archetype.hoverDistance + 40), p.z + this.zOffset, cmd, 14, 8, 0.8);
      if (sep !== 0 && cmd.moveZ === 0) cmd.moveZ = sep * 0.6;
      return cmd;
    }

    if (this.mode === "hover") {
      if (this.engaged) {
        this.mode = "engage";
        this.attacksLeft = 1;
        this.next = null;
      } else {
        // Wait for a turn on the assigned side, off the player's depth line, so the pack surrounds.
        const tx = clamp(p.x + this.side * this.archetype.hoverDistance, view.minX - 60, view.maxX + 60);
        moveToward(self, tx, p.z + this.zOffset, cmd, 16, 8);
        if (sep !== 0 && cmd.moveZ === 0) cmd.moveZ = sep * 0.6;
        return cmd;
      }
    }

    // --- engage ---
    if (!this.next) this.next = this.pickAttack(view);
    const strike = this.next;
    if (!strike) return cmd;

    // Kickers shove the player off when crowded.
    const visible = onScreen(self, view);
    if (this.archetype.pushStrike && visible && dist < 46 && this.cooldown <= 20 && withinDepth(self.z, p.z, 12) && isHittable(p)) {
      const push = view.strikes[this.archetype.pushStrike];
      if (push) {
        cmd.strike = push;
        this.cooldown = this.rollCooldown(view);
        return cmd;
      }
    }

    if (this.archetype.clinches) {
      // Walk straight in and hold forward: the grab happens on contact after a beat.
      const there = moveToward(self, attackSpot(p, currentSide, 30, view), p.z, cmd, 4, 5);
      cmd.wantClinch = visible && this.cooldown <= 0 && dist < 60;
      if (cmd.wantClinch && !there) cmd.moveX = sign(dxToPlayer);
      if (visible && dist < 44 && this.cooldown <= 0 && !p.clinchable && isHittable(p) && withinDepth(self.z, p.z, 10)) {
        cmd.strike = strike;
        this.finishAttack(view);
      }
      return cmd;
    }

    const range = Math.max(24, strike.reach - 10 - (strike.lunge ?? 0) * 0.5);
    if (this.archetype.dashes && dist > range + 90 && withinDepth(self.z, p.z, 30) && self.slow === 0) {
      cmd.dash = cmd.face as 1 | -1;
      return cmd;
    }
    const inPlace = moveToward(self, attackSpot(p, currentSide, range, view), p.z, cmd, 8, 6);
    if (sep !== 0 && cmd.moveZ === 0 && !inPlace) cmd.moveZ = sep * 0.5;
    const canReach = dist <= strike.reach - 2 + (strike.lunge ?? 0) && dist >= (strike.minReach ?? 0);
    if (visible && canReach && this.cooldown <= 0 && isHittable(p) && withinDepth(self.z, p.z, 10)) {
      cmd.strike = strike;
      cmd.moveX = 0;
      cmd.moveZ = 0;
      if (this.archetype.followUp && view.rng.chance(this.rank.followUpChance)) {
        this.followUpPending = true;
      } else {
        this.finishAttack(view);
      }
    }
    return cmd;
  }
}

/**
 * Hand out the level's attack tokens: at most `maxEngaged` grunts press the player at once, nearest first.
 * Everyone else hovers and flanks until a token frees up.
 */
export const assignTokens = (brains: readonly Brain[], fighters: readonly Fighter[], player: Fighter, maxEngaged: number): void => {
  const byId = new Map<number, Fighter>();
  for (const f of fighters) byId.set(f.id, f);
  let engaged = 0;
  for (const b of brains) {
    const f = byId.get(b.fighterId);
    if (!f || f.state === "ko") b.engaged = false;
    else if (b.engaged) engaged++;
  }
  if (engaged >= maxEngaged) return;
  const waiting = brains
    .filter((b) => !b.engaged && b.wantsToken())
    .map((b) => ({ b, f: byId.get(b.fighterId) }))
    .filter((e): e is { b: Brain; f: Fighter } => !!e.f && e.f.state !== "ko" && e.f.state !== "intro")
    .sort((a, c) => Math.abs(a.f.x - player.x) - Math.abs(c.f.x - player.x) || a.f.id - c.f.id);
  for (const e of waiting) {
    if (engaged >= maxEngaged) break;
    e.b.engaged = true;
    engaged++;
  }
};
