import { describe, expect, it } from "vitest";

import { Rng } from "@/shared/rng";

import { buildSchedule, Gauntlet, type LevelDef, LevelClock } from "./gauntlet";

const level: LevelDef = {
  id: "test",
  index: 0,
  name: "Test",
  gym: "Test Gym",
  length: 3000,
  clockSeconds: 100,
  segments: [
    { from: 0, to: 0.5, spacing: 200, mix: { brawler: 1 }, ranks: [1] },
    { from: 0.5, to: 1, spacing: 150, mix: { brawler: 1, kicker: 1 }, ranks: [1, 2, 1] },
  ],
  holds: [{ at: 0.8, pack: [{ kind: "brawler", rank: 2 }] }],
  maxAlive: [2, 4],
  maxEngaged: [1, 3],
  behindChance: 0.2,
  dropEvery: 4,
  seed: 7,
  leader: {
    id: "l",
    name: "Leader",
    title: "",
    kind: "leader",
    hp: 100,
    damage: 1,
    walkSpeed: 1.5,
    knockbackTaken: 1,
    clinchable: true,
    clinchKneeCap: 1,
    boss: { style: "brawler", strikes: {}, guardChance: 0, cooldown: [60, 90] },
  },
};

describe("buildSchedule", () => {
  it("is the same every run for the same seed, and different for another", () => {
    const a = buildSchedule(level, new Rng(7));
    const b = buildSchedule(level, new Rng(7));
    const c = buildSchedule(level, new Rng(8));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("spawns in order of scroll distance, denser late, white belts only early", () => {
    const s = buildSchedule(level, new Rng(7));
    for (let i = 1; i < s.length; i++) expect(s[i].atX).toBeGreaterThan(s[i - 1].atX);
    const early = s.filter((e) => e.atX < 1500);
    const late = s.filter((e) => e.atX >= 1500);
    expect(early.every((e) => e.rank === 0 && e.kind === "brawler")).toBe(true);
    expect(late.length).toBeGreaterThan(early.length);
    expect(late.some((e) => e.rank > 0)).toBe(true);
  });

  it("leaves room before a hold and marks every Nth spawn as a drop", () => {
    const s = buildSchedule(level, new Rng(7));
    const holdX = 0.8 * level.length;
    expect(s.some((e) => e.atX > holdX - 170 && e.atX < holdX + 40)).toBe(false);
    expect(s.filter((e) => e.drop).length).toBe(Math.floor(s.length / 4));
  });

  it("a higher density setting packs in more enemies", () => {
    expect(buildSchedule(level, new Rng(7), 1.3).length).toBeGreaterThan(buildSchedule(level, new Rng(7), 1).length);
  });
});

describe("Gauntlet", () => {
  it("releases spawns by scroll distance, never above the alive cap", () => {
    const g = new Gauntlet(level, buildSchedule(level, new Rng(7)));
    expect(g.update(100, 0).spawns.length).toBe(0);
    const first = g.update(1200, 0);
    expect(first.spawns.length).toBe(g.maxAlive(1200));
    expect(g.update(1200, g.maxAlive(1200)).spawns.length).toBe(0);
    expect(g.update(1200, 0).spawns.length).toBeGreaterThan(0);
  });

  it("the cap and the number of attackers grow along the level", () => {
    const g = new Gauntlet(level, []);
    expect(g.maxAlive(0)).toBe(2);
    expect(g.maxAlive(3000)).toBe(4);
    expect(g.maxEngaged(0)).toBe(1);
    expect(g.maxEngaged(3000)).toBe(3);
  });

  it("a hold stops the stream until it is cleared, then the leader is called at the end", () => {
    const g = new Gauntlet(level, buildSchedule(level, new Rng(7)));
    let alive = 0;
    let held = false;
    for (let x = 0; x <= 2400; x += 20) {
      const up = g.update(x, alive);
      if (up.holdStarted) held = true;
    }
    expect(held).toBe(true);
    expect(g.activeHoldX).toBe(2400);
    expect(g.update(3000, 0)).toEqual({ spawns: [], holdStarted: null, leaderReady: false });
    g.holdCleared();
    let ready = false;
    for (let i = 0; i < 50 && !ready; i++) {
      alive = 0;
      ready = g.update(3000, alive).leaderReady;
    }
    expect(ready).toBe(true);
    expect(g.spawned).toBe(g.totalSpawns);
  });
});

describe("LevelClock", () => {
  it("counts down in ticks and reports the tick it runs out", () => {
    const c = new LevelClock(2);
    expect(c.seconds).toBe(2);
    let expiredAt = -1;
    for (let i = 1; i <= 130; i++) if (c.tick()) expiredAt = i;
    expect(expiredAt).toBe(120);
    expect(c.fraction).toBe(0);
    expect(c.tick()).toBe(false);
  });
});
