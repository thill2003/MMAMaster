import Phaser from "phaser";

type SparkKind = "hit" | "heavy" | "block" | "check" | "armor" | "ko";

interface Spark {
  g: Phaser.GameObjects.Graphics;
  life: number;
  max: number;
  kind: SparkKind;
  seed: number;
}

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

  constructor(
    private readonly scene: Phaser.Scene,
    private resolution: number,
  ) {}

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

  destroy(): void {
    for (const s of this.sparks) s.g.destroy();
    for (const g of this.pool) g.destroy();
    for (const f of this.floaters) f.t.destroy();
    this.sparks = [];
    this.pool = [];
    this.floaters = [];
  }
}
