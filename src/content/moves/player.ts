import type { ClinchMoves, MoveSet, StrikeDef } from "@/core/combat";

/**
 * The player's Muay Thai — every strike, string, hold step and cancel window is data (plan §6).
 * Timings are 60 Hz ticks: startup / active / recovery. Distances are logical pixels.
 * Tuning is a change to this file; nothing in core/ or engine/ names a strike.
 */
const strike = (s: StrikeDef): StrikeDef => ({ cancelAt: s.startup + 2, ...s });

// One strike per line reads as a tuning table; keep it that way.
// prettier-ignore
const list: StrikeDef[] = [
  // ---- Punch: jab → cross → left hook → right hook → uppercut
  strike({ id: "jab", name: "Jab", limb: "punch", startup: 4, active: 3, recovery: 9, damage: 4, reach: 52, hitStun: 17, knockback: 1.0, lunge: 4, pose: "jab" }),
  strike({ id: "cross", name: "Cross", limb: "punch", startup: 5, active: 3, recovery: 11, damage: 6, reach: 56, hitStun: 18, knockback: 1.4, lunge: 6, pose: "cross" }),
  strike({ id: "hook_l", name: "Left Hook", limb: "punch", startup: 6, active: 3, recovery: 12, damage: 7, reach: 50, hitStun: 19, knockback: 1.5, lunge: 8, pose: "hook" }),
  strike({ id: "hook_r", name: "Right Hook", limb: "punch", startup: 6, active: 3, recovery: 13, damage: 8, reach: 50, hitStun: 19, knockback: 1.6, lunge: 8, pose: "hook2" }),
  strike({ id: "uppercut", name: "Uppercut", limb: "punch", startup: 8, active: 4, recovery: 18, damage: 12, reach: 50, hitStun: 20, knockback: 5, knockdown: true, heavy: true, lunge: 8, pose: "uppercut" }),
  // Hold: overhand. As an opener it stuns long enough to build on; as a string ender it drops them.
  strike({ id: "overhand", name: "Overhand", limb: "punch", startup: 12, active: 4, recovery: 16, damage: 11, reach: 58, hitStun: 26, knockback: 2.5, heavy: true, lunge: 14, pose: "overhand" }),
  strike({ id: "overhand_finish", name: "Overhand Right", limb: "punch", startup: 10, active: 4, recovery: 20, damage: 13, reach: 58, hitStun: 20, knockback: 5.5, knockdown: true, heavy: true, lunge: 14, pose: "overhand" }),
  strike({ id: "body_hook", name: "Body Hook", limb: "punch", startup: 6, active: 3, recovery: 12, damage: 8, reach: 50, hitStun: 20, knockback: 1.2, lunge: 8, pose: "bodyhook" }),
  strike({ id: "superman", name: "Superman Punch", limb: "punch", startup: 8, active: 4, recovery: 20, damage: 13, reach: 62, hitStun: 20, knockback: 6, knockdown: true, heavy: true, lunge: 30, pose: "superman" }),

  // ---- Elbow: horizontal → uppercut elbow → spinning back elbow. Elbows chip hardest through a guard.
  strike({ id: "elbow_h", name: "Horizontal Elbow", limb: "elbow", startup: 6, active: 3, recovery: 12, damage: 8, reach: 42, hitStun: 19, knockback: 1.2, chip: 0.4, lunge: 8, pose: "elbow" }),
  strike({ id: "elbow_up", name: "Uppercut Elbow", limb: "elbow", startup: 7, active: 3, recovery: 13, damage: 9, reach: 42, hitStun: 21, knockback: 1.4, chip: 0.4, lunge: 8, pose: "elbowup" }),
  strike({ id: "elbow_spin", name: "Spinning Back Elbow", limb: "elbow", startup: 14, active: 4, recovery: 22, damage: 16, reach: 48, hitStun: 20, knockback: 5.5, knockdown: true, heavy: true, chip: 0.5, lunge: 10, pose: "elbowspin" }),
  strike({ id: "elbow_smash", name: "Smash Elbow", limb: "elbow", startup: 13, active: 4, recovery: 16, damage: 12, reach: 44, hitStun: 20, knockback: 1, effect: "stun", effectTicks: 48, heavy: true, chip: 0.5, lunge: 10, pose: "elbowdown" }),
  strike({ id: "elbow_126", name: "12–6 Elbow", limb: "elbow", startup: 10, active: 4, recovery: 16, damage: 11, reach: 40, hitStun: 20, knockback: 0.5, effect: "stun", effectTicks: 36, chip: 0.5, lunge: 4, pose: "elbowdown" }),
  strike({ id: "elbow_leap", name: "Leaping Elbow", limb: "elbow", startup: 9, active: 4, recovery: 20, damage: 14, reach: 52, hitStun: 20, knockback: 5, knockdown: true, heavy: true, chip: 0.5, lunge: 28, pose: "elbowleap" }),

  // ---- Kick: body roundhouse → head roundhouse
  strike({ id: "round_body", name: "Body Roundhouse", limb: "kick", startup: 9, active: 4, recovery: 14, damage: 9, reach: 72, minReach: 10, hitStun: 21, knockback: 2.2, pose: "roundbody" }),
  strike({ id: "round_head", name: "Head Roundhouse", limb: "kick", startup: 11, active: 4, recovery: 18, damage: 13, reach: 70, minReach: 10, hitStun: 20, knockback: 5, knockdown: true, heavy: true, pose: "roundhead" }),
  strike({ id: "teep", name: "Teep", limb: "kick", startup: 8, active: 4, recovery: 14, damage: 5, reach: 78, minReach: 6, hitStun: 20, knockback: 9, effect: "push", pose: "teep" }),
  strike({ id: "low_kick", name: "Low Kick", limb: "kick", startup: 8, active: 3, recovery: 13, damage: 6, reach: 66, minReach: 10, hitStun: 17, knockback: 0.8, effect: "slow", effectTicks: 200, low: true, pose: "lowkick" }),
  strike({ id: "flying_kick", name: "Flying Kick", limb: "kick", startup: 9, active: 5, recovery: 22, damage: 14, reach: 74, hitStun: 20, knockback: 6.5, knockdown: true, heavy: true, lunge: 34, pose: "flykick" }),
  strike({ id: "switch_kick", name: "Switch Kick", limb: "kick", startup: 14, active: 4, recovery: 16, damage: 13, reach: 72, minReach: 10, hitStun: 27, knockback: 3, heavy: true, pose: "roundbody" }),
  strike({ id: "switch_kick_finish", name: "Switch Kick", limb: "kick", startup: 12, active: 4, recovery: 20, damage: 15, reach: 72, minReach: 10, hitStun: 20, knockback: 5.5, knockdown: true, heavy: true, pose: "roundhead" }),

  // ---- Knee: straight knee → curving knee
  strike({ id: "knee_straight", name: "Straight Knee", limb: "knee", startup: 7, active: 3, recovery: 12, damage: 9, reach: 44, hitStun: 21, knockback: 1.4, lunge: 8, pose: "knee" }),
  strike({ id: "knee_curve", name: "Curving Knee", limb: "knee", startup: 8, active: 3, recovery: 16, damage: 12, reach: 44, hitStun: 20, knockback: 4.5, knockdown: true, heavy: true, lunge: 8, pose: "kneecurve" }),
  strike({ id: "knee_long", name: "Long Knee", limb: "knee", startup: 9, active: 4, recovery: 16, damage: 11, reach: 56, hitStun: 23, knockback: 3, lunge: 28, pose: "knee" }),
  strike({ id: "knee_fly", name: "Flying Knee", limb: "knee", startup: 10, active: 5, recovery: 24, damage: 18, reach: 58, hitStun: 20, knockback: 7.5, knockdown: true, heavy: true, lunge: 36, pose: "flyknee" }),
  strike({ id: "knee_spear", name: "Spear Knee", limb: "knee", startup: 13, active: 4, recovery: 16, damage: 13, reach: 48, hitStun: 28, knockback: 2, heavy: true, lunge: 14, pose: "knee" }),
  strike({ id: "knee_spear_finish", name: "Spear Knee", limb: "knee", startup: 11, active: 4, recovery: 20, damage: 15, reach: 48, hitStun: 20, knockback: 5.5, knockdown: true, heavy: true, lunge: 14, pose: "kneecurve" }),
];

const strikes: Record<string, StrikeDef> = Object.fromEntries(list.map((s) => [s.id, s]));

// prettier-ignore
const clinch: ClinchMoves = {
  knee: { id: "clinch_knee", name: "Clinch Knee", limb: "knee", startup: 8, active: 1, recovery: 12, damage: 9, reach: 0, hitStun: 0, knockback: 0, pose: "clinchknee" },
  elbow: { id: "clinch_elbow", name: "Elbow Out", limb: "elbow", startup: 9, active: 1, recovery: 12, damage: 10, reach: 0, hitStun: 0, knockback: 3, effect: "stun", effectTicks: 70, heavy: true, pose: "clinchelbow" },
  dump: { id: "clinch_dump", name: "Dump", limb: "knee", startup: 10, active: 1, recovery: 14, damage: 8, reach: 0, hitStun: 0, knockback: 0, heavy: true, pose: "clinchdump" },
};

/**
 * Keys are `limb.press.dir`. `openers` start a string; `links` continue one.
 * A different limb with no explicit link cancels into that limb's opener (the limb-switch window),
 * so jab-cross-roundhouse, jab-elbow, cross-knee and jab-cross-hook-low kick all fall out of the data.
 */
export const PLAYER_MOVES: MoveSet = {
  strikes,
  clinch,
  maxString: 6,
  openers: {
    "punch.tap.neutral": "jab",
    "punch.hold.neutral": "overhand",
    "punch.tap.dash": "superman",
    "elbow.tap.neutral": "elbow_h",
    "elbow.hold.neutral": "elbow_smash",
    "elbow.tap.back": "elbow_126",
    "elbow.tap.dash": "elbow_leap",
    "kick.tap.neutral": "round_body",
    "kick.hold.neutral": "switch_kick",
    "kick.tap.forward": "teep",
    "kick.tap.back": "low_kick",
    "kick.tap.dash": "flying_kick",
    "knee.tap.neutral": "knee_straight",
    "knee.hold.neutral": "knee_spear",
    "knee.tap.forward": "knee_long",
    "knee.tap.dash": "knee_fly",
  },
  links: {
    // Punch — tap-tap-tap-tap-tap, with hold steps: tap-hold, tap-tap-hold, hold-tap-tap.
    jab: { "punch.tap.neutral": "cross", "punch.hold.neutral": "overhand_finish" },
    cross: { "punch.tap.neutral": "hook_l", "punch.hold.neutral": "overhand_finish" },
    hook_l: { "punch.tap.neutral": "hook_r", "punch.hold.neutral": "overhand_finish" },
    hook_r: { "punch.tap.neutral": "uppercut" },
    overhand: { "punch.tap.neutral": "body_hook" },
    body_hook: { "punch.tap.neutral": "uppercut" },
    // Elbow — tap-tap-tap, tap-hold, tap-tap-hold, hold-tap-tap.
    elbow_h: { "elbow.tap.neutral": "elbow_up", "elbow.hold.neutral": "elbow_smash" },
    elbow_up: { "elbow.tap.neutral": "elbow_spin", "elbow.hold.neutral": "elbow_smash" },
    elbow_smash: { "elbow.tap.neutral": "elbow_up" },
    // Kick — tap-tap, tap-hold, hold-tap-tap.
    round_body: { "kick.tap.neutral": "round_head", "kick.hold.neutral": "switch_kick_finish" },
    switch_kick: { "kick.tap.neutral": "round_body" },
    // Knee — tap-tap, tap-hold, hold-tap-tap.
    knee_straight: { "knee.tap.neutral": "knee_curve", "knee.hold.neutral": "knee_spear_finish" },
    knee_spear: { "knee.tap.neutral": "knee_straight" },
  },
};

/** Shown on the pause screen. */
export const COMBO_LIST: Array<{ name: string; input: string }> = [
  { name: "Five-punch string", input: "P · P · P · P · P" },
  { name: "Jab, cross, roundhouse", input: "P · P · K" },
  { name: "Jab, cross, hook, low kick", input: "P · P · P · ←K" },
  { name: "Teep into jab-cross", input: "→K · P · P" },
  { name: "Jab, elbow", input: "P · E" },
  { name: "Cross, knee", input: "P · P · N" },
  { name: "Overhand finish", input: "P · P · hold P" },
  { name: "Elbow string", input: "E · E · E" },
  { name: "Body kick, head kick", input: "K · K" },
  { name: "Clinch", input: "walk in, hold → · N N N · E · ←N" },
  { name: "Dash strikes", input: "→→ then P / E / K / N" },
];
