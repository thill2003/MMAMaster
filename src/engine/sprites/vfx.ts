import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SpriteMaterial,
  Sprite,
  SRGBColorSpace,
  type Texture,
} from "three";

type SparkKind = "hit" | "heavy" | "block" | "check" | "armor" | "ko";

const FONT = '"Futura-CondensedExtraBold","HelveticaNeue-CondensedBlack","Arial Narrow","Roboto Condensed",Impact,sans-serif';

const COLORS: Record<SparkKind, [string, string]> = {
  hit: ["#fff2b0", "#ff9d2e"],
  heavy: ["#ffffff", "#ff5a1f"],
  block: ["#cfe6ff", "#5aa0ff"],
  check: ["#fff6c0", "#f2c14e"],
  armor: ["#d0d0d8", "#8a8a98"],
  ko: ["#ffffff", "#ff2e2e"],
};

const BLOOD = 0xb3121c;
const BLOOD_DARK = 0x6e0a10;
const GRAVITY = 0.35;
const STAIN_LIFE = 600;
const STAIN_FADE = 120;
const MAX_STAINS = 80;
const MAX_DROPS = 400;

/** Draw a spark's starburst (or a guard ring) once into a texture; sprites scale and fade it. */
const sparkTexture = (kind: SparkKind): Texture => {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const [inner, outer] = COLORS[kind];
  ctx.translate(s / 2, s / 2);
  if (kind === "block" || kind === "check" || kind === "armor") {
    ctx.strokeStyle = outer;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const rays = kind === "heavy" || kind === "ko" ? 9 : 7;
    ctx.fillStyle = outer;
    for (let j = 0; j < rays; j++) {
      const a = (j / rays) * Math.PI * 2 + 0.4;
      const len = s * 0.5 * (0.72 + ((j * 5) % 7) / 24);
      const w = 0.17;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - w) * s * 0.13, Math.sin(a - w) * s * 0.13);
      ctx.lineTo(Math.cos(a + w) * s * 0.13, Math.sin(a + w) * s * 0.13);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.22);
    g.addColorStop(0, inner);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
};

const textTexture = (str: string, color: string, size: number): { tex: Texture; w: number; h: number } => {
  const px = size * 3;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `${px}px ${FONT}`;
  const w = Math.ceil(ctx.measureText(str).width + px * 0.8);
  const h = Math.ceil(px * 1.5);
  c.width = w;
  c.height = h;
  ctx.font = `${px}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = px * 0.24;
  ctx.strokeStyle = "#17121c";
  ctx.strokeText(str, w / 2, h / 2);
  ctx.fillStyle = color;
  ctx.fillText(str, w / 2, h / 2);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return { tex, w: w / 3, h: h / 3 };
};

interface Spark {
  s: Sprite;
  life: number;
  max: number;
  big: boolean;
}

interface Floater {
  s: Sprite;
  life: number;
  max: number;
  w: number;
  h: number;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
}

interface Stain {
  m: Mesh;
  mat: MeshBasicMaterial;
  life: number;
}

/** Hit sparks, blood and floating callouts in the 3D world. Pooled, frame-timed, purely cosmetic. */
export class Fx {
  private readonly sparkTex: Record<SparkKind, Texture>;
  private sparks: Spark[] = [];
  private sparkPool: Sprite[] = [];
  private floaters: Floater[] = [];
  private drops: Drop[] = [];
  private stains: Stain[] = [];
  private readonly dropMesh: InstancedMesh;
  private readonly stainGeo = new CircleGeometry(1, 14);
  private readonly mtx = new Matrix4();
  private noise = 0x2f6b9d;

  constructor(private readonly root: Group) {
    this.sparkTex = {
      hit: sparkTexture("hit"),
      heavy: sparkTexture("heavy"),
      block: sparkTexture("block"),
      check: sparkTexture("check"),
      armor: sparkTexture("armor"),
      ko: sparkTexture("ko"),
    };
    this.dropMesh = new InstancedMesh(new SphereGeometry(1, 6, 5), new MeshStandardMaterial({ color: BLOOD, roughness: 0.25 }), MAX_DROPS);
    this.dropMesh.count = 0;
    this.dropMesh.frustumCulled = false;
    root.add(this.dropMesh);
  }

  /** Cosmetic jitter in [0, 1). The sim never sees it, so it needn't be the seeded Rng. */
  private rand(): number {
    this.noise = (Math.imul(this.noise, 1664525) + 1013904223) >>> 0;
    return this.noise / 4294967296;
  }

  /** A spray of blood from a landed blow at (x, y, z). `dir` is the way the blow travelled (-1, 0 or 1). */
  blood(x: number, y: number, z: number, dir: number, count: number): void {
    for (let i = 0; i < count && this.drops.length < MAX_DROPS; i++) {
      const spread = dir === 0 ? (this.rand() - 0.5) * 5 : dir * (0.8 + this.rand() * 3.4);
      this.drops.push({
        x: x + (this.rand() - 0.5) * 10,
        y: y + (this.rand() - 0.5) * 14,
        z: z + (this.rand() - 0.5) * 10,
        vx: spread + (this.rand() - 0.5) * 1.2,
        vy: 1 + this.rand() * 3.2,
        vz: (this.rand() - 0.5) * 3,
        r: 1.4 + this.rand() * 2.4,
      });
    }
  }

  spark(x: number, y: number, z: number, kind: SparkKind): void {
    const s = this.sparkPool.pop() ?? new Sprite(new SpriteMaterial({ depthTest: false, transparent: true, blending: AdditiveBlending }));
    s.material.map = this.sparkTex[kind];
    s.material.needsUpdate = true;
    s.renderOrder = 10;
    s.position.set(x, y, z);
    s.visible = true;
    this.root.add(s);
    const big = kind === "heavy" || kind === "ko";
    const max = big ? 14 : 9;
    this.sparks.push({ s, life: max, max, big });
  }

  text(x: number, y: number, z: number, str: string, color = "#ffffff", size = 22): void {
    const { tex, w, h } = textTexture(str, color, size);
    const s = new Sprite(new SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.renderOrder = 11;
    s.center.set(0.5, 0);
    s.position.set(x, y, z);
    this.root.add(s);
    this.floaters.push({ s, life: 46, max: 46, w: w * 1.5, h: h * 1.5 });
  }

  update(): void {
    this.updateBlood();
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life--;
      const k = 1 - sp.life / sp.max;
      const r = ((sp.big ? 16 : 10) + k * (sp.big ? 34 : 20)) * 2.6;
      sp.s.scale.set(r, r, 1);
      sp.s.material.opacity = 1 - k * k;
      if (sp.life <= 0) {
        sp.s.visible = false;
        sp.s.removeFromParent();
        this.sparkPool.push(sp.s);
        this.sparks.splice(i, 1);
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life--;
      const k = 1 - f.life / f.max;
      f.s.position.y += 0.9 * (1 - k);
      f.s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const sc = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.5);
      f.s.scale.set(f.w * sc, f.h * sc, 1);
      if (f.life <= 0) {
        f.s.removeFromParent();
        f.s.material.map?.dispose();
        f.s.material.dispose();
        this.floaters.splice(i, 1);
      }
    }
  }

  private updateBlood(): void {
    let n = 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy -= GRAVITY;
      d.x += d.vx;
      d.y += d.vy;
      d.z += d.vz;
      if (d.y <= 0.4) {
        this.stain(d.x, d.z, d.r * (2.2 + this.rand() * 1.6));
        this.drops.splice(i, 1);
        continue;
      }
      this.mtx.makeScale(d.r, d.r, d.r).setPosition(d.x, d.y, d.z);
      this.dropMesh.setMatrixAt(n++, this.mtx);
    }
    this.dropMesh.count = n;
    this.dropMesh.instanceMatrix.needsUpdate = true;

    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i];
      s.life--;
      if (s.life <= 0) {
        s.m.removeFromParent();
        s.mat.dispose();
        this.stains.splice(i, 1);
        continue;
      }
      s.mat.opacity = Math.min(1, s.life / STAIN_FADE) * 0.85;
    }
  }

  private stain(x: number, z: number, w: number): void {
    if (this.stains.length >= MAX_STAINS) {
      const old = this.stains.shift()!;
      old.m.removeFromParent();
      old.mat.dispose();
    }
    const mat = new MeshBasicMaterial({
      color: BLOOD_DARK,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const m = new Mesh(this.stainGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.3, z);
    m.scale.set(w * 0.6, w * 0.45, 1);
    this.root.add(m);
    this.stains.push({ m, mat, life: STAIN_LIFE });
  }

  destroy(): void {
    for (const s of this.sparks) s.s.removeFromParent();
    for (const s of [...this.sparks.map((x) => x.s), ...this.sparkPool]) s.material.dispose();
    for (const t of Object.values(this.sparkTex)) t.dispose();
    for (const f of this.floaters) {
      f.s.removeFromParent();
      f.s.material.map?.dispose();
      f.s.material.dispose();
    }
    for (const s of this.stains) {
      s.m.removeFromParent();
      s.mat.dispose();
    }
    this.dropMesh.removeFromParent();
    this.dropMesh.geometry.dispose();
    (this.dropMesh.material as MeshStandardMaterial).dispose();
    this.stainGeo.dispose();
    this.sparks = [];
    this.sparkPool = [];
    this.floaters = [];
    this.drops = [];
    this.stains = [];
  }
}
