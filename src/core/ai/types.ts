import type { Command, CombatEvent, Fighter, StrikeDef } from "@/core/combat";
import type { DepthBand } from "@/core/depth";
import type { Rng } from "@/shared/rng";

/** A grunt archetype's behaviour, as data (content/fighters). */
export interface ArchetypeDef {
  id: string;
  /** Strike ids with pick weights. */
  attacks: Array<{ strike: string; weight: number }>;
  /** Second strike thrown by higher ranks. */
  followUp?: string;
  /** Strike used to shove the player off when crowded (kickers). */
  pushStrike?: string;
  /** Ticks between attacks at white belt: [min, max]. */
  cooldown: [number, number];
  guardChance: number;
  /** Walks in and grabs. */
  clinches?: boolean;
  /** Dashes in and out. */
  dashes?: boolean;
  /** Distance kept while waiting for a turn. */
  hoverDistance: number;
}

export interface RankDef {
  name: string;
  hp: number;
  damage: number;
  speed: number;
  /** Multiplier on attack cooldown (lower = more aggressive). */
  cooldown: number;
  /** Added to the archetype's guard chance. */
  guard: number;
  followUpChance: number;
}

export type BossStyleId =
  "brawler" | "teepMaster" | "lowKicker" | "clincher" | "runner" | "ironGuard" | "elbowBrawler" | "counterStriker" | "kneeRusher";

export interface BossPhaseDef {
  /** This phase applies while hp fraction is at or below `below` (first phase: 1). */
  below: number;
  styles: BossStyleId[];
  /** Ticks before rotating to the next style in the phase. */
  swapTicks: number;
}

/** A gym leader's or the champion's style, as data (content/towns). */
export interface BossDef {
  style: BossStyleId;
  /** Role → strike id. Each style reads the roles it needs (see bossStyles.ts). */
  strikes: Record<string, string>;
  guardChance: number;
  cooldown: [number, number];
  /** Champion only: styles by health. */
  phases?: BossPhaseDef[];
}

export type AiEvent = { type: "bossPhase"; fighterId: number; phase: number };

export interface AiView {
  tick: number;
  player: Fighter;
  fighters: Fighter[];
  strikes: Record<string, StrikeDef>;
  rng: Rng;
  band: DepthBand;
  /** Walkable x range right now (camera or arena bounds). */
  minX: number;
  maxX: number;
  /** Combat events from the previous tick. */
  events: readonly CombatEvent[];
  emit: (e: AiEvent) => void;
}

export interface Brain {
  readonly fighterId: number;
  /** Holds one of the level's attack tokens. Grunts without one hover and flank. */
  engaged: boolean;
  /** Ready to take a token. */
  wantsToken(): boolean;
  think(self: Fighter, view: AiView): Command;
}
