import Phaser from "phaser";

import { DISPLAY } from "@/content/display";
import type { ThemeDef, TimeOfDay } from "@/content/towns/stLouis";
import { Rng } from "@/shared/rng";

/**
 * Environment kits, drawn procedurally into canvas textures (the v0 stand-in for painted layers, plan §8).
 * Street kit: sky → far skyline (slow parallax) → storefront row → sidewalk and street.
 * Arena kit: back wall and banners → crowd → cage → mat.
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
  /** Multiply-style wash over the whole scene: [colour, alpha]. */
  grade: [number, number];
  windows: string;
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
    grade: [0xffe2b0, 0.06],
    windows: "#2c3e55",
  },
  noon: {
    skyTop: "#4f9be0",
    skyBottom: "#cfe8f7",
    skyline: "#8ea1b6",
    skylineLit: false,
    wall: ["#c2b59b", "#9aa7b0", "#b86b4b", "#d8c9a8"],
    sidewalk: "#c4c0b6",
    street: "#62646b",
    grade: [0xffffff, 0],
    windows: "#31455e",
  },
  afternoon: {
    skyTop: "#5a94d0",
    skyBottom: "#f2d9a6",
    skyline: "#8793a8",
    skylineLit: false,
    wall: ["#a9583f", "#c7ad86", "#7f8794", "#b5764e"],
    sidewalk: "#bdb5a6",
    street: "#5c5d63",
    grade: [0xffd08a, 0.08],
    windows: "#2f3d52",
  },
  sunset: {
    skyTop: "#3c4a8a",
    skyBottom: "#f79d5c",
    skyline: "#4a3f63",
    skylineLit: true,
    wall: ["#8c4634", "#9c7a5c", "#5e6072", "#7a3e33"],
    sidewalk: "#a3968c",
    street: "#4b4852",
    grade: [0xff8a4a, 0.14],
    windows: "#f6c56a",
  },
  dusk: {
    skyTop: "#1c2456",
    skyBottom: "#b0567a",
    skyline: "#2c2a4a",
    skylineLit: true,
    wall: ["#5d3a44", "#6d6274", "#444a66", "#57323a"],
    sidewalk: "#7c7684",
    street: "#3a394a",
    grade: [0x6a4aa8, 0.16],
    windows: "#f2c14e",
  },
  night: {
    skyTop: "#070a1e",
    skyBottom: "#24305e",
    skyline: "#161a36",
    skylineLit: true,
    wall: ["#33303f", "#3f4458", "#2a2d42", "#3b2a33"],
    sidewalk: "#565a6c",
    street: "#26283a",
    grade: [0x2a3a8a, 0.2],
    windows: "#ffd966",
  },
};

const FACADE_W = 1536;
const SKYLINE_W = 1024;
const H = DISPLAY.logicalHeight;
const FLOOR_TOP = DISPLAY.floorTop;
/** Where the storefronts meet the sidewalk. */
const WALL_BASE = FLOOR_TOP - 22;

const makeCanvas = (scene: Phaser.Scene, key: string, w: number, h: number): CanvasRenderingContext2D => {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  return tex.getContext();
};

const refresh = (scene: Phaser.Scene, key: string): void => {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
};

const drawSky = (scene: Phaser.Scene, key: string, pal: Palette, stars: boolean): void => {
  const ctx = makeCanvas(scene, key, 16, H);
  const g = ctx.createLinearGradient(0, 0, 0, WALL_BASE);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, H);
  if (stars) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(3, 30, 1, 1);
    ctx.fillRect(11, 70, 1, 1);
    ctx.fillRect(7, 120, 1, 1);
  }
  refresh(scene, key);
};

const drawSkyline = (scene: Phaser.Scene, key: string, pal: Palette, rng: Rng): void => {
  const ctx = makeCanvas(scene, key, SKYLINE_W, 260);
  let x = 0;
  while (x < SKYLINE_W) {
    const w = rng.int(38, 96);
    const h = rng.int(50, 190);
    ctx.fillStyle = pal.skyline;
    ctx.fillRect(x, 260 - h, w, h);
    if (rng.chance(0.3)) ctx.fillRect(x + w / 2 - 2, 260 - h - rng.int(10, 26), 4, 30); // antenna
    if (pal.skylineLit) {
      ctx.fillStyle = pal.windows;
      for (let wy = 260 - h + 8; wy < 250; wy += 12) {
        for (let wx = x + 6; wx < x + w - 6; wx += 10) if (rng.chance(0.35)) ctx.fillRect(wx, wy, 4, 5);
      }
    }
    x += w + rng.int(-4, 10);
  }
  refresh(scene, key);
};

/** The Arch, stylized: a tall steel catenary on the skyline. A landmark, not a logo. */
const drawArch = (scene: Phaser.Scene, key: string, lit: boolean): void => {
  const w = 300;
  const h = 300;
  const ctx = makeCanvas(scene, key, w, h);
  const outer = (t: number) => ({ x: w / 2 + (t - 0.5) * (w - 20), y: h - (1 - Math.pow(Math.abs(t - 0.5) * 2, 2.2)) * (h - 14) });
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const stroke = (color: string, width: number, dx: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const p = outer(i / 60);
      if (i === 0) ctx.moveTo(p.x + dx, p.y);
      else ctx.lineTo(p.x + dx, p.y);
    }
    ctx.stroke();
  };
  stroke(lit ? "#8f9bc0" : "#c9d2dc", 15, 0);
  stroke(lit ? "#d6defa" : "#f4f7fa", 5, -3);
  refresh(scene, key);
};

const SIGN_COLORS = ["#d62828", "#1d3fbf", "#1e7a4a", "#b5179e", "#e85d04", "#2b2b3a"];

const drawFacade = (scene: Phaser.Scene, key: string, pal: Palette, theme: ThemeDef, rng: Rng): void => {
  const top = 96;
  const ctx = makeCanvas(scene, key, FACADE_W, WALL_BASE);
  ctx.clearRect(0, 0, FACADE_W, WALL_BASE);
  const lit = pal.skylineLit;
  const count = 6;
  const bw = FACADE_W / count;
  for (let i = 0; i < count; i++) {
    const x = i * bw;
    const roof = top + rng.int(0, 60);
    const wall = pal.wall[i % pal.wall.length];
    ctx.fillStyle = wall;
    ctx.fillRect(x, roof, bw, WALL_BASE - roof);
    // brick courses
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 1;
    for (let y = roof + 8; y < WALL_BASE - 90; y += 8) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + bw, y);
      ctx.stroke();
    }
    // cornice and building edge
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x, roof, bw, 7);
    ctx.fillRect(x + bw - 3, roof, 3, WALL_BASE - roof);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x, roof + 7, bw, 3);
    // upper windows
    const cols = 3;
    for (let r = 0; r * 44 + roof + 22 < WALL_BASE - 130; r++) {
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
    // storefront
    const shopTop = WALL_BASE - 104;
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
    // door
    ctx.fillStyle = "#2a2230";
    ctx.fillRect(x + bw - 76, shopTop + 26, 54, 78);
    ctx.fillStyle = lit ? "rgba(255,217,102,0.3)" : "rgba(160,200,230,0.3)";
    ctx.fillRect(x + bw - 70, shopTop + 32, 42, 44);
    // awning or sign
    const signColor = SIGN_COLORS[(i + theme.signs.length) % SIGN_COLORS.length];
    const name = theme.signs[i % theme.signs.length];
    ctx.fillStyle = i % theme.signs.length === 0 ? `#${theme.gymColor.toString(16).padStart(6, "0")}` : signColor;
    ctx.fillRect(x + 10, shopTop, bw - 20, 26);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 10, shopTop + 22, bw - 20, 4);
    ctx.fillStyle = i % theme.signs.length === 0 ? `#${theme.gymTrim.toString(16).padStart(6, "0")}` : "#fff6e0";
    ctx.font = "bold 15px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let label = name;
    while (ctx.measureText(label).width > bw - 34 && label.length > 4) label = label.slice(0, -1);
    ctx.fillText(label, x + bw / 2, shopTop + 12);
    // street furniture
    if (i % 2 === 0) {
      // lamp post
      ctx.fillStyle = "#1e1e26";
      ctx.fillRect(x + bw - 14, WALL_BASE - 150, 5, 150);
      ctx.fillRect(x + bw - 30, WALL_BASE - 152, 22, 5);
      ctx.fillStyle = lit ? "#ffe9a8" : "#d9d9d9";
      ctx.fillRect(x + bw - 32, WALL_BASE - 148, 10, 6);
      if (lit) {
        const glow = ctx.createRadialGradient(x + bw - 27, WALL_BASE - 140, 2, x + bw - 27, WALL_BASE - 140, 70);
        glow.addColorStop(0, "rgba(255,233,168,0.42)");
        glow.addColorStop(1, "rgba(255,233,168,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x + bw - 100, WALL_BASE - 210, 146, 150);
      }
    } else {
      // hydrant
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(x + 4, WALL_BASE - 22, 10, 22);
      ctx.fillRect(x + 1, WALL_BASE - 16, 16, 5);
      ctx.fillStyle = "#e05a4c";
      ctx.fillRect(x + 5, WALL_BASE - 26, 8, 5);
    }
  }
  refresh(scene, key);
};

const drawGround = (scene: Phaser.Scene, key: string, pal: Palette): void => {
  const gh = H - WALL_BASE;
  const ctx = makeCanvas(scene, key, 256, gh);
  const curb = 74; // sidewalk depth
  ctx.fillStyle = pal.sidewalk;
  ctx.fillRect(0, 0, 256, curb);
  ctx.strokeStyle = "rgba(0,0,0,0.16)";
  ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x + 10, 0);
    ctx.lineTo(x - 6, curb);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.lineTo(256, 34);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, 256, 5); // shadow under the wall
  // curb
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(0, curb, 256, 5);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, curb + 5, 256, 6);
  // street
  ctx.fillStyle = pal.street;
  ctx.fillRect(0, curb + 11, 256, gh - curb - 11);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 53) % 256, curb + 14 + ((i * 37) % (gh - curb - 16)), 3, 1);
  ctx.fillStyle = "rgba(242,193,78,0.75)";
  ctx.fillRect(20, gh - 34, 90, 5); // lane dashes
  ctx.fillRect(148, gh - 34, 90, 5);
  refresh(scene, key);
};

// ---------------------------------------------------------------- arena

const drawArenaWall = (scene: Phaser.Scene, key: string, theme: ThemeDef): void => {
  const ctx = makeCanvas(scene, key, 1024, WALL_BASE);
  const g = ctx.createLinearGradient(0, 0, 0, WALL_BASE);
  g.addColorStop(0, "#07070d");
  g.addColorStop(1, "#1b1826");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, WALL_BASE);
  // banners
  const gold = `#${theme.gymTrim.toString(16).padStart(6, "0")}`;
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
  // spotlights
  for (let i = 0; i < 4; i++) {
    const x = 128 + i * 256;
    const cone = ctx.createLinearGradient(0, 0, 0, WALL_BASE);
    cone.addColorStop(0, "rgba(255,240,200,0.20)");
    cone.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 8, 0);
    ctx.lineTo(x + 8, 0);
    ctx.lineTo(x + 120, WALL_BASE);
    ctx.lineTo(x - 120, WALL_BASE);
    ctx.fill();
  }
  refresh(scene, key);
};

const drawCrowd = (scene: Phaser.Scene, key: string, rng: Rng): void => {
  const ctx = makeCanvas(scene, key, 1024, 150);
  ctx.clearRect(0, 0, 1024, 150);
  for (let row = 0; row < 4; row++) {
    const y = 26 + row * 26;
    const shadeV = 26 + row * 14;
    for (let x = -10 + (row % 2) * 13; x < 1024; x += 26) {
      const j = rng.int(-3, 3);
      ctx.fillStyle = `rgb(${shadeV + rng.int(0, 16)},${shadeV + rng.int(0, 10)},${shadeV + 18 + rng.int(0, 18)})`;
      ctx.beginPath();
      ctx.arc(x + 12, y + j, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x, y + 8 + j, 24, 40);
      if (rng.chance(0.14)) ctx.fillRect(x - 3, y - 22 + j, 5, 26); // raised arm
    }
  }
  refresh(scene, key);
};

const drawCage = (scene: Phaser.Scene, key: string, theme: ThemeDef): void => {
  const ctx = makeCanvas(scene, key, 256, 120);
  ctx.clearRect(0, 0, 256, 120);
  ctx.strokeStyle = "rgba(190,196,215,0.34)";
  ctx.lineWidth = 1.2;
  for (let x = -120; x < 256 + 120; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 120, 120);
    ctx.moveTo(x + 120, 0);
    ctx.lineTo(x, 120);
    ctx.stroke();
  }
  ctx.fillStyle = "#101018";
  ctx.fillRect(0, 0, 256, 7);
  ctx.fillStyle = `#${theme.gymTrim.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 112, 256, 8); // padded rail
  ctx.fillStyle = "#2a2a36";
  ctx.fillRect(122, 0, 12, 120); // post
  refresh(scene, key);
};

const drawMat = (scene: Phaser.Scene, key: string, theme: ThemeDef): void => {
  const gh = H - WALL_BASE;
  const ctx = makeCanvas(scene, key, 512, gh);
  const g = ctx.createLinearGradient(0, 0, 0, gh);
  g.addColorStop(0, "#2b2f45");
  g.addColorStop(1, "#3c4160");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, gh);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, 0, 512, 8);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x + 18, 0);
    ctx.lineTo(x - 12, gh);
    ctx.stroke();
  }
  ctx.strokeStyle = `#${theme.gymTrim.toString(16).padStart(6, "0")}`;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(256, gh * 0.55, 190, 52, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  refresh(scene, key);
};

// ---------------------------------------------------------------- assembly

export interface Backdrop {
  update(cameraX: number, viewWidth: number): void;
  destroy(): void;
}

/** Build the level's backdrop. Layers are fixed to the camera and scrolled by tile position for parallax. */
export const buildBackdrop = (scene: Phaser.Scene, theme: ThemeDef, seed: number, viewWidth: number): Backdrop => {
  const pal = PALETTES[theme.timeOfDay];
  const rng = new Rng(seed);
  const objects: Phaser.GameObjects.GameObject[] = [];
  const maxW = Math.ceil(DISPLAY.logicalHeight * DISPLAY.maxAspect) + 8;
  const layers: Array<{ sprite: Phaser.GameObjects.TileSprite; factor: number }> = [];
  const tile = (key: string, y: number, h: number, factor: number, depth: number): Phaser.GameObjects.TileSprite => {
    const s = scene.add.tileSprite(0, y, maxW, h, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    objects.push(s);
    layers.push({ sprite: s, factor });
    return s;
  };
  let arch: Phaser.GameObjects.Image | null = null;

  if (theme.kit === "street") {
    drawSky(scene, "bg-sky", pal, theme.timeOfDay === "night" || theme.timeOfDay === "dusk");
    drawSkyline(scene, "bg-skyline", pal, rng);
    drawFacade(scene, "bg-facade", pal, theme, rng);
    drawGround(scene, "bg-ground", pal);
    tile("bg-sky", 0, H, 0, -1000);
    if (theme.arch) {
      drawArch(scene, "bg-arch", pal.skylineLit);
      arch = scene.add
        .image(0, WALL_BASE - 60, "bg-arch")
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(-995)
        .setAlpha(0.92);
      objects.push(arch);
    }
    tile("bg-skyline", WALL_BASE - 260 - 40, 260, 0.12, -990);
    tile("bg-facade", 0, WALL_BASE, 1, -980);
    tile("bg-ground", WALL_BASE, H - WALL_BASE, 1, -970);
  } else {
    drawArenaWall(scene, "bg-wall", theme);
    drawCrowd(scene, "bg-crowd", rng);
    drawCage(scene, "bg-cage", theme);
    drawMat(scene, "bg-mat", theme);
    tile("bg-wall", 0, WALL_BASE, 0.2, -1000);
    tile("bg-crowd", WALL_BASE - 210, 150, 0.45, -990);
    tile("bg-cage", WALL_BASE - 120, 120, 1, -980);
    tile("bg-mat", WALL_BASE, H - WALL_BASE, 1, -970);
  }

  // Time-of-day wash over everything, fighters included.
  let grade: Phaser.GameObjects.Rectangle | null = null;
  if (pal.grade[1] > 0 && theme.kit === "street") {
    grade = scene.add.rectangle(0, 0, maxW, H, pal.grade[0], pal.grade[1]).setOrigin(0, 0).setScrollFactor(0).setDepth(900000);
    grade.setBlendMode(Phaser.BlendModes.MULTIPLY);
    objects.push(grade);
  }

  const update = (cameraX: number, vw: number): void => {
    for (const l of layers) l.sprite.tilePositionX = cameraX * l.factor;
    if (arch) arch.x = vw * 0.7 - cameraX * 0.05;
  };
  update(0, viewWidth);

  return {
    update,
    destroy: () => {
      for (const o of objects) o.destroy();
    },
  };
};
