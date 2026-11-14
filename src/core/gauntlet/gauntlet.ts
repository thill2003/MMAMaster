import type { BossDef } from "@/core/ai";
import { lerp } from "@/shared/math";
import type { Rng } from "@/shared/rng";

/** One stretch of the enemy stream. `from`/`to` are fractions of the level's length. */
export interface StreamSegment {
  from: number;
  to: number;
  /** Scroll distance between spawns, px. */
  spacing: number;
  /** Archetype id → weight. */
  mix: Record<string, number>;
  /** Weight per rank index (white, blue, brown, black). */
  ranks: number[];
}

/** A set-piece: the scroll locks until the pack is down. */
export interface HoldDef {
  at: number;
  pack: Array<{ kind: string; rank: number }>;
}

export interface LeaderDef {
  id: string;
  name: string;
  title: string;
  /** Look id for the engine. */
  kind: string;
  hp: number;
  damage: number;
  walkSpeed: number;
  knockbackTaken: number;
  clinchable: boolean;
  /** Knees you get before he breaks your clinch. */
  clinchKneeCap: number;
  boss: BossDef;
}

/** Everything the simulation needs to run one town. Visual theme and map data live beside it in content. */
export interface LevelDef {
  id: string;
  index: number;
  name: string;
  gym: string;
  /** Scroll distance from the start to the leader's spot, px. */
  length: number;
  clockSeconds: number;
  segments: StreamSegment[];
  holds: HoldDef[];
  /** Most enemies alive at once: [at the start, at the end]. */
  maxAlive: [number, number];
  /** Most enemies attacking at once: [at the start, at the end]. */
  maxEngaged: [number, number];
  /** Chance a spawn comes from behind. */
  behindChance: number;
  /** Every Nth spawn carries an energy drink (0 = never). */
  dropEvery: number;
  leader: LeaderDef;
  seed: number;
}

export interface SpawnEntry {
  atX: number;
  kind: string;
  rank: number;
  /** 1 = from ahead, -1 = from behind. */
  side: 1 | -1;
  /** Depth as a fraction of the band. */
  zFrac: number;
  drop: boolean;
}

const FIRST_SPAWN_AT = 320;
const LAST_SPAWN_BEFORE_END = 260;
const HOLD_CLEARANCE = 170;

/** Lay the stream out along the level. Same level + same seed = the same schedule, every run. */
export const buildSchedule = (level: LevelDef, rng: Rng, densityScale = 1): SpawnEntry[] => {
  const out: SpawnEntry[] = [];
  const holdXs = level.holds.map((h) => h.at * level.length);
  let x = FIRST_SPAWN_AT;
  let n = 0;
  const end = level.length - LAST_SPAWN_BEFORE_END;
  while (x < end) {
    const frac = x / level.length;
    const seg = level.segments.find((s) => frac >= s.from && frac < s.to) ?? level.segments[level.segments.length - 1];
    const nearHold = holdXs.some((hx) => x > hx - HOLD_CLEARANCE && x < hx + 40);
    if (!nearHold) {
      n++;
      const rankWeights: Record<string, number> = {};
      seg.ranks.forEach((w, i) => {
        if (w > 0) rankWeights[String(i)] = w;
      });
      out.push({
        atX: Math.round(x),
        kind: rng.weighted(seg.mix),
        rank: Number(rng.weighted(rankWeights)),
        side: rng.chance(level.behindChance) ? -1 : 1,
        zFrac: rng.range(0.08, 0.92),
        drop: level.dropEvery > 0 && n % level.dropEvery === 0,
      });
    }
    x += (seg.spacing / densityScale) * rng.range(0.8, 1.2);
  }
  return out;
};

export interface GauntletUpdate {
  spawns: SpawnEntry[];
  holdStarted: HoldDef | null;
  /** The whole stream is out and the player has reached the leader's spot. */
  leaderReady: boolean;
}

/** The enemy stream at runtime: releases spawns by scroll distance, runs the set-piece holds, calls the leader. */
export class Gauntlet {
  private nextSpawn = 0;
  private nextHold = 0;
  private holdActive = false;
  private holdX = 0;

  constructor(
    private readonly level: LevelDef,
    readonly schedule: SpawnEntry[],
  ) {}

  get totalSpawns(): number {
    return this.schedule.length;
  }

  get spawned(): number {
    return this.nextSpawn;
  }

  /** x of the active hold's centre, or null. */
  get activeHoldX(): number | null {
    return this.holdActive ? this.holdX : null;
  }

  progress(progressX: number): number {
    return Math.max(0, Math.min(1, progressX / this.level.length));
  }

  maxAlive(progressX: number): number {
    return Math.round(lerp(this.level.maxAlive[0], this.level.maxAlive[1], this.progress(progressX)));
  }

  maxEngaged(progressX: number): number {
    return Math.max(1, Math.round(lerp(this.level.maxEngaged[0], this.level.maxEngaged[1], this.progress(progressX))));
  }

  holdCleared(): void {
    this.holdActive = false;
  }

  update(progressX: number, alive: number): GauntletUpdate {
    const result: GauntletUpdate = { spawns: [], holdStarted: null, leaderReady: false };
    if (this.holdActive) return result;

    const hold = this.level.holds[this.nextHold];
    if (hold && progressX >= hold.at * this.level.length) {
      this.nextHold++;
      this.holdActive = true;
      this.holdX = hold.at * this.level.length;
      result.holdStarted = hold;
      return result;
    }

    const cap = this.maxAlive(progressX);
    let count = alive;
    while (this.nextSpawn < this.schedule.length && this.schedule[this.nextSpawn].atX <= progressX && count < cap) {
      result.spawns.push(this.schedule[this.nextSpawn]);
      this.nextSpawn++;
      count++;
    }

    result.leaderReady =
      this.nextSpawn >= this.schedule.length && this.nextHold >= this.level.holds.length && progressX >= this.level.length - 140;
    return result;
  }
}

/** The Kung-Fu Master countdown, in ticks. Hitting zero is a KO. */
export class LevelClock {
  readonly total: number;
  left: number;

  constructor(seconds: number, ticksPerSecond = 60) {
    this.total = Math.round(seconds * ticksPerSecond);
    this.left = this.total;
  }

  /** Advance one tick. Returns true on the tick the clock runs out. */
  tick(): boolean {
    if (this.left <= 0) return false;
    this.left--;
    return this.left === 0;
  }

  get fraction(): number {
    return this.total > 0 ? this.left / this.total : 0;
  }

  get seconds(): number {
    return Math.ceil(this.left / 60);
  }
}
