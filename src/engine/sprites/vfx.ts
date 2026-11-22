import Phaser from "phaser";

type SparkKind = "hit" | "heavy" | "block" | "check" | "armor" | "ko";

interface Spark {
  g: Phaser.GameObjects.Graphics;
  life: number;
  max: number;
  kind: SparkKind;
  seed: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  floorY: number;
}

interface Stain {
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
}

const BLOOD = 0xb3121c;
const BLOOD_DARK = 0x6e0a10;
const GRAVITY = 0.35;
const STAIN_LIFE = 600; // frames a floor stain stays before it is gone
const STAIN_FADE = 120;
const MAX_STAINS = 80;

interface Floater {
  t: Phaser.GameObjects.Text;
  life: number;
  max: number;
}

const FONT = '"Futura-CondensedExtraBold","HelveticaNeue-CondensedBlack","Arial Narrow","Roboto Condensed",Impact,sans-serif';

const COLORS: Record<SparkKind, [number, number]> = {
  hit: [0xfff2b0, 0xff9d2e],
  heavy: [0xffffff, 0xff5a1f],
  block: [0xcfe6ff, 0x5aa0ff],
  check: [0xfff6c0, 0xf2c14e],
  armor: [0xd0d0d8, 0x8a8a98],
  ko: [0xffffff, 0xff2e2e],
};

/** Hit sparks, dust and floating callouts. Pooled, frame-timed, purely cosmetic. */
export class Fx {
  private sparks: Spark[] = [];
  private pool: Phaser.GameObjects.Graphics[] = [];
  private floaters: Floater[] = [];
  private drops: Drop[] = [];
  private stains: Stain[] = [];
  private readonly dropsG: Phaser.GameObjects.Graphics;
  private readonly stainsG: Phaser.GameObjects.Graphics;
  private noise = 0x2f6b9d;

  constructor(
    private readonly scene: Phaser.Scene,
    private resolution: number,
  ) {
    this.dropsG = scene.add.graphics().setDepth(799999);
    this.stainsG = scene.add.graphics().setDepth(-90);
  }

  /** Cosmetic jitter in [0, 1). The sim never sees it, so it needn't be the seeded Rng. */
  private rand(): number {
    this.noise = (Math.imul(this.noise, 1664525) + 1013904223) >>> 0;
    return this.noise / 4294967296;
  }

  /**
   * A spray of blood from a landed blow at (x, y). `dir` is the way the blow travelled (-1, 0 or 1);
   * drops arc that way, fall to `floorY` and leave stains that fade out.
   */
  blood(x: number, y: number, floorY: number, dir: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const spread = dir === 0 ? (this.rand() - 0.5) * 5 : dir * (0.8 + this.rand() * 3.4);
      this.drops.push({
        x: x + (this.rand() - 0.5) * 10,
        y: y + (this.rand() - 0.5) * 14,
        vx: spread + (this.rand() - 0.5) * 1.2,
        vy: -1 - this.rand() * 3.2,
        r: 1.4 + this.rand() * 2.4,
        floorY: floorY + (this.rand() - 0.5) * 14,
      });
    }
  }

  setResolution(r: number): void {
    this.resolution = r;
  }

  spark(x: number, y: number, kind: SparkKind): void {
    const g = this.pool.pop() ?? this.scene.add.graphics();
    g.setVisible(true).setPosition(x, y).setDepth(800000);
    const max = kind === "heavy" || kind === "ko" ? 14 : 9;
    this.sparks.push({ g, life: max, max, kind, seed: Math.floor(x * 7 + y * 13) });
  }

  text(x: number, y: number, str: string, color = "#ffffff", size = 22): void {
    const t = this.scene.add
      .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: "#17121c", strokeThickness: 5 })
      .setOrigin(0.5, 1)
      .setDepth(800001)
      .setResolution(this.resolution);
    this.floaters.push({ t, life: 46, max: 46 });
  }

  update(): void {
    this.updateBlood();
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life--;
      const k = 1 - s.life / s.max;
      const [inner, outer] = COLORS[s.kind];
      const big = s.kind === "heavy" || s.kind === "ko";
      const r = (big ? 16 : 10) + k * (big ? 34 : 20);
      s.g.clear();
      const alpha = 1 - k * k;
      if (s.kind === "block" || s.kind === "check" || s.kind === "armor") {
        s.g.lineStyle(big ? 5 : 3.5, outer, alpha);
        s.g.strokeCircle(0, 0, r * 0.8);
        s.g.fillStyle(inner, alpha * 0.8);
        s.g.fillCircle(0, 0, Math.max(1, 7 - k * 7));
      } else {
        const rays = big ? 9 : 7;
        s.g.fillStyle(outer, alpha);
        for (let j = 0; j < rays; j++) {
          const a = (j / rays) * Math.PI * 2 + (s.seed % 10) * 0.3;
          const len = r * (0.7 + ((s.seed * (j + 3)) % 7) / 12);
          const w = 0.16;
          s.g.fillTriangle(
            Math.cos(a - w) * r * 0.28,
            Math.sin(a - w) * r * 0.28,
            Math.cos(a + w) * r * 0.28,
            Math.sin(a + w) * r * 0.28,
            Math.cos(a) * len,
            Math.sin(a) * len,
          );
        }
        s.g.fillStyle(inner, alpha);
        s.g.fillCircle(0, 0, Math.max(1, (big ? 13 : 8) * (1 - k)));
      }
      if (s.life <= 0) {
        s.g.clear().setVisible(false);
        this.pool.push(s.g);
        this.sparks.splice(i, 1);
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life--;
      const k = 1 - f.life / f.max;
      f.t.y -= 0.9 * (1 - k);
      f.t.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      f.t.setScale(k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.5));
      if (f.life <= 0) {
        f.t.destroy();
        this.floaters.splice(i, 1);
      }
    }
  }

  private updateBlood(): void {
    const g = this.dropsG;
    g.clear();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy += GRAVITY;
      d.x += d.vx;
      d.y += d.vy;
      if (d.y >= d.floorY) {
        const w = d.r * (2.2 + this.rand() * 1.6);
        this.stains.push({ x: d.x, y: d.floorY, w, h: w * 0.38, life: STAIN_LIFE });
        this.drops.splice(i, 1);
        continue;
      }
      g.fillStyle(BLOOD, 1);
      g.fillCircle(d.x, d.y, d.r);
      // A short trail behind fast drops reads as motion at 60 Hz.
      g.fillStyle(BLOOD, 0.45);
      g.fillCircle(d.x - d.vx * 0.8, d.y - d.vy * 0.8, d.r * 0.7);
    }
    if (this.stains.length > MAX_STAINS) this.stains.splice(0, this.stains.length - MAX_STAINS);
    const sg = this.stainsG;
    sg.clear();
    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i];
      s.life--;
      if (s.life <= 0) {
        this.stains.splice(i, 1);
        continue;
      }
      const alpha = Math.min(1, s.life / STAIN_FADE) * 0.85;
      sg.fillStyle(BLOOD_DARK, alpha);
      sg.fillEllipse(s.x, s.y, s.w, s.h);
    }
  }

  destroy(): void {
    this.dropsG.destroy();
    this.stainsG.destroy();
    this.drops = [];
    this.stains = [];
    for (const s of this.sparks) s.g.destroy();
    for (const g of this.pool) g.destroy();
    for (const f of this.floaters) f.t.destroy();
    this.sparks = [];
    this.pool = [];
    this.floaters = [];
  }
}
