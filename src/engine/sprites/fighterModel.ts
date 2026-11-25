import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";

import type { FighterLook } from "@/content/fighters/looks";

import type { Pose } from "./poses";

const RAD = Math.PI / 180;

/** Proportions of the figure at scale 1 (about 133 units tall in the guard stance). */
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

/** A point `len` out from `from` at `deg` (0 = down, positive = toward the front), y down. */
const out = (from: Pt, deg: number, len: number): Pt => ({
  x: from.x + Math.sin(deg * RAD) * len,
  y: from.y + Math.cos(deg * RAD) * len,
});

/**
 * Solve the pose's joint angles into points in the body's side plane (x forward, y down), then rotate the
 * whole body for falls and drop it so its lowest point rests on the floor. Spins (`turn`) are applied in 3D
 * as a turn about the vertical axis, not here.
 */
const solve = (p: Pose): Skeleton => {
  const hip: Pt = { x: 0, y: 0 };
  const up = 180 - p.torso;
  const shoulder = out(hip, up, DIM.torso);
  const chest = out(hip, up, DIM.torso * 0.6);
  const head = out(shoulder, up - p.head, DIM.neck + DIM.head);
  const elbowF = out(shoulder, p.shF, DIM.upperArm);
  const handF = out(elbowF, p.shF + p.elF, DIM.foreArm);
  const elbowB = out(shoulder, p.shB, DIM.upperArm);
  const handB = out(elbowB, p.shB + p.elB, DIM.foreArm);
  const kneeF = out({ x: 3, y: 0 }, p.hipF, DIM.thigh);
  const footF = out(kneeF, p.hipF - p.knF, DIM.shin);
  const kneeB = out({ x: -3, y: 0 }, p.hipB, DIM.thigh);
  const footB = out(kneeB, p.hipB - p.knB, DIM.shin);
  const sk: Skeleton = { hip, chest, shoulder, head, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };

  const c = Math.cos(p.rot * RAD);
  const s = Math.sin(p.rot * RAD);
  let lowest = -Infinity;
  for (const key of Object.keys(sk) as Array<keyof Skeleton>) {
    const pt = sk[key];
    const x = pt.x * c - pt.y * s;
    const y = pt.x * s + pt.y * c;
    pt.x = x;
    pt.y = y;
    const pad = key === "head" ? DIM.head : key.startsWith("foot") ? DIM.foot * 0.6 : 5;
    if (y + pad > lowest) lowest = y + pad;
  }
  for (const key of Object.keys(sk) as Array<keyof Skeleton>) sk[key].y -= lowest + p.lift;
  return sk;
};

// ---------------------------------------------------------------- shared geometry

const CYL = new CylinderGeometry(1, 1, 1, 12, 1);
const SPH = new SphereGeometry(1, 16, 12);
const CAP = new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
const BOX = new BoxGeometry(1, 1, 1);
const UP = new Vector3(0, 1, 0);
const dir = new Vector3();

/** Stretch a unit cylinder (or ellipsoid) from a to b. */
const alongSeg = (m: Object3D, a: Vector3, b: Vector3, rx: number, rz = rx, t0 = 0, t1 = 1): void => {
  dir.subVectors(b, a);
  const len = dir.length() || 0.001;
  dir.divideScalar(len);
  const mid = (t0 + t1) / 2;
  m.position.set(a.x + (b.x - a.x) * mid, a.y + (b.y - a.y) * mid, a.z + (b.z - a.z) * mid);
  m.quaternion.setFromUnitVectors(UP, dir);
  m.scale.set(rx, len * (t1 - t0), rz);
};

const ball = (m: Object3D, p: Vector3, r: number): void => {
  m.position.copy(p);
  m.scale.setScalar(r);
};

export interface ModelOptions {
  /** 0–1: whiten for a hit flash. */
  flash: number;
  /** Armband colour, or null for none. */
  armband: number | null;
  /** Glow colour for armored or invulnerable bosses, or null. */
  aura: number | null;
  /** 0–1 visibility, for blinking out on a KO. */
  alpha: number;
}

interface Limb {
  upper: Mesh;
  belly: Mesh;
  joint: Mesh;
  lower: Mesh;
  lowerBelly: Mesh;
}

/**
 * A fighter built from lit primitives: the real-time 3D stand-in for the rigged models of plan §8.
 * The figure is posed every frame from the same joint-angle tables the 2D figure used, so every strike's
 * pose stays data in `poses.ts`. Feet rest at the origin; +x is the way the fighter faces; +z is toward the
 * camera, so the lead (F) side sits at -z and the rear (B) side at +z.
 */
export class FighterModel {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly headGroup = new Group();
  private readonly mats: MeshStandardMaterial[] = [];
  private readonly skin: MeshStandardMaterial;
  private readonly armbandMat: MeshStandardMaterial;
  private readonly auraMat = new MeshBasicMaterial({ transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false });
  private readonly aura: Mesh;
  private readonly armband: Mesh;
  private readonly armF: Limb;
  private readonly armB: Limb;
  private readonly legF: Limb;
  private readonly legB: Limb;
  private readonly parts: Record<string, Mesh> = {};
  private readonly inkRings: Array<{ m: Mesh; limb: "armF" | "armB" | "foreF" | "foreB" | "shinB"; t0: number; t1: number }> = [];
  private readonly bulk: number;
  private readonly muscle: number;
  private lastAlpha = 1;

  constructor(private readonly look: FighterLook) {
    this.bulk = look.bulk;
    this.muscle = look.muscle ?? 0;
    const mat = (color: number, roughness = 0.6, metalness = 0): MeshStandardMaterial => {
      const m = new MeshStandardMaterial({ color, roughness, metalness });
      this.mats.push(m);
      return m;
    };
    this.skin = mat(look.skin, 0.52);
    const shorts = mat(look.shorts, 0.75);
    const trim = mat(look.trim, 0.5);
    const gloves = mat(look.gloves, 0.32);
    const hair = mat(look.hair, 0.85);
    const dark = mat(0x17121c, 0.4);
    const ink = look.tattoo !== undefined ? mat(look.tattoo, 0.6) : null;
    this.armbandMat = mat(0xffffff, 0.6);

    const mesh = (geo: CylinderGeometry | SphereGeometry | BoxGeometry, m: MeshStandardMaterial, parent: Object3D = this.body): Mesh => {
      const x = new Mesh(geo, m);
      x.castShadow = true;
      x.receiveShadow = true;
      parent.add(x);
      return x;
    };
    const limb = (m: MeshStandardMaterial): Limb => ({
      upper: mesh(CYL, m),
      belly: mesh(SPH, m),
      joint: mesh(SPH, m),
      lower: mesh(CYL, m),
      lowerBelly: mesh(SPH, m),
    });

    this.legF = limb(this.skin);
    this.legB = limb(this.skin);
    this.armF = limb(this.skin);
    this.armB = limb(this.skin);
    const P = this.parts;
    P.footF = mesh(SPH, this.skin);
    P.footB = mesh(SPH, this.skin);
    P.shortF = mesh(CYL, shorts);
    P.shortB = mesh(CYL, shorts);
    P.hemF = mesh(CYL, trim);
    P.hemB = mesh(CYL, trim);
    P.pelvis = mesh(SPH, shorts);
    P.waist = mesh(CYL, trim);
    P.abdomen = mesh(SPH, this.skin);
    P.chest = mesh(SPH, this.skin);
    P.deltF = mesh(SPH, this.skin);
    P.deltB = mesh(SPH, this.skin);
    P.neck = mesh(CYL, this.skin);
    P.gloveF = mesh(SPH, gloves);
    P.gloveB = mesh(SPH, gloves);
    if (look.gloveStyle === "mma") {
      P.cuffF = mesh(CYL, gloves);
      P.cuffB = mesh(CYL, gloves);
      P.fingersF = mesh(SPH, this.skin);
      P.fingersB = mesh(SPH, this.skin);
    }
    this.armband = mesh(CYL, this.armbandMat);
    if (ink) {
      this.inkRings.push(
        { m: mesh(CYL, ink), limb: "armF", t0: 0.25, t1: 0.33 },
        { m: mesh(CYL, ink), limb: "armF", t0: 0.6, t1: 0.68 },
        { m: mesh(CYL, ink), limb: "armB", t0: 0.18, t1: 0.26 },
        { m: mesh(CYL, ink), limb: "armB", t0: 0.72, t1: 0.82 },
        { m: mesh(CYL, ink), limb: "foreF", t0: 0.2, t1: 0.3 },
        { m: mesh(CYL, ink), limb: "foreB", t0: 0.2, t1: 0.3 },
        { m: mesh(CYL, ink), limb: "shinB", t0: 0.3, t1: 0.42 },
      );
      P.chestInk = mesh(BOX, ink);
    }

    // head: a sphere with a nose and eyes, and hair by style
    const hr = DIM.head * (0.96 + 0.06 * this.bulk);
    this.body.add(this.headGroup);
    const head = mesh(SPH, this.skin, this.headGroup);
    head.scale.set(hr * 0.98, hr * 1.05, hr * 0.9);
    const nose = mesh(SPH, this.skin, this.headGroup);
    nose.position.set(hr * 0.92, -hr * 0.12, 0);
    nose.scale.set(hr * 0.2, hr * 0.24, hr * 0.16);
    for (const side of [-1, 1]) {
      const eye = mesh(SPH, dark, this.headGroup);
      eye.castShadow = false;
      eye.position.set(hr * 0.8, hr * 0.12, side * hr * 0.36);
      eye.scale.set(hr * 0.12, hr * 0.14, hr * 0.12);
      const brow = mesh(BOX, hair, this.headGroup);
      brow.castShadow = false;
      brow.position.set(hr * 0.84, hr * 0.34, side * hr * 0.36);
      brow.scale.set(hr * 0.12, hr * 0.1, hr * 0.4);
      brow.rotation.y = side * 0.25;
    }
    if (look.hairStyle !== "bald") {
      const cap = mesh(CAP, hair, this.headGroup);
      cap.scale.set(hr * 1.06, hr * 1.08, hr * 0.98);
      cap.rotation.z = 0.55; // back of the head, clear of the face
    }
    if (look.hairStyle === "mohawk") {
      const crest = mesh(SPH, hair, this.headGroup);
      crest.position.set(-hr * 0.1, hr * 0.95, 0);
      crest.scale.set(hr * 0.95, hr * 0.45, hr * 0.2);
    } else if (look.hairStyle === "bun") {
      const bun = mesh(SPH, hair, this.headGroup);
      bun.position.set(-hr * 0.95, hr * 0.55, 0);
      bun.scale.setScalar(hr * 0.42);
    } else if (look.hairStyle === "headband") {
      // the mongkhon: a band round the brow with a tail at the back
      const band = mesh(CYL, trim, this.headGroup);
      band.position.set(0, hr * 0.38, 0);
      band.scale.set(hr * 1.03, 3.6, hr * 0.96);
      band.rotation.z = -0.12;
      const tail = mesh(BOX, trim, this.headGroup);
      tail.position.set(-hr * 1.35, hr * 0.2, 0);
      tail.scale.set(hr * 0.8, 2.6, 4);
      tail.rotation.z = 0.35;
    }

    this.auraMat.color = new Color(0xf2c14e);
    this.aura = new Mesh(SPH, this.auraMat);
    this.aura.visible = false;
    this.body.add(this.aura);

    this.group.add(this.body);
  }

  /** Pose the figure for this frame. */
  update(pose: Pose, opts: ModelOptions): void {
    const sk = solve(pose);
    const bulk = this.bulk;
    const m = this.muscle;
    const shoulderZ = 16 * bulk;
    const hipZ = 7 * bulk;
    const v = (p: Pt, z: number): Vector3 => new Vector3(p.x, -p.y, z);

    // spins turn the body about the vertical axis
    this.body.rotation.y = ((1 - pose.turn) / 2) * Math.PI;

    const hip = v(sk.hip, 0);
    const shoulder = v(sk.shoulder, 0);
    const torsoW = 21 * bulk * (1 + 0.1 * m);
    const P = this.parts;

    // torso: abdomen, chest, pelvis in shorts, waistband
    alongSeg(P.abdomen, hip, shoulder, torsoW * 0.5, torsoW * 0.66, 0.12, 0.6);
    P.abdomen.scale.y *= 0.62;
    alongSeg(P.chest, hip, shoulder, torsoW * 0.58, shoulderZ * 1.02, 0.45, 1.02);
    P.chest.scale.y *= 0.56;
    alongSeg(P.pelvis, hip, shoulder, torsoW * 0.56, hipZ * 2.1, -0.12, 0.3);
    P.pelvis.scale.y *= 0.6;
    alongSeg(P.waist, hip, shoulder, torsoW * 0.57, torsoW * 0.72, 0.24, 0.3);
    if (P.chestInk) {
      alongSeg(P.chestInk, hip, shoulder, 1, 1, 0.66, 0.7);
      const n = new Vector3().subVectors(shoulder, hip).normalize();
      // a diamond on the chest, facing forward
      P.chestInk.position.add(new Vector3(n.y, -n.x, 0).multiplyScalar(torsoW * 0.56));
      P.chestInk.scale.set(1.2, 7, 7);
      P.chestInk.rotateX(Math.PI / 4);
    }

    // neck and head
    const head = v(sk.head, 0);
    alongSeg(P.neck, shoulder, head, 4.5 * bulk, 4.5 * bulk, 0, 0.6);
    this.headGroup.position.copy(head);
    this.headGroup.rotation.set(0, 0, -(pose.torso + pose.head + pose.rot) * RAD);

    // legs: lead (far) and rear (near)
    this.poseLeg(this.legF, P.footF, P.shortF, P.hemF, v({ x: 3, y: sk.hip.y }, -hipZ), sk.kneeF, sk.footF, -hipZ, bulk, m);
    this.poseLeg(this.legB, P.footB, P.shortB, P.hemB, v({ x: -3, y: sk.hip.y }, hipZ), sk.kneeB, sk.footB, hipZ, bulk, m);

    // arms
    const shF = v(sk.shoulder, -shoulderZ);
    const shB = v(sk.shoulder, shoulderZ);
    const elF = v(sk.elbowF, -shoulderZ * 0.85);
    const elB = v(sk.elbowB, shoulderZ * 0.85);
    const haF = v(sk.handF, -shoulderZ * 0.35);
    const haB = v(sk.handB, shoulderZ * 0.35);
    this.poseArm(this.armF, shF, elF, haF, bulk, m);
    this.poseArm(this.armB, shB, elB, haB, bulk, m);
    ball(P.deltF, shF, DIM.armW * bulk * (0.68 + 0.2 * m));
    ball(P.deltB, shB, DIM.armW * bulk * (0.68 + 0.2 * m));
    this.poseGlove("F", elF, haF);
    this.poseGlove("B", elB, haB);

    for (const r of this.inkRings) {
      const [a, b, w] =
        r.limb === "armF"
          ? [shF, elF, DIM.armW]
          : r.limb === "armB"
            ? [shB, elB, DIM.armW]
            : r.limb === "foreF"
              ? [elF, haF, DIM.foreArmW]
              : r.limb === "foreB"
                ? [elB, haB, DIM.foreArmW]
                : [v(sk.kneeB, hipZ * 1.1), v(sk.footB, hipZ * 1.25), DIM.shinW];
      const k = r.limb === "armF" || r.limb === "armB" ? 1 + 0.25 * m : 1;
      alongSeg(r.m, a, b, (w / 2) * bulk * k + 0.6, (w / 2) * bulk * k + 0.6, r.t0, r.t1);
    }

    this.armband.visible = opts.armband !== null;
    if (opts.armband !== null) {
      this.armbandMat.color.setHex(opts.armband);
      alongSeg(
        this.armband,
        shB,
        elB,
        (DIM.armW / 2) * bulk * (1 + 0.3 * m) + 1.4,
        (DIM.armW / 2) * bulk * (1 + 0.3 * m) + 1.4,
        0.38,
        0.56,
      );
    }

    this.aura.visible = opts.aura !== null;
    if (opts.aura !== null) {
      this.auraMat.color.setHex(opts.aura);
      this.aura.position.copy(v(sk.chest, 0));
      this.aura.scale.set(46 * bulk, 78, 40 * bulk);
    }

    for (const mat of this.mats) mat.emissive.setScalar(opts.flash * 0.85);
    if (opts.alpha !== this.lastAlpha) {
      this.lastAlpha = opts.alpha;
      for (const mat of this.mats) {
        mat.transparent = opts.alpha < 1;
        mat.opacity = opts.alpha;
      }
    }
  }

  private poseLeg(
    l: Limb,
    foot: Mesh,
    short: Mesh,
    hem: Mesh,
    hipPt: Vector3,
    knee2: Pt,
    foot2: Pt,
    z: number,
    bulk: number,
    m: number,
  ): void {
    const knee = new Vector3(knee2.x, -knee2.y, z * 1.1);
    const ft = new Vector3(foot2.x, -foot2.y, z * 1.25);
    const tw = (DIM.thighW / 2) * bulk;
    const sw = (DIM.shinW / 2) * bulk;
    alongSeg(l.upper, hipPt, knee, tw, tw);
    alongSeg(l.belly, hipPt, knee, tw * (1.12 + 0.15 * m), tw * (1.1 + 0.12 * m), 0.25, 0.75);
    ball(l.joint, knee, sw * 1.12);
    alongSeg(l.lower, knee, ft, sw, sw);
    alongSeg(l.lowerBelly, knee, ft, sw * (1.22 + 0.3 * m), sw * (1.18 + 0.25 * m), 0.08, 0.48);
    foot.position.set(ft.x + 3.5, ft.y - 1, ft.z);
    foot.scale.set(DIM.foot * 1.45, DIM.foot * 0.62, DIM.foot * 0.75);
    alongSeg(short, hipPt, knee, tw + 3.2 * bulk, tw + 3.2 * bulk, -0.1, 0.56);
    alongSeg(hem, hipPt, knee, tw + 3.6 * bulk, tw + 3.6 * bulk, 0.5, 0.57);
  }

  private poseArm(l: Limb, sh: Vector3, el: Vector3, ha: Vector3, bulk: number, m: number): void {
    const aw = (DIM.armW / 2) * bulk;
    const fw = (DIM.foreArmW / 2) * bulk;
    alongSeg(l.upper, sh, el, aw, aw);
    alongSeg(l.belly, sh, el, aw * (1.12 + 0.42 * m), aw * (1.1 + 0.36 * m), 0.25, 0.72);
    ball(l.joint, el, fw * 1.1);
    alongSeg(l.lower, el, ha, fw, fw);
    alongSeg(l.lowerBelly, el, ha, fw * (1.15 + 0.3 * m), fw * (1.12 + 0.25 * m), 0.08, 0.45);
  }

  private poseGlove(side: "F" | "B", el: Vector3, ha: Vector3): void {
    const P = this.parts;
    const r = DIM.glove * this.bulk;
    const glove = side === "F" ? P.gloveF : P.gloveB;
    if (this.look.gloveStyle !== "mma") {
      ball(glove, ha, r * 1.15);
      glove.scale.x *= 1.15;
      return;
    }
    // open-finger MMA glove: a slim knuckle pad, curled fingers and a wrist cuff
    dir.subVectors(ha, el).normalize();
    const at = (k: number): Vector3 => ha.clone().addScaledVector(dir, k);
    const pad = r * 0.82;
    alongSeg(side === "F" ? P.cuffF : P.cuffB, at(-pad * 1.3), at(-pad * 0.2), pad * 0.85, pad * 0.85);
    ball(glove, at(pad * 0.15), pad);
    ball(side === "F" ? P.fingersF : P.fingersB, at(pad * 0.75), pad * 0.62);
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    this.auraMat.dispose();
    this.group.removeFromParent();
  }
}
