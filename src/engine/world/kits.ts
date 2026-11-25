import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  type Scene,
  SphereGeometry,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Texture,
  TubeGeometry,
  Vector3,
} from "three";

import { CAMERA_3D } from "@/content/display";
import type { ThemeDef, TimeOfDay } from "@/content/towns";
import { Rng } from "@/shared/rng";

/**
 * Environment kits, built procedurally in 3D (the v0 stand-in for modelled sets, plan §8).
 * Street kit: sky → far skyline → a row of buildings with painted storefronts → sidewalk, curb and street,
 * with lamp posts and hydrants. Arena kit: back wall and banners → tiered crowd → cage → mat, under spots.
 * Signage is invented; nothing here is a real business or a trademark.
 */
interface Palette {
  skyTop: string;
  skyBottom: string;
  skyline: string;
  skylineLit: boolean;
  wall: string[];
  sidewalk: string;
  street: string;
  windows: string;
  sun: number;
  sunIntensity: number;
  /** Sun direction: [x, y, z], toward the light. */
  sunDir: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
}

const PALETTES: Record<TimeOfDay, Palette> = {
  morning: {
    skyTop: "#7fb8e6",
    skyBottom: "#f6dcb0",
    skyline: "#8fa3b8",
    skylineLit: false,
    wall: ["#b5654a", "#c9a27a", "#8c8f9a", "#a8553f"],
    sidewalk: "#b9b4aa",
    street: "#5d5f66",
    windows: "#2c3e55",
    sun: 0xffe2b8,
    sunIntensity: 2.6,
    sunDir: [-0.7, 0.8, 0.6],
    hemiSky: 0xcfe2ff,
    hemiGround: 0x6b5a4a,
    hemiIntensity: 1.1,
  },
  noon: {
    skyTop: "#4f9be0",
    skyBottom: "#cfe8f7",
    skyline: "#8ea1b6",
    skylineLit: false,
    wall: ["#c2b59b", "#9aa7b0", "#b86b4b", "#d8c9a8"],
    sidewalk: "#c4c0b6",
    street: "#62646b",
    windows: "#31455e",
    sun: 0xffffff,
    sunIntensity: 3,
    sunDir: [-0.25, 1, 0.45],
    hemiSky: 0xdfefff,
    hemiGround: 0x6a6460,
    hemiIntensity: 1.2,
  },
  afternoon: {
    skyTop: "#5a94d0",
    skyBottom: "#f2d9a6",
    skyline: "#8793a8",
    skylineLit: false,
    wall: ["#a9583f", "#c7ad86", "#7f8794", "#b5764e"],
    sidewalk: "#bdb5a6",
    street: "#5c5d63",
    windows: "#2f3d52",
    sun: 0xffd59a,
    sunIntensity: 2.7,
    sunDir: [0.6, 0.75, 0.55],
    hemiSky: 0xd8e4ff,
    hemiGround: 0x6e5a48,
    hemiIntensity: 1.05,
  },
  sunset: {
    skyTop: "#3c4a8a",
    skyBottom: "#f79d5c",
    skyline: "#4a3f63",
    skylineLit: true,
    wall: ["#8c4634", "#9c7a5c", "#5e6072", "#7a3e33"],
    sidewalk: "#a3968c",
    street: "#4b4852",
    windows: "#f6c56a",
    sun: 0xff9a5a,
    sunIntensity: 2.4,
    sunDir: [0.9, 0.35, 0.4],
    hemiSky: 0x9a88c8,
    hemiGround: 0x5a3a30,
    hemiIntensity: 0.95,
  },
  dusk: {
    skyTop: "#1c2456",
    skyBottom: "#b0567a",
    skyline: "#2c2a4a",
    skylineLit: true,
    wall: ["#5d3a44", "#6d6274", "#444a66", "#57323a"],
    sidewalk: "#7c7684",
    street: "#3a394a",
    windows: "#f2c14e",
    sun: 0xc8a0ff,
    sunIntensity: 1.3,
    sunDir: [-0.6, 0.6, 0.6],
    hemiSky: 0x6a6aa8,
    hemiGround: 0x3a2a3a,
    hemiIntensity: 0.9,
  },
  night: {
    skyTop: "#070a1e",
    skyBottom: "#24305e",
    skyline: "#161a36",
    skylineLit: true,
    wall: ["#33303f", "#3f4458", "#2a2d42", "#3b2a33"],
    sidewalk: "#565a6c",
    street: "#26283a",
    windows: "#ffd966",
    sun: 0x9fb2ff,
    sunIntensity: 1.1,
    sunDir: [-0.4, 0.8, 0.5],
    hemiSky: 0x4a5a9a,
    hemiGround: 0x2a2433,
    hemiIntensity: 0.85,
  },
};

const K = CAMERA_3D.depthStretch;
/** Building fronts, the curb, and how far the floor runs toward the camera, in world z. */
const WALL_Z = -60;
const CURB_Z = 52 * K;
const FLOOR_NEAR = 2000;
/** Painted facades are drawn at this many world units per canvas pixel. */
const FACADE_SCALE = 2;
const FACADE_W = 1536;
const FACADE_H = 330;
const SKYLINE_W = 1024;

const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

const makeCanvas = (w: number, h: number, scale = 1): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  return { c, ctx };
};

const SIGN_COLORS = ["#d62828", "#1d3fbf", "#1e7a4a", "#b5179e", "#e85d04", "#2b2b3a"];

/** Six storefronts side by side; returns each building's roof line in canvas pixels. */
const drawFacade = (ctx: CanvasRenderingContext2D, pal: Palette, theme: ThemeDef, rng: Rng): number[] => {
  const top = 100;
  const lit = pal.skylineLit;
  const count = 6;
  const bw = FACADE_W / count;
  const roofs: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = i * bw;
    const roof = top + rng.int(0, 70);
    roofs.push(roof);
    ctx.fillStyle = pal.wall[i % pal.wall.length];
    ctx.fillRect(x, roof, bw, FACADE_H - roof);
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 1;
    for (let y = roof + 8; y < FACADE_H - 90; y += 8) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + bw, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x, roof, bw, 7);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x, roof + 7, bw, 3);
    const cols = 3;
    for (let r = 0; r * 44 + roof + 22 < FACADE_H - 130; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + 26 + c * ((bw - 52 - 34) / (cols - 1));
        const wy = roof + 22 + r * 44;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(wx - 2, wy - 2, 38, 30);
        ctx.fillStyle = lit && rng.chance(0.5) ? pal.windows : "#27364a";
        ctx.fillRect(wx, wy, 34, 26);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(wx, wy, 34, 4);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(wx + 16, wy, 2, 26);
      }
    }
    const shopTop = FACADE_H - 104;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(x + 10, shopTop, bw - 20, 104);
    ctx.fillStyle = lit ? "#4d5a78" : "#3d5270";
    ctx.fillRect(x + 16, shopTop + 30, bw - 100, 62);
    ctx.fillStyle = lit ? "rgba(255,217,102,0.28)" : "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 16, shopTop + 30, bw - 100, 62);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.moveTo(x + 30, shopTop + 30);
    ctx.lineTo(x + 60, shopTop + 30);
    ctx.lineTo(x + 30, shopTop + 92);
    ctx.lineTo(x + 16, shopTop + 92);
    ctx.fill();
    ctx.fillStyle = "#2a2230";
    ctx.fillRect(x + bw - 76, shopTop + 26, 54, 78);
    ctx.fillStyle = lit ? "rgba(255,217,102,0.3)" : "rgba(160,200,230,0.3)";
    ctx.fillRect(x + bw - 70, shopTop + 32, 42, 44);
    const signColor = SIGN_COLORS[(i + theme.signs.length) % SIGN_COLORS.length];
    const name = theme.signs[i % theme.signs.length];
    const gym = i % theme.signs.length === 0;
    ctx.fillStyle = gym ? hex(theme.gymColor) : signColor;
    ctx.fillRect(x + 10, shopTop, bw - 20, 26);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 10, shopTop + 22, bw - 20, 4);
    ctx.fillStyle = gym ? hex(theme.gymTrim) : "#fff6e0";
    ctx.font = "bold 15px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let label = name;
    while (ctx.measureText(label).width > bw - 34 && label.length > 4) label = label.slice(0, -1);
    ctx.fillText(label, x + bw / 2, shopTop + 12);
  }
  return roofs;
};

const drawSkyline = (ctx: CanvasRenderingContext2D, pal: Palette, rng: Rng): void => {
  let x = 0;
  while (x < SKYLINE_W) {
    const w = rng.int(38, 96);
    const h = rng.int(50, 190);
    ctx.fillStyle = pal.skyline;
    ctx.fillRect(x, 260 - h, w, h);
    if (rng.chance(0.3)) ctx.fillRect(x + w / 2 - 2, 260 - h - rng.int(10, 26), 4, 30);
    if (pal.skylineLit) {
      ctx.fillStyle = pal.windows;
      for (let wy = 260 - h + 8; wy < 250; wy += 12) {
        for (let wx = x + 6; wx < x + w - 6; wx += 10) if (rng.chance(0.35)) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    x += w + rng.int(-4, 10);
  }
};

const drawSidewalk = (ctx: CanvasRenderingContext2D, pal: Palette): void => {
  ctx.fillStyle = pal.sidewalk;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  for (let i = 0; i < 90; i++) ctx.fillRect((i * 71) % 256, (i * 113) % 256, 3, 2);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();
};

const drawAsphalt = (ctx: CanvasRenderingContext2D, pal: Palette): void => {
  ctx.fillStyle = pal.street;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 2, 2);
  }
};

// ---------------------------------------------------------------- arena canvases

const drawArenaWall = (ctx: CanvasRenderingContext2D, theme: ThemeDef): void => {
  const h = FACADE_H;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#07070d");
  g.addColorStop(1, "#1b1826");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, h);
  const gold = hex(theme.gymTrim);
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * 256;
    ctx.fillStyle = i % 2 === 0 ? "#7a1420" : "#14141c";
    ctx.fillRect(x, 20, 120, 150);
    ctx.fillStyle = gold;
    ctx.fillRect(x, 20, 120, 6);
    ctx.fillRect(x, 164, 120, 6);
    ctx.beginPath();
    ctx.moveTo(x, 170);
    ctx.lineTo(x + 60, 196);
    ctx.lineTo(x + 120, 170);
    ctx.fill();
    ctx.font = "bold 16px 'Arial Narrow', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(i % 2 === 0 ? "CHAMPION'S" : "ST. LOUIS", x + 60, 84);
    ctx.fillText(i % 2 === 0 ? "HALL" : "CITY TITLE", x + 60, 106);
  }
};

const drawChainLink = (ctx: CanvasRenderingContext2D): void => {
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(200,206,225,0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(64, 64);
  ctx.moveTo(64, 0);
  ctx.lineTo(0, 64);
  ctx.stroke();
};

const drawMat = (ctx: CanvasRenderingContext2D, theme: ThemeDef): void => {
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#2b2f45");
  g.addColorStop(1, "#343957");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  ctx.strokeStyle = hex(theme.gymTrim);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 170, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- assembly

export interface Backdrop {
  /** Keep the lights and the far landmarks with the camera. `centerX` is the middle of the view. */
  update(centerX: number, cameraX: number): void;
  destroy(): void;
}

/** Build the level's 3D set into `scene`, spanning the level's length plus a margin either side. */
export const buildBackdrop = (scene: Scene, theme: ThemeDef, seed: number, levelLength: number): Backdrop => {
  const pal = PALETTES[theme.timeOfDay];
  const rng = new Rng(seed);
  const root = new Group();
  scene.add(root);
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const texs: Texture[] = [];
  const x0 = -3000;
  const x1 = levelLength + 3000;
  const span = x1 - x0;

  const tex = (c: HTMLCanvasElement, rx = 1, ry = 1): CanvasTexture => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    if (rx !== 1 || ry !== 1) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(rx, ry);
    }
    texs.push(t);
    return t;
  };
  const std = (opts: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial => {
    const m = new MeshStandardMaterial(opts);
    mats.push(m);
    return m;
  };
  const basic = (opts: ConstructorParameters<typeof MeshBasicMaterial>[0]): MeshBasicMaterial => {
    const m = new MeshBasicMaterial(opts);
    mats.push(m);
    return m;
  };
  const geo = <G extends BufferGeometry>(g: G): G => {
    geos.push(g);
    return g;
  };
  const add = (m: Mesh, shadows: "cast" | "receive" | "both" | "none" = "none"): Mesh => {
    m.castShadow = shadows === "cast" || shadows === "both";
    m.receiveShadow = shadows === "receive" || shadows === "both";
    root.add(m);
    return m;
  };
  /** A floor strip from z0 to z1 across the whole span, its texture tiled every `tile` units. */
  const floor = (z0: number, z1: number, material: MeshStandardMaterial, y = 0): Mesh => {
    const m = new Mesh(geo(new PlaneGeometry(span, z1 - z0)), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x0 + span / 2, y, (z0 + z1) / 2);
    return add(m, "receive");
  };

  // ---- lights shared by both kits
  const hemi = new HemisphereLight(pal.hemiSky, pal.hemiGround, pal.hemiIntensity);
  root.add(hemi);
  const sun = new DirectionalLight(pal.sun, pal.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(CAMERA_3D.shadowMapSize, CAMERA_3D.shadowMapSize);
  const sc = sun.shadow.camera;
  sc.left = -900;
  sc.right = 900;
  sc.top = 700;
  sc.bottom = -500;
  sc.near = 10;
  sc.far = 4000;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  root.add(sun);
  root.add(sun.target);
  const sunDir = new Vector3(...pal.sunDir).normalize();
  // A soft fill from the camera's side so faces toward the player never go black.
  const fill = new DirectionalLight(0xffffff, theme.kit === "arena" ? 0.5 : 0.45);
  root.add(fill);
  root.add(fill.target);

  const mtx = new Matrix4();
  let arch: Mesh | null = null;
  let spot: SpotLight | null = null;
  const lampGlows: Sprite[] = [];

  if (theme.kit === "street") {
    const { c: skyC, ctx: skyCtx } = makeCanvas(4, 256);
    const sky = skyCtx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBottom);
    skyCtx.fillStyle = sky;
    skyCtx.fillRect(0, 0, 4, 256);
    scene.background = tex(skyC);
    scene.fog = new Fog(new Color(pal.skyBottom), 2600, 9000);

    // far skyline: a long painted band well behind the street; perspective gives the parallax
    const { c: slC, ctx: slCtx } = makeCanvas(SKYLINE_W, 260);
    drawSkyline(slCtx, pal, rng);
    const slScale = 5;
    const sl = new Mesh(
      geo(new PlaneGeometry(span * 2, 260 * slScale)),
      basic({ map: tex(slC, (span * 2) / (SKYLINE_W * slScale), 1), transparent: true, fog: false }),
    );
    sl.position.set(x0 + span / 2, (260 * slScale) / 2 - 300, -4200);
    add(sl);

    if (theme.arch) {
      // The Arch, stylized: a steel catenary on the skyline. A landmark, not a logo.
      const w = 1500;
      const h = 1600;
      const pts: Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push(new Vector3((t - 0.5) * w, (1 - Math.pow(Math.abs(t - 0.5) * 2, 2.2)) * h, 0));
      }
      arch = new Mesh(
        geo(new TubeGeometry(new CatmullRomCurve3(pts), 80, 26, 8, false)),
        std({ color: pal.skylineLit ? 0x8f9bc0 : 0xdfe6ee, metalness: 0.85, roughness: 0.25, fog: false }),
      );
      arch.position.set(0, -200, -3600);
      add(arch);
    }

    // buildings: one box per storefront, the painted facade on its front face
    const { c: fc, ctx: fctx } = makeCanvas(FACADE_W, FACADE_H, 2);
    const roofs = drawFacade(fctx, pal, theme, rng);
    const facadeTex = tex(fc);
    const bw = FACADE_W / roofs.length;
    const fronts = roofs.map((roof, i) => {
      const t = facadeTex.clone();
      t.repeat.set(1 / roofs.length, (FACADE_H - roof) / FACADE_H);
      t.offset.set(i / roofs.length, 0);
      t.needsUpdate = true;
      texs.push(t);
      return std({ map: t, roughness: 0.9 });
    });
    const sides = pal.wall.map((w) => std({ color: new Color(w).multiplyScalar(0.7), roughness: 0.95 }));
    const roofMat = std({ color: 0x3a3640, roughness: 1 });
    const depth = 420;
    for (let bx = Math.floor(x0 / (FACADE_W * FACADE_SCALE)) * FACADE_W * FACADE_SCALE; bx < x1; bx += FACADE_W * FACADE_SCALE) {
      roofs.forEach((roof, i) => {
        const h = (FACADE_H - roof) * FACADE_SCALE;
        const side = sides[i % sides.length];
        const b = new Mesh(geo(new BoxGeometry(bw * FACADE_SCALE, h, depth)), [side, side, roofMat, roofMat, fronts[i], side]);
        b.position.set(bx + (i + 0.5) * bw * FACADE_SCALE, h / 2, WALL_Z - depth / 2);
        add(b, "both");
      });
    }

    // sidewalk, curb, street, lane markings
    const { c: swC, ctx: swCtx } = makeCanvas(256, 256);
    drawSidewalk(swCtx, pal);
    floor(WALL_Z, CURB_Z, std({ map: tex(swC, span / 256, (CURB_Z - WALL_Z) / 256), roughness: 0.95 }));
    const curb = new Mesh(geo(new BoxGeometry(span, 9, 14)), std({ color: new Color(pal.sidewalk).multiplyScalar(1.12), roughness: 0.9 }));
    curb.position.set(x0 + span / 2, 4.5, CURB_Z);
    add(curb, "both");
    const { c: asC, ctx: asCtx } = makeCanvas(256, 256);
    drawAsphalt(asCtx, pal);
    floor(CURB_Z + 7, FLOOR_NEAR, std({ map: tex(asC, span / 256, (FLOOR_NEAR - CURB_Z) / 256), roughness: 0.85 }), -2);
    const dashes = new Mesh(geo(new PlaneGeometry(90, 9)), std({ color: 0xf2c14e, roughness: 0.7 }));
    const dashMesh = new InstancedMesh(dashes.geometry, dashes.material, Math.ceil(span / 260));
    for (let i = 0; i < dashMesh.count; i++) {
      mtx.makeRotationX(-Math.PI / 2).setPosition(x0 + i * 260, -1.5, 900);
      dashMesh.setMatrixAt(i, mtx);
    }
    dashMesh.receiveShadow = true;
    root.add(dashMesh);

    // street furniture: lamp posts and hydrants along the curb
    const poleMat = std({ color: 0x1e1e26, roughness: 0.5, metalness: 0.6 });
    const bulbMat = basic({ color: pal.skylineLit ? 0xffe9a8 : 0xd9d9d9 });
    const hydrantMat = std({ color: 0xc0392b, roughness: 0.5 });
    const poleGeo = geo(new CylinderGeometry(3.5, 4.5, 330, 8));
    const armGeo = geo(new BoxGeometry(5, 5, 60));
    const headGeo = geo(new BoxGeometry(22, 8, 14));
    const hydGeo = geo(new CylinderGeometry(9, 10, 38, 10));
    const capGeo = geo(new SphereGeometry(9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
    const glowC = makeCanvas(64, 64);
    const gg = glowC.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, "rgba(255,233,168,0.9)");
    gg.addColorStop(1, "rgba(255,233,168,0)");
    glowC.ctx.fillStyle = gg;
    glowC.ctx.fillRect(0, 0, 64, 64);
    const glowMat = new SpriteMaterial({ map: tex(glowC.c), blending: AdditiveBlending, transparent: true, depthWrite: false });
    mats.push(glowMat);
    for (let x = Math.ceil(x0 / 900) * 900; x < x1; x += 900) {
      const lz = WALL_Z + 70;
      const pole = new Mesh(poleGeo, poleMat);
      pole.position.set(x, 165, lz);
      add(pole, "cast");
      const arm = new Mesh(armGeo, poleMat);
      arm.position.set(x, 328, lz + 28);
      add(arm, "cast");
      const head = new Mesh(headGeo, bulbMat);
      head.position.set(x, 320, lz + 56);
      add(head);
      if (pal.skylineLit) {
        const glow = new Sprite(glowMat);
        glow.position.set(x, 310, lz + 50);
        glow.scale.set(220, 220, 1);
        root.add(glow);
        lampGlows.push(glow);
      }
      const hx = x + 450;
      const hyd = new Mesh(hydGeo, hydrantMat);
      hyd.position.set(hx, 19, WALL_Z + 24);
      add(hyd, "cast");
      const cap = new Mesh(capGeo, hydrantMat);
      cap.position.set(hx, 38, WALL_Z + 24);
      add(cap, "cast");
    }
  } else {
    scene.background = new Color(0x07070d);
    scene.fog = new Fog(new Color(0x07070d), 2200, 6500);
    hemi.intensity = 0.55;
    sun.intensity = 0.6;

    // the mat inside the cage, a darker apron outside it
    const { c: matC, ctx: matCtx } = makeCanvas(512, 512);
    drawMat(matCtx, theme);
    floor(-70, FLOOR_NEAR, std({ map: tex(matC, span / 600, (FLOOR_NEAR + 70) / 600), roughness: 0.8 }));
    floor(-1400, -70, std({ color: 0x101018, roughness: 1 }), -1);

    // the cage along the back: chain-link panels, posts, a padded rail
    const { c: clC, ctx: clCtx } = makeCanvas(64, 64);
    drawChainLink(clCtx);
    const cageH = 260;
    const fence = new Mesh(
      geo(new PlaneGeometry(span, cageH)),
      basic({ map: tex(clC, span / 40, cageH / 40), transparent: true, alphaTest: 0.3, side: DoubleSide }),
    );
    fence.position.set(x0 + span / 2, cageH / 2, -72);
    add(fence);
    const postMat = std({ color: 0x2a2a36, roughness: 0.4, metalness: 0.7 });
    const postGeo = geo(new BoxGeometry(14, cageH + 20, 14));
    for (let x = Math.ceil(x0 / 480) * 480; x < x1; x += 480) {
      const p = new Mesh(postGeo, postMat);
      p.position.set(x, (cageH + 20) / 2, -72);
      add(p, "cast");
    }
    const rail = new Mesh(geo(new BoxGeometry(span, 22, 18)), std({ color: theme.gymTrim, roughness: 0.6 }));
    rail.position.set(x0 + span / 2, 11, -66);
    add(rail, "cast");
    const topBar = new Mesh(geo(new BoxGeometry(span, 8, 8)), postMat);
    topBar.position.set(x0 + span / 2, cageH, -72);
    add(topBar);

    // the crowd: tiers of simple figures, instanced
    const perRow = Math.ceil(span / 34);
    const rows = 5;
    const bodies = new InstancedMesh(geo(new BoxGeometry(24, 46, 18)), std({ roughness: 0.9 }), perRow * rows);
    const heads = new InstancedMesh(geo(new SphereGeometry(10, 8, 6)), std({ roughness: 0.8 }), perRow * rows);
    const col = new Color();
    let n = 0;
    for (let r = 0; r < rows; r++) {
      const z = -330 - r * 95;
      const y = 20 + r * 60;
      const tier = new Mesh(geo(new BoxGeometry(span, 20, 95)), std({ color: 0x15141d, roughness: 1 }));
      tier.position.set(x0 + span / 2, y - 23 - 10, z);
      add(tier);
      for (let i = 0; i < perRow; i++) {
        const x = x0 + i * 34 + (r % 2) * 17 + rng.int(-4, 4);
        const bounce = rng.int(-3, 3);
        mtx.makeTranslation(x, y + bounce, z + rng.int(-8, 8));
        bodies.setMatrixAt(n, mtx);
        mtx.makeTranslation(x, y + bounce + 33, z);
        heads.setMatrixAt(n, mtx);
        const v = 0.12 + r * 0.04 + rng.range(0, 0.08);
        bodies.setColorAt(n, col.setRGB(v, v * 0.9, v + 0.06 + rng.range(0, 0.1)));
        heads.setColorAt(n, col.setRGB(0.35 + rng.range(0, 0.3), 0.25 + rng.range(0, 0.2), 0.2 + rng.range(0, 0.15)));
        n++;
      }
    }
    root.add(bodies);
    root.add(heads);

    // back wall with banners
    const { c: wC, ctx: wCtx } = makeCanvas(1024, FACADE_H, 2);
    drawArenaWall(wCtx, theme);
    const wallScale = 2.8;
    const wall = new Mesh(geo(new PlaneGeometry(span, FACADE_H * wallScale)), basic({ map: tex(wC, span / (1024 * wallScale), 1) }));
    wall.position.set(x0 + span / 2, (FACADE_H * wallScale) / 2 + 40, -900);
    add(wall);

    // light beams from the rig
    const beamMat = basic({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.07,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    const beamGeo = geo(new ConeGeometry(180, 1200, 24, 1, true));
    for (let x = Math.ceil(x0 / 1100) * 1100; x < x1; x += 1100) {
      const beam = new Mesh(beamGeo, beamMat);
      beam.position.set(x, 600, -200);
      root.add(beam);
    }

    spot = new SpotLight(0xfff2d8, 9, 0, Math.PI / 5, 0.5, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(CAMERA_3D.shadowMapSize, CAMERA_3D.shadowMapSize);
    spot.shadow.camera.near = 200;
    spot.shadow.camera.far = 3500;
    spot.shadow.bias = -0.0004;
    sun.castShadow = false;
    root.add(spot);
    root.add(spot.target);
  }

  const bandMid = 75 * K;
  const update = (centerX: number, cameraX: number): void => {
    sun.target.position.set(centerX, 0, bandMid);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 1800);
    fill.target.position.set(centerX, 80, bandMid);
    fill.position.set(centerX + 200, 600, bandMid + 1500);
    if (spot) {
      spot.target.position.set(centerX, 0, bandMid);
      spot.position.set(centerX - 150, 1500, bandMid + 300);
    }
    if (arch) arch.position.x = centerX + 900 - cameraX * 0.12;
  };

  return {
    update,
    destroy: () => {
      scene.remove(root);
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
      for (const s of lampGlows) s.removeFromParent();
      scene.background = null;
      scene.fog = null;
    },
  };
};
