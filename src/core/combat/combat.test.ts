import { describe, expect, it } from "vitest";

import { DEFAULT_BAND } from "@/core/depth";
import { type InputFrame, EMPTY_FRAME } from "@/core/input";

import { PlayerController, resolveStrike } from "./controller";
import { createFighter, startStrike, stepFighter, strikeGate } from "./fighter";
import { resolveStrikes, resolveThrown, separateBodies } from "./strikes";
import {
  blankCommand,
  type ClinchMoves,
  type Command,
  type CombatTuning,
  type CombatWorld,
  type Fighter,
  type FighterStats,
  type MoveSet,
  type StrikeDef,
} from "./types";

// A small fixture move set — core tests don't import content.
const S = (o: Partial<StrikeDef> & { id: string; limb: StrikeDef["limb"] }): StrikeDef => ({
  name: o.id,
  startup: 4,
  active: 3,
  recovery: 10,
  damage: 5,
  reach: 50,
  hitStun: 18,
  knockback: 1,
  pose: o.id,
  cancelAt: 6,
  ...o,
});

const strikes: Record<string, StrikeDef> = {
  jab: S({ id: "jab", limb: "punch" }),
  cross: S({ id: "cross", limb: "punch", damage: 6, lunge: 8 }),
  finish: S({ id: "finish", limb: "punch", damage: 12, knockdown: true, lunge: 8 }),
  overhand: S({ id: "overhand", limb: "punch", startup: 10 }),
  body: S({ id: "body", limb: "punch" }),
  round: S({ id: "round", limb: "kick", reach: 70, startup: 8 }),
  teep: S({ id: "teep", limb: "kick", reach: 76, knockback: 9, effect: "push" }),
  low: S({ id: "low", limb: "kick", reach: 64, low: true, effect: "slow", effectTicks: 120 }),
  fly: S({ id: "fly", limb: "kick", reach: 70, lunge: 30, knockdown: true }),
  elbow: S({ id: "elbow", limb: "elbow", reach: 40, chip: 0.5, damage: 10 }),
};

const clinch: ClinchMoves = {
  knee: S({ id: "c_knee", limb: "knee", startup: 6, recovery: 8, damage: 8 }),
  elbow: S({ id: "c_elbow", limb: "elbow", startup: 6, recovery: 8, damage: 9, effect: "stun", effectTicks: 60 }),
  dump: S({ id: "c_dump", limb: "knee", startup: 6, recovery: 8, damage: 7 }),
};

const moves: MoveSet = {
  strikes,
  clinch,
  maxString: 6,
  openers: {
    "punch.tap.neutral": "jab",
    "punch.hold.neutral": "overhand",
    "kick.tap.neutral": "round",
    "kick.tap.forward": "teep",
    "kick.tap.back": "low",
    "kick.tap.dash": "fly",
    "elbow.tap.neutral": "elbow",
  },
  links: {
    jab: { "punch.tap.neutral": "cross", "punch.hold.neutral": "finish" },
    cross: { "punch.tap.neutral": "finish", "punch.hold.neutral": "finish" },
    overhand: { "punch.tap.neutral": "body" },
    body: { "punch.tap.neutral": "finish" },
  },
};

const tuning: CombatTuning = {
  depthTolerance: 16,
  friction: 0.84,
  hitStop: 0,
  heavyHitStop: 0,
  koHitStop: 0,
  chipDefault: 0.2,
  blockStun: 10,
  checkWindow: 8,
  checkRecoil: 24,
  lowCheckStagger: 80,
  parryStagger: 40,
  knockdownFall: 20,
  knockdownDown: 30,
  getUp: 20,
  getUpInvuln: 30,
  koTicks: 60,
  linkGrace: 16,
  backpedal: 0.7,
  slowFactor: 0.5,
  armorDamage: 0.5,
  lockOnRange: 220,
  lockOnDepth: 60,
  clinchBeat: 10,
  clinchRange: 42,
  clinchDepth: 14,
  clinchHold: 34,
  clinchTimeout: 150,
  clinchEscapeMash: 5,
  throwSpeed: 15,
  throwSplashDamage: 10,
  pushStagger: 70,
  maxHitChain: 7,
  bodyWidth: 28,
  bodyDepth: 12,
};

const stats = (hp = 100): FighterStats => ({
  maxHp: hp,
  walkSpeed: 2.5,
  depthSpeed: 1.5,
  dashSpeed: 7,
  dashTicks: 12,
  knockbackTaken: 1,
  damageDealt: 1,
});

const setup = (enemyHp = 100, gap = 40) => {
  const player = createFighter({ id: 1, team: "player", kind: "player", x: 100, z: 60, stats: stats(), clinchMoves: clinch });
  const enemy = createFighter({
    id: 2,
    team: "enemy",
    kind: "grunt",
    x: 100 + gap,
    z: 60,
    facing: -1,
    stats: stats(enemyHp),
    clinchMoves: clinch,
  });
  const w: CombatWorld = { tick: 0, tuning, band: DEFAULT_BAND, fighters: [player, enemy], events: [], hitStop: 0 };
  return { w, player, enemy };
};

/** Advance the world; `orders` gives commands per fighter id for this tick. */
const tick = (w: CombatWorld, orders: Record<number, Partial<Command>> = {}): void => {
  w.tick++;
  w.events = [];
  for (const f of w.fighters) stepFighter(f, { ...blankCommand(), ...(orders[f.id] ?? {}) }, w);
  separateBodies(w);
  resolveStrikes(w);
  resolveThrown(w);
};

const run = (w: CombatWorld, n: number, orders: Record<number, Partial<Command>> = {}): void => {
  for (let i = 0; i < n; i++) tick(w, orders);
};

describe("strikes", () => {
  it("lands in reach and on the depth line, with damage and hit-stun", () => {
    const { w, player, enemy } = setup();
    tick(w, { 1: { strike: strikes.jab } });
    run(w, 4);
    expect(enemy.hp).toBe(95);
    expect(enemy.state).toBe("hit");
    expect(player.landed).toBe(true);
  });

  it("misses a target off the depth line", () => {
    const { w, enemy } = setup();
    enemy.z = 100;
    tick(w, { 1: { strike: strikes.jab } });
    run(w, 10);
    expect(enemy.hp).toBe(100);
  });

  it("knockdown strikes floor the target, who gets up invulnerable", () => {
    const { w, enemy } = setup();
    tick(w, { 1: { strike: strikes.finish } });
    run(w, 5);
    expect(enemy.state).toBe("knockdown");
    run(w, tuning.knockdownFall + tuning.knockdownDown + 1);
    expect(enemy.state).toBe("getup");
    expect(enemy.invuln).toBeGreaterThan(0);
  });

  it("a hit that empties the health bar is a KO and the body is removed", () => {
    const { w, enemy } = setup(4);
    tick(w, { 1: { strike: strikes.jab } });
    run(w, 5);
    expect(enemy.state).toBe("ko");
    run(w, tuning.koTicks + 1);
    expect(enemy.remove).toBe(true);
  });

  it("caps an unbroken string: the hit at the cap knocks down", () => {
    const { w, player, enemy } = setup(500);
    for (let i = 0; i < tuning.maxHitChain; i++) {
      player.state = "idle";
      player.x = enemy.x - 40;
      tick(w, { 1: { strike: strikes.jab } });
      run(w, 5);
    }
    expect(enemy.state).toBe("knockdown");
  });
});

describe("guard and check", () => {
  it("a held guard takes chip damage and no knockdown; elbows chip hardest", () => {
    const a = setup();
    run(a.w, 20, { 2: { guard: true } });
    tick(a.w, { 1: { strike: strikes.jab }, 2: { guard: true } });
    run(a.w, 5, { 2: { guard: true } });
    expect(a.enemy.hp).toBe(99);

    const b = setup();
    run(b.w, 20, { 2: { guard: true } });
    tick(b.w, { 1: { strike: strikes.elbow }, 2: { guard: true } });
    run(b.w, 5, { 2: { guard: true } });
    expect(b.enemy.hp).toBe(95);
  });

  it("guard only works facing the attacker", () => {
    const { w, enemy } = setup();
    enemy.facing = 1; // back turned
    run(w, 3, { 2: { guard: true, face: 1 } });
    tick(w, { 1: { strike: strikes.jab }, 2: { guard: true, face: 1 } });
    run(w, 5, { 2: { guard: true, face: 1 } });
    expect(enemy.hp).toBe(95);
  });

  it("tapping guard as the strike lands is a check: no damage and the attacker recoils", () => {
    const { w, player, enemy } = setup();
    // The enemy throws; the player presses guard two ticks before impact.
    tick(w, { 2: { strike: strikes.jab } });
    run(w, 1);
    tick(w, { 1: { guard: true, guardPressed: true } });
    run(w, 3, { 1: { guard: true } });
    expect(player.hp).toBe(100);
    expect(enemy.state).toBe("stagger");
    expect(enemy.stun).toBe(tuning.checkRecoil);
  });

  it("checking a low kick staggers the kicker for much longer", () => {
    const { w, enemy } = setup();
    tick(w, { 2: { strike: strikes.low } });
    run(w, 1);
    tick(w, { 1: { guard: true, guardPressed: true } });
    run(w, 3, { 1: { guard: true } });
    expect(enemy.state).toBe("stagger");
    expect(enemy.stun).toBe(tuning.lowCheckStagger);
  });

  it("an unchecked low kick slows the target", () => {
    const { w, player } = setup();
    tick(w, { 2: { strike: strikes.low } });
    run(w, 6);
    expect(player.slow).toBeGreaterThan(0);
  });
});

describe("boss traits", () => {
  it("a parrying fighter turns the strike back on the attacker", () => {
    const { w, player, enemy } = setup();
    enemy.parry = true;
    tick(w, { 1: { strike: strikes.jab } });
    run(w, 5);
    expect(enemy.hp).toBe(100);
    expect(player.state).toBe("stagger");
  });

  it("armor halves damage and ignores stun — unless a push is the answer", () => {
    const a = setup();
    a.enemy.armor = true;
    tick(a.w, { 1: { strike: strikes.cross } });
    run(a.w, 5);
    expect(a.enemy.hp).toBe(97);
    expect(a.enemy.state).not.toBe("hit");

    const b = setup(100, 60);
    b.enemy.armor = true;
    b.enemy.pushBreaksArmor = true;
    tick(b.w, { 1: { strike: strikes.teep } });
    run(b.w, 5);
    expect(b.enemy.state).toBe("stagger");
    expect(b.enemy.stun).toBe(tuning.pushStagger);
  });
});

describe("strings", () => {
  const f = (last: string | null, len = last ? 1 : 0): Fighter => {
    const fighter = createFighter({ id: 1, team: "player", kind: "p", x: 0, z: 0, stats: stats(), clinchMoves: clinch });
    fighter.lastStrikeId = last;
    fighter.stringLen = len;
    return fighter;
  };

  it("tap-tap-tap, tap-tap-hold and hold-tap-tap are three different strings on one button", () => {
    const ttt = [
      resolveStrike(moves, f(null), "open", "punch", "tap", "neutral")?.def.id,
      resolveStrike(moves, f("jab"), "link", "punch", "tap", "neutral")?.def.id,
      resolveStrike(moves, f("cross", 2), "link", "punch", "tap", "neutral")?.def.id,
    ];
    const tth = [
      resolveStrike(moves, f(null), "open", "punch", "tap", "neutral")?.def.id,
      resolveStrike(moves, f("jab"), "link", "punch", "tap", "neutral")?.def.id,
      resolveStrike(moves, f("cross", 2), "link", "punch", "hold", "neutral")?.def.id,
    ];
    const htt = [
      resolveStrike(moves, f(null), "open", "punch", "hold", "neutral")?.def.id,
      resolveStrike(moves, f("overhand"), "link", "punch", "tap", "neutral")?.def.id,
      resolveStrike(moves, f("body", 2), "link", "punch", "tap", "neutral")?.def.id,
    ];
    expect(ttt).toEqual(["jab", "cross", "finish"]);
    expect(tth).toEqual(["jab", "cross", "finish"]);
    expect(htt).toEqual(["overhand", "body", "finish"]);
    expect(tth[2]).toBe("finish");
    expect(htt[0]).not.toBe(ttt[0]);
  });

  it("a different limb cancels into that limb's opener (jab-cross-roundhouse)", () => {
    const pick = resolveStrike(moves, f("cross", 2), "link", "kick", "tap", "neutral");
    expect(pick?.def.id).toBe("round");
    expect(pick?.continues).toBe(true);
  });

  it("direction picks the variant: forward teep, back low kick, dash flying kick", () => {
    expect(resolveStrike(moves, f(null), "open", "kick", "tap", "forward")?.def.id).toBe("teep");
    expect(resolveStrike(moves, f(null), "open", "kick", "tap", "back")?.def.id).toBe("low");
    expect(resolveStrike(moves, f(null), "open", "kick", "tap", "dash")?.def.id).toBe("fly");
    // jab-cross-hook-low kick: the back + Kick opener is reachable mid-string.
    expect(resolveStrike(moves, f("cross", 2), "link", "kick", "tap", "back")?.def.id).toBe("low");
  });

  it("the same limb with no link ends the string, and the string has a maximum length", () => {
    expect(resolveStrike(moves, f("finish", 3), "link", "punch", "tap", "neutral")).toBeNull();
    expect(resolveStrike(moves, f("jab", moves.maxString), "link", "kick", "tap", "neutral")).toBeNull();
    // Once recovered, the same press opens a new string.
    expect(resolveStrike(moves, f("finish", 3), "grace", "punch", "tap", "neutral")?.continues).toBe(false);
  });

  it("the cancel window only opens once the hit has landed", () => {
    const { w, player } = setup();
    startStrike(player, strikes.jab, false, w);
    player.stateTick = 8;
    expect(strikeGate(player, 0, tuning)).toBe("closed");
    player.landed = true;
    expect(strikeGate(player, 0, tuning)).toBe("link");
  });

  it("the controller plays a real jab-cross-finish off three buffered taps", () => {
    const { w, player, enemy } = setup(200, 44);
    const ctl = new PlayerController(moves, 6);
    const tap: InputFrame = { ...EMPTY_FRAME, strikes: [{ limb: "punch", press: "tap", moveX: 0 }] };
    const thrown: string[] = [];
    for (let i = 0; i < 60; i++) {
      w.tick++;
      w.events = [];
      ctl.feed(i % 5 === 0 ? tap : EMPTY_FRAME, w.tick);
      const cmd = ctl.command(player, w);
      if (cmd.strike) thrown.push(cmd.strike.id);
      stepFighter(player, cmd, w);
      stepFighter(enemy, blankCommand(), w);
      resolveStrikes(w);
      if (enemy.state === "knockdown") break;
    }
    expect(thrown.slice(0, 3)).toEqual(["jab", "cross", "finish"]);
    expect(enemy.state).toBe("knockdown");
  });
});

describe("clinch", () => {
  const grab = () => {
    const s = setup(100, 36);
    run(s.w, tuning.clinchBeat + 1, { 1: { moveX: 1, wantClinch: true, face: 1 } });
    return s;
  };

  it("walking into an enemy and holding forward for a beat grabs them", () => {
    const { player, enemy } = grab();
    expect(player.state).toBe("clinch");
    expect(enemy.state).toBe("clinched");
    expect(enemy.clinchWith).toBe(player.id);
  });

  it("three knees, then the clinch breaks", () => {
    const { w, player, enemy } = grab();
    for (let i = 0; i < 3; i++) {
      tick(w, { 1: { clinchAction: "knee" } });
      run(w, 16);
    }
    expect(enemy.hp).toBe(100 - 24);
    expect(player.state).not.toBe("clinch");
    expect(enemy.state).not.toBe("clinched");
  });

  it("the elbow breaks the clinch with a stun", () => {
    const { w, enemy } = grab();
    tick(w, { 1: { clinchAction: "elbow" } });
    run(w, 7);
    expect(enemy.state).toBe("stagger");
  });

  it("the dump throws the enemy behind the player and bowls over anyone it lands on", () => {
    const { w, player, enemy } = grab();
    const bystander = createFighter({ id: 3, team: "enemy", kind: "grunt", x: player.x - 50, z: 60, stats: stats(), clinchMoves: clinch });
    w.fighters.push(bystander);
    tick(w, { 1: { clinchAction: "dump" } });
    run(w, 14);
    expect(enemy.state).toBe("knockdown");
    expect(enemy.x).toBeLessThan(player.x);
    expect(bystander.state).toBe("knockdown");
    expect(bystander.hp).toBe(100 - tuning.throwSplashDamage);
  });

  it("a held fighter mashes out and staggers the holder", () => {
    const s = setup(100, 36);
    run(s.w, tuning.clinchBeat + 1, { 2: { moveX: -1, wantClinch: true, face: -1 } });
    expect(s.player.state).toBe("clinched");
    run(s.w, tuning.clinchEscapeMash, { 1: { mash: 1 } });
    expect(s.player.state).toBe("idle");
    expect(s.enemy.state).toBe("stagger");
  });

  it("a striking fighter can't be grabbed", () => {
    const s = setup(100, 36);
    run(s.w, tuning.clinchBeat + 4, { 2: { moveX: -1, wantClinch: true, face: -1 }, 1: { strike: strikes.overhand } });
    expect(s.player.state).not.toBe("clinched");
  });
});

describe("movement", () => {
  it("backing up while facing the enemy is slower than walking forward", () => {
    const a = setup(100, 300);
    run(a.w, 10, { 1: { moveX: 1, face: 1 } });
    const fwd = a.player.x - 100;
    const b = setup(100, 300);
    run(b.w, 10, { 1: { moveX: -1, face: 1 } });
    const back = 100 - b.player.x;
    expect(back).toBeCloseTo(fwd * tuning.backpedal, 5);
  });

  it("a slowed fighter moves at half speed and can't dash", () => {
    const { w, player } = setup(100, 300);
    player.slow = 100;
    run(w, 10, { 1: { moveX: 1, dash: 1 } });
    expect(player.state).not.toBe("dash");
    expect(player.x - 100).toBeCloseTo(10 * 2.5 * tuning.slowFactor, 5);
  });

  it("opposing fighters can't stand inside each other on one depth line", () => {
    const { w, player, enemy } = setup(100, 4);
    tick(w);
    expect(Math.abs(enemy.x - player.x)).toBeGreaterThanOrEqual(tuning.bodyWidth - 0.001);
  });

  it("depth stays inside the band", () => {
    const { w, player } = setup(100, 300);
    run(w, 200, { 1: { moveZ: 1 } });
    expect(player.z).toBe(DEFAULT_BAND.max);
  });
});
