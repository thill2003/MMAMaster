import type { BossDef } from "@/core/ai";
import type { HoldDef, LevelDef, StreamSegment } from "@/core/gauntlet";

import type { FighterLook } from "../fighters/looks";

export type TimeOfDay = "morning" | "noon" | "afternoon" | "sunset" | "dusk" | "night";

/** How a level looks — all data, so every level can differ without new code (MM-160). */
export interface ThemeDef {
  kit: "street" | "arena";
  timeOfDay: TimeOfDay;
  /** Invented storefront names for the street kit. No real businesses, no trademarks (plan §12). */
  signs: string[];
  /** The Arch stands on the skyline in the St. Louis city levels. */
  arch: boolean;
  /** Gym colours worn by this gym's fighters: shorts and trim. */
  gymColor: number;
  gymTrim: number;
}

export interface TownDef extends LevelDef {
  metro: string;
  /** One line on the level card. */
  blurb: string;
  theme: ThemeDef;
  /** Track id in content/audio. */
  music: string;
  /** Node position on the metro map, in map units (see MAP_SIZE). */
  map: { x: number; y: number };
  leaderLook: FighterLook;
  /** Design-sheet notes for the leader: the key and the tells. Never shown in v1. */
  design: { key: string; tells: string };
  isChampion: boolean;
}

export const MAP_SIZE = { width: 1000, height: 2400 };

export const seg = (from: number, to: number, spacing: number, mix: Record<string, number>, ranks: number[]): StreamSegment => ({
  from,
  to,
  spacing,
  mix,
  ranks,
});

export const pack = (at: number, ...members: Array<[string, number]>): HoldDef => ({
  at,
  pack: members.map(([kind, rank]) => ({ kind, rank })),
});

export const boss = (
  style: BossDef["style"],
  strikes: Record<string, string>,
  guardChance: number,
  cooldown: [number, number],
): BossDef => ({
  style,
  strikes,
  guardChance,
  cooldown,
});
