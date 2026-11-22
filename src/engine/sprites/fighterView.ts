import Phaser from "phaser";

import type { FighterLook } from "@/content/fighters/looks";

import type { Pose } from "./poses";

const RAD = Math.PI / 180;
const OUTLINE = 0x17121c;

/** Proportions of the figure at scale 1 (about 133 px tall in the guard stance). */
const DIM = {
  thigh: 30,
  shin: 30,
  torso: 46,
  neck: 5,
  head: 12,
  upperArm: 22,
  foreArm: 21,
  thighW: 13,
  shinW: 10,
  armW: 9,
  foreArmW: 8,
  glove: 7.5,
  foot: 6,
};

interface Pt {
  x: number;
  y: number;
}

const shade = (color: number, k: number): number => {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((color & 0xff) * k));
  return (r << 16) | (g << 8) | b;
};

const toward = (color: number, target: number, t: number): number => {
  if (t <= 0) return color;
  const mixc = (a: number, b: number) => Math.round(a + (b - a) * t);
  const r = mixc((color >> 16) & 0xff, (target >> 16) & 0xff);
  const g = mixc((color >> 8) & 0xff, (target >> 8) & 0xff);
  const b = mixc(color & 0xff, target & 0xff);
  return (r << 16) | (g << 8) | b;
};

/** A point `len` out from `from` at `deg` (0 = down, positive = toward the front). */
const out = (from: Pt, deg: number, len: number): Pt => ({
  x: from.x + Math.sin(deg * RAD) * len,
  y: from.y + Math.cos(deg * RAD) * len,
});

interface Skeleton {
  hip: Pt;
  chest: Pt;
  shoulder: Pt;
  head: Pt;
  elbowF: Pt;
  handF: Pt;
  elbowB: Pt;
  handB: Pt;
  kneeF: Pt;
  footF: Pt;
  kneeB: Pt;
  footB: Pt;
}

const solve = (p: Pose): Skeleton => {
  const hip: Pt = { x: 0, y: 0 };
  const up = 180 - p.torso; // torso points up, leaning forward by `torso`
  const shoulder = out(hip, up, DIM.torso);
  const chest = out(hip, up, DIM.torso * 0.6);
  const head = out(shoulder, up - p.head, DIM.neck + DIM.head);
  const elbowF = out(shoulder, p.shF, DIM.upperArm);
  const handF = out(elbowF, p.shF + p.elF, DIM.foreArm);
  const elbowB = out(shoulder, p.shB, DIM.upperArm);
  const handB = out(elbowB, p.shB + p.elB, DIM.foreArm);
  const hipF: Pt = { x: 3, y: 0 };
  const hipB: Pt = { x: -3, y: 0 };
  const kneeF = out(hipF, p.hipF, DIM.thigh);
  const footF = out(kneeF, p.hipF - p.knF, DIM.shin);
  const kneeB = out(hipB, p.hipB, DIM.thigh);
  const footB = out(kneeB, p.hipB - p.knB, DIM.shin);
  const sk: Skeleton = { hip, chest, shoulder, head, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };

  // Whole-body rotation (falls), then drop the figure so its lowest point rests on the ground.
  const c = Math.cos(p.rot * RAD);
  const s = Math.sin(p.rot * RAD);
  let lowest = -Infinity;
  for (const key of Object.keys(sk) as Array<keyof Skeleton>) {
    const pt = sk[key];
    const x = pt.x * c - pt.y * s;
    const y = pt.x * s + pt.y * c;
    pt.x = x * p.turn;
    pt.y = y;
    const pad = key === "head" ? DIM.head : key.startsWith("foot") ? DIM.foot * 0.6 : 5;
    if (y + pad > lowest) lowest = y + pad;
  }
  for (const key of Object.keys(sk) as Array<keyof Skeleton>) sk[key].y -= lowest + p.lift;
  return sk;
};

export interface DrawOptions {
  /** 0–1: whiten for a hit flash. */
  flash: number;
  /** Armband colour, or null for none. */
  armband: number | null;
  /** Gold glow for armored bosses, etc. */
  aura: number | null;
}

const capsule = (g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, w: number, color: number): void => {
  g.lineStyle(w, color, 1);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.fillStyle(color, 1);
  g.fillCircle(a.x, a.y, w / 2);
  g.fillCircle(b.x, b.y, w / 2);
};

const limb = (g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, w: number, color: number): void => {
  capsule(g, a, b, w + 3.5, OUTLINE);
  capsule(g, a, b, w, color);
  // A lighter strip along the limb reads as a rounded, lit form — the "3D look" without sprites.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w * 0.2;
  const ny = (dx / len) * w * 0.2;
  const sgn = ny > 0 ? -1 : 1;
  g.lineStyle(w * 0.28, shade(color, 1.22), 0.9);
  g.lineBetween(a.x + nx * sgn, a.y + ny * sgn, b.x + nx * sgn, b.y + ny * sgn);
};

const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * A limb with a muscle belly between t0 and t1, `swell` times its width. The belly's outline sits under the
 * limb and its fill on top, so the bulge reads as one shape with the limb.
 */
const muscleLimb = (
  g: Phaser.GameObjects.Graphics,
  a: Pt,
  b: Pt,
  w: number,
  color: number,
  t0: number,
  t1: number,
  swell: number,
): void => {
  if (swell <= 1) {
    limb(g, a, b, w, color);
    return;
  }
  const p0 = lerpPt(a, b, t0);
  const p1 = lerpPt(a, b, t1);
  const bw = w * swell;
  capsule(g, p0, p1, bw + 3.5, OUTLINE);
  limb(g, a, b, w, color);
  capsule(g, p0, p1, bw, color);
  // the lit side of the belly
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const sgn = dx / len > 0 ? -1 : 1;
  const nx = (-dy / len) * bw * 0.22 * sgn;
  const ny = (dx / len) * bw * 0.22 * sgn;
  g.lineStyle(bw * 0.26, shade(color, 1.2), 0.85);
  g.lineBetween(p0.x + nx, p0.y + ny, p1.x + nx, p1.y + ny);
};

/** Unit direction and unit normal of the segment a→b. */
const frame = (a: Pt, b: Pt): { ux: number; uy: number; nx: number; ny: number } => {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return { ux, uy, nx: -uy, ny: ux };
};

/** A tattooed band along a limb from t0 to t1: an edge ring at each end and a zigzag between. */
const inkBand = (g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, t0: number, t1: number, w: number, ink: number): void => {
  const { nx, ny } = frame(a, b);
  const half = w * 0.42;
  const p0 = lerpPt(a, b, t0);
  const p1 = lerpPt(a, b, t1);
  g.lineStyle(1.8, ink, 0.9);
  g.lineBetween(p0.x - nx * half, p0.y - ny * half, p0.x + nx * half, p0.y + ny * half);
  g.lineBetween(p1.x - nx * half, p1.y - ny * half, p1.x + nx * half, p1.y + ny * half);
  const steps = 5;
  g.lineStyle(1.5, ink, 0.85);
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const q = lerpPt(p0, p1, i / steps);
    const side = (i % 2 === 0 ? -1 : 1) * half * 0.75;
    if (i === 0) g.moveTo(q.x + nx * side, q.y + ny * side);
    else g.lineTo(q.x + nx * side, q.y + ny * side);
  }
  g.strokePath();
};

/** An original geometric chest piece: a diamond with a centre dot and three rays above it. */
const chestPiece = (g: Phaser.GameObjects.Graphics, hip: Pt, shoulder: Pt, w: number, ink: number): void => {
  const { ux, uy, nx, ny } = frame(hip, shoulder);
  const c = lerpPt(hip, shoulder, 0.68);
  const r = w * 0.22;
  const pt = (along: number, across: number): Pt => ({ x: c.x + ux * along + nx * across, y: c.y + uy * along + ny * across });
  const top = pt(r * 1.3, 0);
  const right = pt(0, r);
  const bottom = pt(-r * 1.3, 0);
  const left = pt(0, -r);
  g.lineStyle(1.6, ink, 0.85);
  g.strokePoints([top, right, bottom, left], true);
  g.fillStyle(ink, 0.9);
  g.fillCircle(c.x, c.y, 1.6);
  for (const across of [-r * 0.8, 0, r * 0.8]) {
    const from = pt(r * 1.6, across * 0.6);
    const to = pt(r * 2.6, across);
    g.lineBetween(from.x, from.y, to.x, to.y);
  }
};

/** Pec line and a six-pack, shaded into the torso. */
const torsoMuscles = (g: Phaser.GameObjects.Graphics, hip: Pt, shoulder: Pt, w: number, color: number, m: number): void => {
  const { ux, uy, nx, ny } = frame(hip, shoulder);
  const at = (t: number, across: number): Pt => {
    const p = lerpPt(hip, shoulder, t);
    return { x: p.x + nx * across, y: p.y + ny * across };
  };
  g.lineStyle(1.8, color, 0.55 + 0.35 * m);
  // pecs: two shallow arcs meeting at the sternum
  for (const side of [-1, 1]) {
    const inner = at(0.8, 0);
    const mid = at(0.78, side * w * 0.22);
    const outer = at(0.86, side * w * 0.42);
    g.lineBetween(inner.x, inner.y, mid.x, mid.y);
    g.lineBetween(mid.x, mid.y, outer.x, outer.y);
  }
  // abs: a centre line and three rungs
  const top = at(0.56, 0);
  const bottom = at(0.32, 0);
  g.lineBetween(top.x, top.y, bottom.x, bottom.y);
  g.lineStyle(1.4, color, 0.45 + 0.35 * m);
  for (const t of [0.38, 0.45, 0.52]) {
    const l = at(t, -w * 0.2);
    const r = at(t, w * 0.2);
    g.lineBetween(l.x + ux * 0.5, l.y + uy * 0.5, r.x + ux * 0.5, r.y + uy * 0.5);
  }
};

/** A glove at `hand`, its forearm coming from `elbow`. */
const glove = (
  g: Phaser.GameObjects.Graphics,
  elbow: Pt,
  hand: Pt,
  r: number,
  color: number,
  skin: number,
  style: FighterLook["gloveStyle"],
  shine: boolean,
): void => {
  if (style !== "mma") {
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(hand.x, hand.y, r + 1.8);
    g.fillStyle(color, 1);
    g.fillCircle(hand.x, hand.y, r);
    if (shine) {
      g.fillStyle(shade(color, 1.3), 0.9);
      g.fillCircle(hand.x - 1.5, hand.y - 2, r * 0.36);
    }
    return;
  }
  // Open-finger MMA glove: a slim knuckle pad, bare fingers curled under it, a strap at the wrist.
  const dx = hand.x - elbow.x;
  const dy = hand.y - elbow.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const at = (k: number): Pt => ({ x: hand.x + ux * k, y: hand.y + uy * k });
  const pad = r * 0.78;
  // fingers peek out past the pad
  capsule(g, at(pad * 0.2), at(pad * 0.95), pad * 1.05 + 2.4, OUTLINE);
  capsule(g, at(pad * 0.2), at(pad * 0.95), pad * 1.05, skin);
  // wrist cuff
  capsule(g, at(-pad * 1.25), at(-pad * 0.35), pad * 1.5 + 3, OUTLINE);
  capsule(g, at(-pad * 1.25), at(-pad * 0.35), pad * 1.5, color);
  // knuckle pad
  g.fillStyle(OUTLINE, 1);
  g.fillCircle(hand.x, hand.y, pad + 1.8);
  g.fillStyle(color, 1);
  g.fillCircle(hand.x, hand.y, pad);
  // strap stitching and a soft highlight so black still reads as padded
  const strap = toward(color, 0xffffff, 0.32);
  const s0 = at(-pad * 0.8);
  g.lineStyle(1.6, strap, 0.9);
  g.lineBetween(s0.x - uy * pad * 0.75, s0.y + ux * pad * 0.75, s0.x + uy * pad * 0.75, s0.y - ux * pad * 0.75);
  if (shine) {
    g.fillStyle(toward(color, 0xffffff, 0.22), 0.9);
    g.fillCircle(hand.x - 1.2, hand.y - 1.6, pad * 0.34);
  }
};

/** Draw one fighter into `g` with its feet at the origin, facing right. */
export const drawFighter = (g: Phaser.GameObjects.Graphics, pose: Pose, look: FighterLook, opts: DrawOptions): void => {
  const sk = solve(pose);
  const bulk = look.bulk;
  const m = look.muscle ?? 0;
  const bicep = 1 + 0.42 * m;
  const calf = 1 + 0.3 * m;
  const quad = 1 + 0.15 * m;
  const white = 0xffffff;
  const c = (color: number) => toward(color, white, opts.flash);
  const skin = c(look.skin);
  const skinFar = c(shade(look.skin, 0.74));
  const shorts = c(look.shorts);
  const shortsFar = c(shade(look.shorts, 0.72));
  const trim = c(look.trim);
  const gloves = c(look.gloves);
  const glovesFar = c(shade(look.gloves, 0.74));

  g.clear();

  if (opts.aura !== null) {
    g.fillStyle(opts.aura, 0.16);
    g.fillEllipse(sk.chest.x, sk.chest.y, 92 * bulk, 150);
  }

  // --- far side: lead arm and lead leg
  muscleLimb(g, sk.hip, sk.kneeF, DIM.thighW * bulk, skinFar, 0.3, 0.7, quad);
  muscleLimb(g, sk.kneeF, sk.footF, DIM.shinW * bulk, skinFar, 0.12, 0.42, calf);
  capsule(g, sk.footF, { x: sk.footF.x + 7 * pose.turn, y: sk.footF.y + 1 }, DIM.foot + 3, OUTLINE);
  capsule(g, sk.footF, { x: sk.footF.x + 7 * pose.turn, y: sk.footF.y + 1 }, DIM.foot, skinFar);
  capsule(g, sk.hip, lerpPt(sk.hip, sk.kneeF, 0.55), (DIM.thighW + 5) * bulk, shortsFar);
  muscleLimb(g, sk.shoulder, sk.elbowF, DIM.armW * bulk, skinFar, 0.3, 0.68, bicep);
  muscleLimb(g, sk.elbowF, sk.handF, DIM.foreArmW * bulk, skinFar, 0.1, 0.4, calf);
  if (look.tattoo !== undefined) {
    const inkFar = c(shade(look.tattoo, 0.8));
    inkBand(g, sk.shoulder, sk.elbowF, 0.2, 0.85, DIM.armW * bulk, inkFar);
    inkBand(g, sk.elbowF, sk.handF, 0.15, 0.45, DIM.foreArmW * bulk, inkFar);
  }
  glove(g, sk.elbowF, sk.handF, DIM.glove * bulk, glovesFar, skinFar, look.gloveStyle, false);

  // --- torso
  const torsoW = 21 * bulk * (1 + 0.1 * m);
  capsule(g, sk.hip, sk.shoulder, torsoW + 4, OUTLINE);
  capsule(g, sk.hip, sk.shoulder, torsoW, skin);
  g.lineStyle(torsoW * 0.3, c(shade(look.skin, 1.16)), 0.9);
  const tl = lerpPt(sk.hip, sk.shoulder, 0.3);
  g.lineBetween(tl.x + 3 * pose.turn, tl.y, sk.shoulder.x + 3 * pose.turn, sk.shoulder.y + 4);
  if (m > 0) torsoMuscles(g, sk.hip, sk.shoulder, torsoW, c(shade(look.skin, 0.72)), m);
  if (look.tattoo !== undefined) chestPiece(g, sk.hip, sk.shoulder, torsoW, c(look.tattoo));
  // shorts: waistband to mid-thigh
  const waist = lerpPt(sk.hip, sk.shoulder, 0.2);
  capsule(g, sk.hip, waist, torsoW + 3, shorts);
  g.lineStyle(3.2, trim, 1);
  const wb = lerpPt(sk.hip, sk.shoulder, 0.27);
  const wdx = sk.shoulder.y - sk.hip.y;
  const wdy = -(sk.shoulder.x - sk.hip.x);
  const wl = Math.hypot(wdx, wdy) || 1;
  g.lineBetween(
    wb.x - (wdx / wl) * torsoW * 0.5,
    wb.y - (wdy / wl) * torsoW * 0.5,
    wb.x + (wdx / wl) * torsoW * 0.5,
    wb.y + (wdy / wl) * torsoW * 0.5,
  );

  // --- head
  const hr = DIM.head * (0.96 + 0.06 * bulk);
  g.fillStyle(OUTLINE, 1);
  g.fillCircle(sk.head.x, sk.head.y, hr + 2);
  g.fillStyle(skin, 1);
  g.fillCircle(sk.head.x, sk.head.y, hr);
  const hair = c(look.hair);
  const face = pose.turn >= 0 ? 1 : -1;
  if (look.hairStyle !== "bald") {
    g.fillStyle(hair, 1);
    g.slice(sk.head.x, sk.head.y, hr, Math.PI * (face > 0 ? 0.95 : 1.55), Math.PI * (face > 0 ? 1.95 : 2.55) - Math.PI * 0.5, false);
    g.fillPath();
    g.fillCircle(sk.head.x - face * hr * 0.45, sk.head.y - hr * 0.5, hr * 0.62);
  }
  if (look.hairStyle === "mohawk") {
    g.fillStyle(hair, 1);
    g.fillEllipse(sk.head.x - face * 2, sk.head.y - hr - 2, hr * 1.5, 8);
  } else if (look.hairStyle === "bun") {
    g.fillStyle(hair, 1);
    g.fillCircle(sk.head.x - face * (hr + 1), sk.head.y - hr * 0.5, 5.5);
  } else if (look.hairStyle === "headband") {
    // The mongkhon: a band across the brow with a tail at the back.
    g.lineStyle(3.4, trim, 1);
    g.lineBetween(sk.head.x - face * hr * 0.95, sk.head.y - hr * 0.38, sk.head.x + face * hr * 0.95, sk.head.y - hr * 0.38);
    g.lineBetween(sk.head.x - face * hr * 0.95, sk.head.y - hr * 0.38, sk.head.x - face * (hr + 9), sk.head.y - hr * 0.1);
  }
  // eye and brow give the head a facing
  g.fillStyle(OUTLINE, 1);
  g.fillCircle(sk.head.x + face * hr * 0.48, sk.head.y - hr * 0.08, 1.7);
  g.lineStyle(1.8, OUTLINE, 1);
  g.lineBetween(sk.head.x + face * hr * 0.22, sk.head.y - hr * 0.32, sk.head.x + face * hr * 0.75, sk.head.y - hr * 0.22);

  // --- near side: rear leg and rear arm
  muscleLimb(g, sk.hip, sk.kneeB, DIM.thighW * bulk, skin, 0.3, 0.7, quad);
  muscleLimb(g, sk.kneeB, sk.footB, DIM.shinW * bulk, skin, 0.12, 0.42, calf);
  if (look.tattoo !== undefined) inkBand(g, sk.kneeB, sk.footB, 0.25, 0.55, DIM.shinW * bulk, c(look.tattoo));
  capsule(g, sk.footB, { x: sk.footB.x + 7 * pose.turn, y: sk.footB.y + 1 }, DIM.foot + 3, OUTLINE);
  capsule(g, sk.footB, { x: sk.footB.x + 7 * pose.turn, y: sk.footB.y + 1 }, DIM.foot, skin);
  const shortEnd = lerpPt(sk.hip, sk.kneeB, 0.58);
  capsule(g, sk.hip, shortEnd, (DIM.thighW + 5) * bulk, shorts);
  g.lineStyle(2.6, trim, 1);
  g.lineBetween(shortEnd.x - 6 * bulk, shortEnd.y, shortEnd.x + 6 * bulk, shortEnd.y);
  if (m > 0) {
    // deltoid: a round cap on the near shoulder
    const delt = lerpPt(sk.shoulder, sk.elbowB, 0.08);
    const dr = DIM.armW * bulk * (0.62 + 0.18 * m);
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(delt.x, delt.y, dr + 1.8);
    g.fillStyle(skin, 1);
    g.fillCircle(delt.x, delt.y, dr);
  }
  muscleLimb(g, sk.shoulder, sk.elbowB, DIM.armW * bulk, skin, 0.3, 0.68, bicep);
  if (look.tattoo !== undefined) inkBand(g, sk.shoulder, sk.elbowB, 0.15, 0.85, DIM.armW * bulk, c(look.tattoo));
  if (opts.armband !== null) {
    const a0 = lerpPt(sk.shoulder, sk.elbowB, 0.35);
    const a1 = lerpPt(sk.shoulder, sk.elbowB, 0.6);
    capsule(g, a0, a1, DIM.armW * bulk + 3, OUTLINE);
    capsule(g, a0, a1, DIM.armW * bulk + 1, c(opts.armband));
  }
  muscleLimb(g, sk.elbowB, sk.handB, DIM.foreArmW * bulk, skin, 0.1, 0.4, calf);
  if (look.tattoo !== undefined) inkBand(g, sk.elbowB, sk.handB, 0.15, 0.45, DIM.foreArmW * bulk, c(look.tattoo));
  glove(g, sk.elbowB, sk.handB, DIM.glove * bulk, gloves, skin, look.gloveStyle, true);
};
