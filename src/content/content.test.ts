import { describe, expect, it } from "vitest";

import { BotPlayer, FightSim, type FightResult } from "@/core/fight";
import { InputInterpreter } from "@/core/input";

import { buildFightConfig } from "./fightConfig";
import { ARCHETYPES, INPUT_TUNING } from "./fighters/tuning";
import { ENEMY_STRIKES } from "./moves/enemies";
import { PLAYER_MOVES } from "./moves/player";
import { ST_LOUIS, TOWN_ORDER, townById } from "./towns/stLouis";

const VIEW = 960;

/** Play a town start to finish with the scripted bot. Returns the result and a per-tick state hash. */
const runTown = (id: string, opts: { invincible?: boolean; maxTicks?: number } = {}): { result: FightResult; hash: number } => {
  const town = townById(id)!;
  const sim = new FightSim(buildFightConfig(town, "normal", VIEW, { invincible: opts.invincible }));
  const bot = new BotPlayer();
  const interp = new InputInterpreter(INPUT_TUNING);
  let hash = 0;
  const max = opts.maxTicks ?? 60 * 60 * 12;
  for (let i = 0; i < max && !sim.finished; i++) {
    sim.step(interp.step(bot.next(sim)));
    hash = (Math.imul(hash, 31) + Math.round(sim.player.x * 10) + sim.player.hp * 7 + sim.score) | 0;
  }
  return { result: sim.result(), hash };
};

describe("content integrity", () => {
  it("every opener and link points at a real strike", () => {
    const ids = new Set(Object.keys(PLAYER_MOVES.strikes));
    for (const id of Object.values(PLAYER_MOVES.openers)) expect(ids.has(id), id).toBe(true);
    for (const [from, links] of Object.entries(PLAYER_MOVES.links)) {
      expect(ids.has(from), from).toBe(true);
      for (const id of Object.values(links)) expect(ids.has(id), id).toBe(true);
    }
  });

  it("every archetype attack and boss role points at a real enemy strike", () => {
    for (const a of Object.values(ARCHETYPES)) {
      for (const atk of a.attacks) expect(ENEMY_STRIKES[atk.strike], atk.strike).toBeDefined();
      if (a.followUp) expect(ENEMY_STRIKES[a.followUp]).toBeDefined();
      if (a.pushStrike) expect(ENEMY_STRIKES[a.pushStrike]).toBeDefined();
    }
    for (const t of ST_LOUIS) {
      for (const id of Object.values(t.leader.boss.strikes)) expect(ENEMY_STRIKES[id], `${t.id}:${id}`).toBeDefined();
    }
  });

  it("towns are in order, unique, and only use known archetypes", () => {
    expect(new Set(TOWN_ORDER).size).toBe(ST_LOUIS.length);
    ST_LOUIS.forEach((t, i) => {
      expect(t.index).toBe(i);
      for (const s of t.segments) for (const k of Object.keys(s.mix)) expect(ARCHETYPES[k], `${t.id}:${k}`).toBeDefined();
      for (const h of t.holds) for (const m of h.pack) expect(ARCHETYPES[m.kind]).toBeDefined();
    });
    expect(ST_LOUIS[ST_LOUIS.length - 1].isChampion).toBe(true);
  });

  it("every gym's interior is its own mat and wall pair (MM-161)", () => {
    const pairs = ST_LOUIS.map((t) => `${t.theme.interior.mat}/${t.theme.interior.wall}`);
    expect(new Set(pairs).size).toBe(ST_LOUIS.length);
    for (const t of ST_LOUIS) expect(t.theme.interior.matColor, t.id).not.toBe(t.theme.interior.wallColor);
  });

  it("the tap strings on Punch are five long and true combos (each hit lands before hit-stun ends)", () => {
    const chain = ["jab", "cross", "hook_l", "hook_r", "uppercut"];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = PLAYER_MOVES.strikes[chain[i]];
      const b = PLAYER_MOVES.strikes[chain[i + 1]];
      expect(PLAYER_MOVES.links[a.id]["punch.tap.neutral"]).toBe(b.id);
      // Cancel opens at cancelAt; the next strike lands `startup` later; the target was stunned at a.startup.
      const landsAfterHit = (a.cancelAt ?? a.startup + a.active) - a.startup + b.startup + 1;
      expect(landsAfterHit, `${a.id}→${b.id}`).toBeLessThanOrEqual(a.hitStun);
    }
  });
});

describe("headless level simulation (MM-211)", () => {
  it("the bot clears Fenton on Normal with the clock to spare", () => {
    const { result } = runTown("fenton");
    expect(result.outcome).toBe("won");
    expect(result.clockFraction).toBeGreaterThan(0.25);
    expect(result.kos).toBeGreaterThan(8);
  });

  it("the same inputs replay to the same fight, tick for tick (MM-210)", () => {
    const a = runTown("fenton");
    const b = runTown("fenton");
    expect(a.hash).toBe(b.hash);
    expect(a.result).toEqual(b.result);
  });

  it.each(TOWN_ORDER)("%s runs end to end without a soft-lock", (id) => {
    const { result } = runTown(id, { invincible: true, maxTicks: 60 * 60 * 20 });
    expect(["won", "timeout"]).toContain(result.outcome);
  });
});
