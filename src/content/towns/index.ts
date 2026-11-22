import { CHICAGO } from "./chicago";
import { ST_LOUIS } from "./stLouis";
import type { TownDef } from "./types";

export * from "./chicago";
export * from "./stLouis";
export * from "./types";

export interface MetroDef {
  id: string;
  /** Tour stop number minus one; also the metro step of the enemy ramp. */
  index: number;
  towns: TownDef[];
}

/** The tour, in order (plan §1). A metro opens when the one before it is won. */
export const METROS: MetroDef[] = [
  { id: "st-louis", index: 0, towns: ST_LOUIS },
  { id: "chicago", index: 1, towns: CHICAGO },
];

export const ALL_TOWNS: TownDef[] = METROS.flatMap((m) => m.towns);

/** Every level id across the tour, in play order. */
export const TOWN_ORDER: string[] = ALL_TOWNS.map((t) => t.id);

export const townById = (id: string): TownDef | undefined => ALL_TOWNS.find((t) => t.id === id);

export const metroById = (id: string): MetroDef | undefined => METROS.find((m) => m.id === id);

/** The metro a level belongs to. */
export const metroOf = (town: TownDef): MetroDef => metroById(town.metro) ?? METROS[0];

/** A metro's level ids, in order. */
export const metroOrder = (metro: MetroDef): string[] => metro.towns.map((t) => t.id);
