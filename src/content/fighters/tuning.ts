import type { RankDef } from "@/core/ai";
import type { CombatTuning, FighterStats } from "@/core/combat";
import type { ArchetypeEntry, DifficultyDef, ItemRules } from "@/core/fight";
import type { InputTuning } from "@/core/input";
import type { Difficulty, LivesRules, ScoreRules, StarRules } from "@/core/progress";

/**
 * Tuning table v0 (MM-039). Rough on purpose — every number here is a playtest away from changing,
 * and changing it is a one-line edit. Ticks are 60 Hz; distances are logical pixels.
 */
export const COMBAT_TUNING: CombatTuning = {
  depthTolerance: 16,
  friction: 0.84,
  // Game feel (MM-040): hit-stop in ticks.
  hitStop: 3,
  heavyHitStop: 6,
  koHitStop: 10,
  chipDefault: 0.15,
  blockStun: 10,
  checkWindow: 9,
  checkRecoil: 26,
  lowCheckStagger: 80,
  parryStagger: 46,
  knockdownFall: 26,
  knockdownDown: 38,
  getUp: 22,
  getUpInvuln: 34,
  koTicks: 84,
  linkGrace: 16,
  backpedal: 0.72,
  slowFactor: 0.5,
  armorDamage: 0.45,
  lockOnRange: 230,
  lockOnDepth: 60,
  clinchBeat: 16,
  clinchRange: 42,
  clinchDepth: 14,
  clinchHold: 34,
  clinchTimeout: 170,
  clinchEscapeMash: 6,
  throwSpeed: 15,
  throwSplashDamage: 10,
  pushStagger: 75,
  maxHitChain: 7,
  bodyWidth: 28,
  bodyDepth: 12,
};

export const INPUT_TUNING: InputTuning = { holdTicks: 10, doubleTapTicks: 14, bufferTicks: 6 };

export const PLAYER_STATS: FighterStats = {
  maxHp: 100,
  walkSpeed: 2.7,
  depthSpeed: 1.8,
  dashSpeed: 7.5,
  dashTicks: 12,
  knockbackTaken: 1,
  damageDealt: 1,
};

/** MM-083 is open: name, look and backstory are placeholders until Scott's call. */
export const PLAYER_CHARACTER = {
  name: "The Challenger",
  backstory: "A nobody from out of town with one plan: beat every gym on the way to the champ.",
};

/**
 * Enemy design sheets (MM-050), in brief:
 *  brawler  — walks in swinging; jab, cross, a big telegraphed haymaker. Slow, sturdy.
 *  kicker   — stays at leg range; roundhouse and low kick, teeps you off when crowded.
 *  grappler — heavy, ignores a lot of knockback, walks in and clinches. Mash out or strike first.
 *  quick    — light, dashes in for one or two fast jabs and gets out. Drops in two hits.
 */
export const ARCHETYPES: Record<string, ArchetypeEntry> = {
  brawler: {
    id: "brawler",
    attacks: [
      { strike: "g_jab", weight: 3 },
      { strike: "g_cross", weight: 2 },
      { strike: "g_haymaker", weight: 1 },
    ],
    followUp: "g_cross",
    cooldown: [70, 120],
    guardChance: 0.1,
    hoverDistance: 170,
    clinchable: true,
    stats: { maxHp: 20, walkSpeed: 1.5, depthSpeed: 1.0, dashSpeed: 6, dashTicks: 10, knockbackTaken: 1, damageDealt: 1 },
  },
  kicker: {
    id: "kicker",
    attacks: [
      { strike: "g_round", weight: 3 },
      { strike: "g_low", weight: 2 },
    ],
    pushStrike: "g_teep",
    cooldown: [80, 130],
    guardChance: 0.1,
    hoverDistance: 190,
    clinchable: true,
    stats: { maxHp: 17, walkSpeed: 1.6, depthSpeed: 1.1, dashSpeed: 6, dashTicks: 10, knockbackTaken: 1.1, damageDealt: 1 },
  },
  grappler: {
    id: "grappler",
    attacks: [
      { strike: "g_knee", weight: 2 },
      { strike: "g_elbow", weight: 1 },
    ],
    clinches: true,
    cooldown: [90, 140],
    guardChance: 0.15,
    hoverDistance: 150,
    clinchable: true,
    stats: { maxHp: 28, walkSpeed: 1.3, depthSpeed: 0.9, dashSpeed: 6, dashTicks: 10, knockbackTaken: 0.7, damageDealt: 1 },
  },
  quick: {
    id: "quick",
    attacks: [{ strike: "g_quickjab", weight: 1 }],
    followUp: "g_quickjab",
    dashes: true,
    cooldown: [50, 90],
    guardChance: 0.05,
    hoverDistance: 210,
    clinchable: true,
    stats: { maxHp: 12, walkSpeed: 2.2, depthSpeed: 1.5, dashSpeed: 7, dashTicks: 10, knockbackTaken: 1.25, damageDealt: 1 },
  },
};

/** Rank escalation (MM-052). Muay Thai has no belts; the armband (prajioud) colour carries the rank. */
// prettier-ignore
export const RANKS: RankDef[] = [
  { name: "White", hp: 1, damage: 1, speed: 1, cooldown: 1, guard: 0, followUpChance: 0 },
  { name: "Blue", hp: 1.3, damage: 1.15, speed: 1.05, cooldown: 0.85, guard: 0.1, followUpChance: 0.3 },
  { name: "Brown", hp: 1.6, damage: 1.3, speed: 1.1, cooldown: 0.72, guard: 0.2, followUpChance: 0.55 },
  { name: "Black", hp: 2.0, damage: 1.5, speed: 1.18, cooldown: 0.58, guard: 0.3, followUpChance: 0.8 },
];

/** Difficulty setting (MM-150) with the Easy assists (MM-152). */
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { enemyHp: 0.8, enemyDamage: 0.7, density: 0.85, clock: 1.25, checkWindowBonus: 5, extraItems: 1 },
  normal: { enemyHp: 1, enemyDamage: 1, density: 1, clock: 1, checkWindowBonus: 0, extraItems: 0 },
  hard: { enemyHp: 1.25, enemyDamage: 1.3, density: 1.2, clock: 0.85, checkWindowBonus: -2, extraItems: 0 },
};

/**
 * Progressive ramp (MM-151): grunts get tougher by level and by metro from these two numbers alone.
 * St. Louis is metro 0; Chicago would be metro 1, and so on.
 */
export const RAMP = { hpPerLevel: 0.05, damagePerLevel: 0.045, hpPerMetro: 0.35, damagePerMetro: 0.3 };

export const rampFor = (levelIndex: number, metroIndex = 0): { enemyHp: number; enemyDamage: number } => ({
  enemyHp: 1 + RAMP.hpPerLevel * levelIndex + RAMP.hpPerMetro * metroIndex,
  enemyDamage: 1 + RAMP.damagePerLevel * levelIndex + RAMP.damagePerMetro * metroIndex,
});

/**
 * Energy drink (MM-066). Decision taken for v0: you start with one, every Nth grunt in a level's stream
 * drops one, and the pack before the leader always drops one. Hold up to three.
 */
export const ITEM_RULES: ItemRules = { heal: 35, max: 3, start: 1 };

/** Lives (open question 6): placeholders for X per day and the cap Y. */
export const LIVES_RULES: LivesRules = { startWith: 5, perDay: 5, cap: 10 };

export const STAR_RULES: StarRules = { healthFraction: 0.5, clockFraction: 0.25 };

export const SCORE_RULES: ScoreRules = {
  hitBase: 10,
  perDamage: 2,
  comboStep: 0.1,
  comboCap: 20,
  comboWindow: 100,
  varietyBonus: [0, 0, 100, 300, 800],
  koBonus: 100,
  bossBonus: 2000,
  timeRate: 20,
  healthRate: 15,
};
