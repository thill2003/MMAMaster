import { withinDepth } from "@/core/depth";

import { breakClinchOf, isHittable, knockDown, knockOut, stagger } from "./fighter";
import type { CombatWorld, Fighter, HitResult, StrikeDef } from "./types";

const emitHit = (
  w: CombatWorld,
  a: Fighter,
  o: Fighter,
  s: StrikeDef,
  result: HitResult,
  damage: number,
  knockdown: boolean,
  ko: boolean,
): void => {
  w.events.push({
    type: "hit",
    attackerId: a.id,
    targetId: o.id,
    strikeId: s.id,
    limb: s.limb,
    result,
    damage,
    x: (a.x + o.x) / 2 + a.facing * 8,
    z: o.z,
    heavy: !!s.heavy || knockdown || ko,
    knockdown,
    ko,
  });
};

const applyStrike = (a: Fighter, o: Fighter, s: StrikeDef, w: CombatWorld): void => {
  const t = w.tuning;
  const facingAttacker = o.facing === -a.facing;
  const base = s.damage * a.stats.damageDealt;
  const standing = o.state === "idle" || o.state === "walk" || o.state === "guard";

  if (o.parry && facingAttacker && standing && !s.unblockable) {
    emitHit(w, a, o, s, "parry", 0, false, false);
    stagger(a, t.parryStagger, w);
    a.vx = -a.facing * 3;
    w.hitStop = Math.max(w.hitStop, t.heavyHitStop);
    return;
  }

  const guarding = (o.state === "guard" || o.state === "blockstun") && facingAttacker && !s.unblockable;
  if (guarding) {
    if (w.tick - o.guardPressedAt <= t.checkWindow) {
      emitHit(w, a, o, s, "check", 0, false, false);
      stagger(a, s.low ? t.lowCheckStagger : t.checkRecoil, w);
      a.vx = -a.facing * 2.5;
      w.hitStop = Math.max(w.hitStop, t.heavyHitStop);
      return;
    }
    const chip = Math.max(1, Math.round(base * (s.chip ?? t.chipDefault)));
    o.hp = Math.max(1, o.hp - chip);
    o.state = "blockstun";
    o.stateTick = 0;
    o.stun = t.blockStun;
    o.vx = a.facing * s.knockback * 0.35 * o.stats.knockbackTaken;
    emitHit(w, a, o, s, "block", chip, false, false);
    w.hitStop = Math.max(w.hitStop, t.hitStop);
    return;
  }

  const strikeArmor = o.state === "strike" && !!o.strike?.armor && o.stateTick < o.strike.startup + o.strike.active;
  const armored = o.armor || strikeArmor;
  const stuffed = o.armor && o.pushBreaksArmor && s.effect === "push";
  if (armored && !stuffed) {
    const damage = Math.max(1, Math.round(base * t.armorDamage));
    o.hp -= damage;
    if (o.hp <= 0) {
      emitHit(w, a, o, s, "hit", damage, true, true);
      knockOut(o, a.facing * (s.knockback * 1.4 + 4) * o.stats.knockbackTaken, w, a.id);
      w.hitStop = Math.max(w.hitStop, t.koHitStop);
    } else {
      emitHit(w, a, o, s, "armor", damage, false, false);
      w.hitStop = Math.max(w.hitStop, t.hitStop);
    }
    return;
  }

  const damage = Math.max(1, Math.round(base));
  o.hp -= damage;
  if (s.effect === "slow") o.slow = Math.max(o.slow, s.effectTicks ?? 150);
  const kb = a.facing * s.knockback * o.stats.knockbackTaken;

  if (o.hp <= 0) {
    emitHit(w, a, o, s, "hit", damage, true, true);
    knockOut(o, kb * 1.4 + a.facing * 4, w, a.id);
    w.hitStop = Math.max(w.hitStop, t.koHitStop);
    return;
  }
  o.hitChain = o.state === "hit" || o.state === "stagger" ? o.hitChain + 1 : 1;
  if (s.knockdown || o.hitChain >= t.maxHitChain) {
    emitHit(w, a, o, s, "hit", damage, true, false);
    knockDown(o, s.knockdown ? kb : a.facing * 5 * o.stats.knockbackTaken, w);
    w.hitStop = Math.max(w.hitStop, t.heavyHitStop);
    return;
  }
  emitHit(w, a, o, s, "hit", damage, false, false);
  if (stuffed || s.effect === "stun") {
    stagger(o, stuffed ? t.pushStagger : (s.effectTicks ?? 60), w);
    o.armor = false;
  } else {
    breakClinchOf(o, w, "hit");
    o.state = "hit";
    o.stateTick = 0;
    o.stun = s.hitStun;
    o.strike = null;
    o.lastStrikeId = null;
    o.clinchCharge = 0;
  }
  o.vx = kb;
  w.hitStop = Math.max(w.hitStop, s.heavy ? t.heavyHitStop : t.hitStop);
};

/** Resolve every strike that is in its active frames this tick. Call after all fighters have stepped. */
export const resolveStrikes = (w: CombatWorld): void => {
  const t = w.tuning;
  for (const a of w.fighters) {
    const s = a.strike;
    if (a.state !== "strike" || !s) continue;
    if (a.stateTick < s.startup || a.stateTick >= s.startup + s.active) continue;
    for (const o of w.fighters) {
      if (o.team === a.team || a.strikeHit.includes(o.id) || !isHittable(o)) continue;
      const dx = (o.x - a.x) * a.facing;
      if (dx < (s.minReach ?? -8) || dx > s.reach) continue;
      if (!withinDepth(a.z, o.z, t.depthTolerance)) continue;
      a.strikeHit.push(o.id);
      a.landed = true;
      applyStrike(a, o, s, w);
      if (a.state !== "strike") break; // parried or checked: the strike is over
    }
  }
};

/** A dumped fighter flies back and bowls over anyone on its own team it lands on. */
export const resolveThrown = (w: CombatWorld): void => {
  const t = w.tuning;
  for (const f of w.fighters) {
    if (!f.thrown || Math.abs(f.vx) < 1.5) continue;
    for (const o of w.fighters) {
      if (o === f || o.team !== f.team || f.thrownHit.includes(o.id) || !isHittable(o)) continue;
      if (Math.abs(o.x - f.x) > 40 || !withinDepth(f.z, o.z, t.depthTolerance * 2)) continue;
      f.thrownHit.push(o.id);
      const damage = t.throwSplashDamage;
      o.hp -= damage;
      const ko = o.hp <= 0;
      w.events.push({
        type: "hit",
        attackerId: f.id,
        targetId: o.id,
        strikeId: "thrown",
        limb: "knee",
        result: "hit",
        damage,
        x: o.x,
        z: o.z,
        heavy: true,
        knockdown: true,
        ko,
      });
      const dir = f.vx > 0 ? 1 : -1;
      if (ko) knockOut(o, dir * 6, w, null);
      else knockDown(o, dir * 5 * o.stats.knockbackTaken, w);
      w.hitStop = Math.max(w.hitStop, t.heavyHitStop);
    }
  }
};

const SOLID: ReadonlySet<string> = new Set(["idle", "walk", "guard", "strike", "blockstun", "hit", "stagger"]);

/** Keep opposing fighters from standing inside each other on the same depth line. */
export const separateBodies = (w: CombatWorld): void => {
  const t = w.tuning;
  for (const a of w.fighters) {
    if (a.team !== "player" || !SOLID.has(a.state)) continue;
    for (const o of w.fighters) {
      if (o.team === a.team || !SOLID.has(o.state)) continue;
      if (Math.abs(o.z - a.z) > t.bodyDepth) continue;
      const dx = o.x - a.x;
      const overlap = t.bodyWidth - Math.abs(dx);
      if (overlap <= 0) continue;
      const dir = dx !== 0 ? Math.sign(dx) : a.facing;
      a.x -= dir * overlap * 0.5;
      o.x += dir * overlap * 0.5;
    }
  }
};
