import { describe, expect, it } from "vitest";

import { blankCommand, createFighter, type ClinchMoves, type Fighter, type StrikeDef } from "@/core/combat";
import { DEFAULT_BAND } from "@/core/depth";
import { Rng } from "@/shared/rng";

import { BossBrain } from "./boss";
import { assignTokens, GruntBrain } from "./grunt";
import type { AiEvent, AiView, ArchetypeDef, BossDef, RankDef } from "./types";

const strike = (id: string, o: Partial<StrikeDef> = {}): StrikeDef => ({
  id,
  name: id,
  limb: "punch",
  startup: 12,
  active: 3,
  recovery: 16,
  damage: 5,
  reach: 50,
  hitStun: 12,
  knockback: 1,
  pose: id,
  ...o,
});
const strikes: Record<string, StrikeDef> = {
  g_jab: strike("g_jab"),
  b_low: strike("b_low", { limb: "kick", reach: 80, low: true }),
  b_lunge: strike("b_lunge", { reach: 58, lunge: 70 }),
  b_counter: strike("b_counter", { startup: 5 }),
  b_knee: strike("b_knee", { limb: "knee", travel: 10, active: 20 }),
};
const clinch: ClinchMoves = { knee: strike("k"), elbow: strike("e"), dump: strike("d") };
const stats = { maxHp: 100, walkSpeed: 2, depthSpeed: 1.2, dashSpeed: 7, dashTicks: 10, knockbackTaken: 1, damageDealt: 1 };
const fighter = (id: number, team: "player" | "enemy", x: number, z = 60): Fighter =>
  createFighter({ id, team, kind: "k", x, z, stats: { ...stats }, clinchMoves: clinch });

const arch: ArchetypeDef = {
  id: "brawler",
  attacks: [{ strike: "g_jab", weight: 1 }],
  cooldown: [60, 60],
  guardChance: 0,
  hoverDistance: 170,
};
const white: RankDef = { name: "White", hp: 1, damage: 1, speed: 1, cooldown: 1, guard: 0, followUpChance: 0 };

const view = (player: Fighter, fighters: Fighter[], emitted: AiEvent[] = [], tick = 100): AiView => ({
  tick,
  player,
  fighters,
  strikes,
  rng: new Rng(3),
  band: DEFAULT_BAND,
  minX: 0,
  maxX: 960,
  events: [],
  emit: (e) => emitted.push(e),
});

describe("attack tokens", () => {
  it("at most maxEngaged grunts press at once — nearest first — and a KO frees the token", () => {
    const p = fighter(1, "player", 400);
    const es = [fighter(2, "enemy", 700), fighter(3, "enemy", 460), fighter(4, "enemy", 560)];
    const brains = es.map((e) => new GruntBrain(e.id, arch, white, 1, 40, 0));
    assignTokens(brains, [p, ...es], p, 2);
    expect(brains.map((b) => b.engaged)).toEqual([false, true, true]);
    es[1].state = "ko";
    assignTokens(brains, [p, ...es], p, 2);
    expect(brains.map((b) => b.engaged)).toEqual([true, false, true]);
  });
});

describe("GruntBrain", () => {
  it("without a token it hovers off the player's depth line instead of attacking", () => {
    const p = fighter(1, "player", 400, 60);
    const e = fighter(2, "enemy", 440, 60);
    const b = new GruntBrain(e.id, arch, white, 1, 40, 0);
    const cmd = b.think(e, view(p, [p, e]));
    expect(cmd.strike).toBeNull();
    expect(cmd.moveX).toBe(1);
    expect(cmd.moveZ).toBe(1);
  });

  it("with a token it walks into range and throws", () => {
    const p = fighter(1, "player", 400, 60);
    const e = fighter(2, "enemy", 440, 60);
    const b = new GruntBrain(e.id, arch, white, 1, 40, 0);
    b.engaged = true;
    const v = view(p, [p, e]);
    let thrown: StrikeDef | null = null;
    for (let i = 0; i < 5 && !thrown; i++) thrown = b.think(e, v).strike;
    expect(thrown?.id).toBe("g_jab");
    expect(b.engaged).toBe(false); // one attack, then it gives the token back and rests
  });

  it("never swings from off the screen", () => {
    const p = fighter(1, "player", 930, 60);
    const e = fighter(2, "enemy", 1010, 60);
    const b = new GruntBrain(e.id, arch, white, 1, 40, 0);
    b.engaged = true;
    const cmd = b.think(e, view(p, [p, e]));
    expect(cmd.strike).toBeNull();
    expect(cmd.moveX).toBe(-1);
  });

  it("a high-guard grunt covers up when the player swings at it", () => {
    const p = fighter(1, "player", 400, 60);
    const e = fighter(2, "enemy", 450, 60);
    e.facing = -1;
    p.state = "strike";
    p.stateTick = 0;
    const b = new GruntBrain(e.id, { ...arch, guardChance: 1 }, white, 1, 40, 50);
    expect(b.think(e, view(p, [p, e])).guard).toBe(true);
  });
});

describe("BossBrain", () => {
  const def = (style: BossDef["style"], roles: Record<string, string>, extra: Partial<BossDef> = {}): BossDef => ({
    style,
    strikes: roles,
    guardChance: 0,
    cooldown: [60, 60],
    ...extra,
  });

  it("the counter-striker parries while he waits and drops the parry to lunge", () => {
    const p = fighter(1, "player", 400);
    const boss = fighter(2, "enemy", 500);
    const b = new BossBrain(boss.id, def("counterStriker", { lunge: "b_lunge", counter: "b_counter" }));
    b.think(boss, view(p, [p, boss]));
    expect(boss.parry).toBe(true);
    b.cd = 0;
    const cmd = b.think(boss, view(p, [p, boss]));
    expect(cmd.strike?.id).toBe("b_lunge");
    expect(boss.parry).toBe(false);
  });

  it("the clincher is armored on the charge and a push is flagged as the answer", () => {
    const p = fighter(1, "player", 400);
    const boss = fighter(2, "enemy", 600);
    const b = new BossBrain(boss.id, def("clincher", {}));
    b.cd = 0;
    const cmd = b.think(boss, view(p, [p, boss]));
    expect(boss.armor).toBe(true);
    expect(boss.pushBreaksArmor).toBe(true);
    expect(cmd.moveX).toBe(-1);
  });

  it("the low kicker keeps his range and kicks on cooldown", () => {
    const p = fighter(1, "player", 400);
    const boss = fighter(2, "enemy", 470);
    const b = new BossBrain(boss.id, def("lowKicker", { low: "b_low" }));
    b.cd = 0;
    expect(b.think(boss, view(p, [p, boss])).strike?.id).toBe("b_low");
    boss.x = 430; // crowded: he backs off instead
    const cmd = b.think(boss, view(p, [p, boss]));
    expect(cmd.strike).toBeNull();
    expect(cmd.moveX).toBe(1);
  });

  it("the knee rusher telegraphs before he launches", () => {
    const p = fighter(1, "player", 300);
    const boss = fighter(2, "enemy", 700);
    const b = new BossBrain(boss.id, def("kneeRusher", { flyknee: "b_knee" }));
    b.cd = 0;
    const v = view(p, [p, boss]);
    b.think(boss, v);
    let coiled = 0;
    let launched = false;
    for (let i = 0; i < 60 && !launched; i++) {
      const cmd = b.think(boss, v);
      if (boss.telegraph) coiled++;
      launched = cmd.strike?.id === "b_knee";
    }
    expect(coiled).toBeGreaterThan(20);
    expect(launched).toBe(true);
  });

  it("the champion changes style by health and announces each phase", () => {
    const p = fighter(1, "player", 300);
    const boss = fighter(2, "enemy", 700);
    const emitted: AiEvent[] = [];
    const b = new BossBrain(
      boss.id,
      def(
        "lowKicker",
        { low: "b_low", flyknee: "b_knee" },
        {
          phases: [
            { below: 1, styles: ["lowKicker"], swapTicks: 600 },
            { below: 0.5, styles: ["kneeRusher"], swapTicks: 600 },
          ],
        },
      ),
    );
    b.think(boss, view(p, [p, boss], emitted));
    expect(b.style).toBe("lowKicker");
    boss.hp = 40;
    b.think(boss, view(p, [p, boss], emitted));
    expect(b.style).toBe("kneeRusher");
    expect(emitted).toEqual([{ type: "bossPhase", fighterId: 2, phase: 1 }]);
    expect(boss.invuln).toBeGreaterThan(0);
  });

  it("does nothing during its walk-on", () => {
    const p = fighter(1, "player", 300);
    const boss = fighter(2, "enemy", 700);
    boss.state = "intro";
    const b = new BossBrain(boss.id, def("brawler", {}));
    expect(b.think(boss, view(p, [p, boss]))).toEqual(blankCommand());
  });
});
