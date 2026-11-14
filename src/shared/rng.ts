/** Small seeded PRNG (mulberry32). The simulation never calls Math.random, so runs replay exactly. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a key by weight. Keys are visited in sorted order so the result does not depend on object order. */
  weighted<K extends string>(weights: Partial<Record<K, number>>): K {
    const keys = (Object.keys(weights) as K[]).sort();
    let total = 0;
    for (const k of keys) total += weights[k] ?? 0;
    let r = this.next() * total;
    for (const k of keys) {
      r -= weights[k] ?? 0;
      if (r < 0) return k;
    }
    return keys[keys.length - 1];
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))];
  }
}
