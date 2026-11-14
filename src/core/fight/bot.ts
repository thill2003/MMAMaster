import type { Fighter } from "@/core/combat";
import type { Action, ActionSet } from "@/core/input";

import type { FightSim } from "./sim";

/**
 * A scripted player for headless runs (MM-211): it plays a whole town through the same action map a thumb
 * uses. It reads the tells straight from the simulation, so it is a test tool, not a difficulty benchmark.
 */
export class BotPlayer {
  private tapPhase = 0;
  private limbCycle = 0;
  private dodgeDir: -1 | 1 = 1;

  next(sim: FightSim): ActionSet {
    const held: Partial<Record<Action, boolean>> = {};
    const p = sim.player;
    const enemies = sim.world.fighters.filter((f) => f.team === "enemy" && f.state !== "ko" && f.state !== "intro");
    this.tapPhase = (this.tapPhase + 1) % 6;
    const tap = this.tapPhase < 2;

    if (p.hp < p.stats.maxHp * 0.45 && sim.items > 0 && this.tapPhase === 0) held.ITEM = true;

    if (p.state === "clinched") {
      if (tap) held[this.tapPhase === 0 ? "PUNCH" : "KICK"] = true;
      if (this.tapPhase === 3) held.ELBOW = true;
      return held;
    }
    if (p.state === "clinch") {
      if (tap) held.KNEE = true;
      return held;
    }

    if (enemies.length === 0) {
      held.MOVE_RIGHT = true;
      return held;
    }

    let target: Fighter = enemies[0];
    for (const e of enemies) {
      if (Math.abs(e.x - p.x) + Math.abs(e.z - p.z) * 2 < Math.abs(target.x - p.x) + Math.abs(target.z - p.z) * 2) target = e;
    }
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const dist = Math.abs(dx);
    const toward: Action = dx >= 0 ? "MOVE_RIGHT" : "MOVE_LEFT";
    const away: Action = dx >= 0 ? "MOVE_LEFT" : "MOVE_RIGHT";

    // A flying knee is coming: get off the line.
    const rusher = enemies.find((e) => e.telegraph || (e.state === "strike" && !!e.strike?.travel));
    if (rusher && Math.abs(rusher.z - p.z) < 34) {
      if (p.z < 30) this.dodgeDir = 1;
      else if (p.z > sim.world.band.max - 30) this.dodgeDir = -1;
      held[this.dodgeDir === 1 ? "MOVE_DOWN" : "MOVE_UP"] = true;
      return held;
    }

    // Guard a strike about to land; pressing late turns most of them into checks.
    const threat = enemies.find((e) => {
      if (e.state !== "strike" || !e.strike) return false;
      const s = e.strike;
      const reachNow = s.reach + (s.lunge ?? 0) + 24;
      return (
        (p.x - e.x) * e.facing > 0 &&
        Math.abs(p.x - e.x) < reachNow &&
        Math.abs(e.z - p.z) < 24 &&
        e.stateTick >= s.startup - 5 &&
        e.stateTick < s.startup + s.active
      );
    });
    if (threat && p.state !== "strike") {
      held.GUARD = true;
      return held;
    }

    const open = target.state === "stagger" || target.tired || target.state === "hit";
    // Waiting counter-striker: stay just outside and let him come.
    if (target.parry && !open) {
      if (dist < 90) held[away] = true;
      else if (dist > 130) held[toward] = true;
      if (Math.abs(dz) > 6) held[dz > 0 ? "MOVE_DOWN" : "MOVE_UP"] = true;
      return held;
    }
    // Charging clincher: teep him off.
    if (target.armor && target.pushBreaksArmor) {
      if (Math.abs(dz) > 8) held[dz > 0 ? "MOVE_DOWN" : "MOVE_UP"] = true;
      held[toward] = true;
      if (dist < 82 && tap) held.KICK = true;
      return held;
    }

    if (Math.abs(dz) > 7) held[dz > 0 ? "MOVE_DOWN" : "MOVE_UP"] = true;
    const shell = target.isBoss && target.state === "guard";
    if (dist > 46) {
      held[toward] = true;
    } else if (shell && target.clinchable) {
      held[toward] = true; // walk into the guard: clinch
      return held;
    }
    if (dist <= 54 && Math.abs(dz) <= 12) {
      if (tap) {
        // Mostly punches, with a kick or knee mixed in to end strings.
        const pick = this.limbCycle % 7;
        held[pick === 5 ? "KICK" : pick === 6 ? "KNEE" : "PUNCH"] = true;
        if (this.tapPhase === 1) this.limbCycle++;
      }
    }
    return held;
  }
}
