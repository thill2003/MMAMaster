import type { Fighter } from "@/core/combat";

/**
 * Procedural fighter poses — the v0 stand-in for the pre-rendered sprite sheets (plan §8).
 * A pose is a set of joint angles in degrees for a side-on figure facing right:
 *   0° points straight down, positive rotates toward the front.
 *   F = lead side (far from the camera), B = rear / power side (near the camera).
 * Elbow and knee values are bends relative to the upper limb.
 */
export interface Pose {
  torso: number;
  head: number;
  shF: number;
  elF: number;
  shB: number;
  elB: number;
  hipF: number;
  knF: number;
  hipB: number;
  knB: number;
  /** Height off the ground (jumps). */
  lift: number;
  /** Whole-body rotation about the hips (falls). */
  rot: number;
  /** 1 = facing as normal, -1 = turned round (spins), in between = mid-turn. */
  turn: number;
}

export const GUARD: Pose = {
  torso: 6,
  head: 0,
  shF: 55,
  elF: 105,
  shB: 22,
  elB: 132,
  hipF: 24,
  knF: 26,
  hipB: -20,
  knB: 14,
  lift: 0,
  rot: 0,
  turn: 1,
};

const P = (o: Partial<Pose>): Pose => ({ ...GUARD, ...o });

const BLOCK = P({ torso: -2, head: 6, shF: 72, elF: 116, shB: 62, elB: 126, hipF: 30, knF: 42, hipB: -24, knB: 32 });
const HIT = P({ torso: -24, head: -16, shF: 18, elF: 60, shB: -12, elB: 50, hipF: 14, knF: 30, hipB: -26, knB: 26 });
const STAGGER = P({ torso: 34, head: 22, shF: 22, elF: 22, shB: 6, elB: 16, hipF: 20, knF: 42, hipB: -10, knB: 36 });
const DASH = P({ torso: 28, shF: 40, elF: 110, shB: 10, elB: 120, hipF: 52, knF: 44, hipB: -46, knB: 30 });
const DOWN = P({ torso: 0, head: -6, shF: 150, elF: 20, shB: 120, elB: 30, hipF: 12, knF: 14, hipB: -6, knB: 24, rot: -90 });
const FALL = P({ torso: -18, head: -20, shF: 110, elF: 30, shB: 80, elB: 40, hipF: 40, knF: 50, hipB: 10, knB: 40, rot: -50, lift: 18 });
const CROUCH = P({ torso: 30, head: 10, shF: 40, elF: 100, shB: 30, elB: 110, hipF: 60, knF: 96, hipB: 14, knB: 84 });
const TIRED = P({ torso: 30, head: 24, shF: 34, elF: 12, shB: 20, elB: 14, hipF: 22, knF: 38, hipB: -12, knB: 34 });
const WIN = P({ torso: -4, head: -10, shF: 172, elF: 8, shB: 196, elB: -8, hipF: 10, knF: 8, hipB: -10, knB: 8 });
const CLINCH = P({ torso: 12, shF: 96, elF: 28, shB: 90, elB: 34, hipF: 20, knF: 24, hipB: -22, knB: 18 });
/** The counter-striker waiting: hands low, weight back, inviting the rush. */
const COUNTER = P({ torso: -6, head: -4, shF: 34, elF: 62, shB: 8, elB: 96, hipF: 30, knF: 22, hipB: -26, knB: 30 });
const CLINCHED = P({ torso: 40, head: 26, shF: 34, elF: 30, shB: 24, elB: 34, hipF: 26, knF: 38, hipB: -14, knB: 30 });

interface StrikePose {
  windup?: Partial<Pose>;
  hit: Partial<Pose>;
}

/** Keyed by StrikeDef.pose. */
const STRIKES: Record<string, StrikePose> = {
  jab: { hit: { shF: 92, elF: 0, torso: 11 } },
  cross: { windup: { shB: 8, elB: 140, torso: 2 }, hit: { shB: 93, elB: 0, torso: 20, shF: 42, elF: 122, hipB: -30, knB: 22 } },
  hook: { windup: { shF: 36, elF: 92, torso: -4 }, hit: { shF: 86, elF: 78, torso: 17 } },
  hook2: { windup: { shB: 16, elB: 100, torso: 0 }, hit: { shB: 88, elB: 76, torso: 22, hipB: -28, knB: 22 } },
  uppercut: {
    windup: { shB: 18, elB: 62, torso: 20, hipF: 36, knF: 52, hipB: -14, knB: 42 },
    hit: { shB: 124, elB: 58, torso: -6, head: -8, lift: 6 },
  },
  overhand: { windup: { shB: -44, elB: 100, torso: -8 }, hit: { shB: 116, elB: 28, torso: 28, hipB: -32, knB: 24 } },
  bodyhook: { windup: { shF: 30, elF: 80 }, hit: { shF: 62, elF: 62, torso: 24, hipF: 32, knF: 46, hipB: -22, knB: 34 } },
  superman: {
    windup: { hipB: 58, knB: 92, torso: 12, shB: 0, elB: 130 },
    hit: { shB: 96, elB: 0, torso: 32, hipB: -52, knB: 22, hipF: 30, knF: 32, lift: 16 },
  },
  elbow: { windup: { shB: 56, elB: 142 }, hit: { shB: 97, elB: 138, torso: 19, hipB: -28, knB: 20 } },
  elbowup: { windup: { shB: 30, elB: 150, torso: 14 }, hit: { shB: 128, elB: 142, torso: 6, lift: 3 } },
  elbowspin: { windup: { torso: 4, shF: 70, elF: 130, turn: -1 }, hit: { shF: 100, elF: 134, torso: 14, shB: 10, elB: 120 } },
  elbowdown: { windup: { shB: 172, elB: 62, lift: 5, torso: -2 }, hit: { shB: 68, elB: 122, torso: 26, hipF: 30, knF: 40 } },
  elbowleap: {
    windup: { ...CROUCH },
    hit: { shB: 112, elB: 136, torso: 24, lift: 18, hipB: -42, knB: 32, hipF: 42, knF: 62 },
  },
  roundbody: {
    windup: { hipB: 8, knB: 44, torso: 0 },
    hit: { hipB: 88, knB: 8, torso: -22, shF: 30, elF: 100, shB: -32, elB: 30, hipF: 4, knF: 6 },
  },
  roundhead: {
    windup: { hipB: 30, knB: 70, torso: -8 },
    hit: { hipB: 120, knB: 6, torso: -36, shF: 26, elF: 100, shB: -42, elB: 22, hipF: 2, knF: 4 },
  },
  teep: { windup: { hipF: 70, knF: 104, torso: -4 }, hit: { hipF: 84, knF: 4, torso: -17, hipB: -8, knB: 6 } },
  lowkick: { windup: { hipB: 4, knB: 40 }, hit: { hipB: 54, knB: 12, torso: -6, hipF: 12, knF: 18, shB: -10, elB: 60 } },
  flykick: {
    windup: { ...CROUCH },
    hit: { hipB: 96, knB: 5, hipF: 40, knF: 112, torso: -20, shB: -30, elB: 30, lift: 26 },
  },
  knee: {
    windup: { hipB: 18, knB: 62, torso: 8 },
    hit: { hipB: 90, knB: 120, torso: 2, shF: 82, elF: 58, shB: 72, elB: 68, hipF: 4, knF: 8, lift: 2 },
  },
  kneecurve: {
    windup: { hipB: 30, knB: 90 },
    hit: { hipB: 102, knB: 112, torso: -10, shF: 84, elF: 56, shB: 70, elB: 70, hipF: 2, knF: 6, lift: 3 },
  },
  flyknee: {
    windup: { ...CROUCH },
    hit: { hipB: 96, knB: 122, hipF: -22, knF: 52, torso: 6, shF: 102, elF: 40, shB: 92, elB: 50, lift: 30 },
  },
};

const CLINCH_ACTIONS: Record<string, Partial<Pose>> = {
  knee: { hipB: 86, knB: 116, torso: 2, lift: 2 },
  elbow: { shB: 104, elB: 136, torso: 22 },
  dump: { torso: -26, shF: 150, elF: 20, shB: 140, elB: 24, hipF: 40, knF: 30 },
};

const KEYS: Array<keyof Pose> = ["torso", "head", "shF", "elF", "shB", "elB", "hipF", "knF", "hipB", "knB", "lift", "rot", "turn"];

export const mix = (a: Pose, b: Pose, t: number): Pose => {
  const out = { ...a };
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const easeIn = (t: number): number => t * t;
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export interface PoseTiming {
  knockdownFall: number;
  knockdownDown: number;
  getUp: number;
}

/** The pose for a fighter's current state and tick. `time` is a free-running tick for idle motion. */
export const poseFor = (f: Fighter, time: number, timing: PoseTiming): Pose => {
  const t = f.stateTick;
  switch (f.state) {
    case "idle": {
      if (f.telegraph) return mix(CROUCH, P({ ...CROUCH, torso: 36 }), 0.5 + 0.5 * Math.sin(time * 0.5));
      if (f.parry) return mix(COUNTER, P({ ...COUNTER, shF: 40, torso: -8 }), 0.5 + 0.5 * Math.sin(time * 0.1));
      if (f.tired) return mix(TIRED, P({ ...TIRED, torso: 36, lift: 0 }), 0.5 + 0.5 * Math.sin(time * 0.22));
      const b = Math.sin((time + f.id * 13) * 0.12);
      return P({
        torso: GUARD.torso + b * 1.5,
        shF: GUARD.shF + b * 3,
        elB: GUARD.elB + b * 2,
        knF: GUARD.knF + b * 3,
        knB: GUARD.knB + b * 3,
      });
    }
    case "intro":
    case "walk": {
      const s = Math.sin((time + f.id * 7) * 0.28);
      const base = f.tired ? TIRED : GUARD;
      return P({
        ...base,
        hipF: 24 + s * 24,
        knF: 26 + Math.max(0, -s) * 26,
        hipB: -20 - s * 24,
        knB: 14 + Math.max(0, s) * 28,
        torso: base.torso + 2,
      });
    }
    case "dash":
      return mix(GUARD, DASH, easeOut(clamp01(t / 4)));
    case "guard":
      return mix(GUARD, BLOCK, easeOut(clamp01(t / 3)));
    case "blockstun":
      return mix(BLOCK, P({ ...BLOCK, torso: -12 }), 1 - clamp01(t / Math.max(1, f.stun)));
    case "hit":
      return mix(HIT, GUARD, easeIn(clamp01(t / Math.max(1, f.stun))) * 0.6);
    case "stagger": {
      const wobble = Math.sin(time * 0.35) * 5;
      return P({ ...STAGGER, torso: STAGGER.torso + wobble, head: STAGGER.head + wobble });
    }
    case "ko":
    case "knockdown": {
      if (t < timing.knockdownFall) {
        const k = t / timing.knockdownFall;
        const air = Math.sin(k * Math.PI) * 26;
        const pose = k < 0.5 ? mix(HIT, FALL, k * 2) : mix(FALL, DOWN, (k - 0.5) * 2);
        return { ...pose, lift: air };
      }
      return DOWN;
    }
    case "getup": {
      const k = clamp01(t / timing.getUp);
      return k < 0.5 ? mix(DOWN, { ...CROUCH, rot: -20 }, k * 2) : mix({ ...CROUCH, rot: -20 }, GUARD, (k - 0.5) * 2);
    }
    case "clinch": {
      if (f.clinchAction) {
        const def = f.clinchMoves[f.clinchAction];
        const target = P({ ...CLINCH, ...CLINCH_ACTIONS[f.clinchAction] });
        const k =
          f.clinchActionTick < def.startup
            ? easeIn(f.clinchActionTick / def.startup)
            : 1 - clamp01((f.clinchActionTick - def.startup) / Math.max(1, def.recovery));
        return mix(CLINCH, target, k);
      }
      return CLINCH;
    }
    case "clinched":
      return P({ ...CLINCHED, torso: CLINCHED.torso + Math.sin(time * 0.4) * 3 });
    case "win":
      return mix(GUARD, WIN, easeOut(clamp01(t / 14)));
    case "strike": {
      const s = f.strike;
      if (!s) return GUARD;
      const sp = STRIKES[s.pose] ?? STRIKES.jab;
      const hit = P(sp.hit);
      if (t < s.startup) {
        const k = t / Math.max(1, s.startup);
        if (sp.windup) {
          const wind = P(sp.windup);
          return k < 0.55 ? mix(GUARD, wind, easeOut(k / 0.55)) : mix(wind, hit, easeIn((k - 0.55) / 0.45));
        }
        return mix(GUARD, hit, easeIn(k));
      }
      if (t < s.startup + s.active) return hit;
      const k = clamp01((t - s.startup - s.active) / Math.max(1, s.recovery));
      return mix(hit, GUARD, easeOut(k));
    }
  }
};
