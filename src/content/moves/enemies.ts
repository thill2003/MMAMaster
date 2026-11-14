import type { ClinchMoves, StrikeDef } from "@/core/combat";

/**
 * Enemy strikes. Long startups are the tells: a grunt's jab takes three times as long as the player's.
 * `g_` = grunts, `b_` = gym leaders and the champion.
 */
// One strike per line reads as a tuning table; keep it that way.
// prettier-ignore
const list: StrikeDef[] = [
  // ---- grunts
  { id: "g_jab", name: "Jab", limb: "punch", startup: 12, active: 3, recovery: 16, damage: 4, reach: 48, hitStun: 12, knockback: 1.2, lunge: 4, pose: "jab" },
  { id: "g_cross", name: "Cross", limb: "punch", startup: 16, active: 3, recovery: 20, damage: 6, reach: 52, hitStun: 14, knockback: 2, lunge: 6, pose: "cross" },
  { id: "g_haymaker", name: "Haymaker", limb: "punch", startup: 26, active: 4, recovery: 30, damage: 10, reach: 50, hitStun: 16, knockback: 5, knockdown: true, heavy: true, lunge: 12, pose: "overhand" },
  { id: "g_quickjab", name: "Quick Jab", limb: "punch", startup: 9, active: 3, recovery: 12, damage: 3, reach: 46, hitStun: 10, knockback: 1, lunge: 4, pose: "jab" },
  { id: "g_round", name: "Roundhouse", limb: "kick", startup: 20, active: 4, recovery: 24, damage: 8, reach: 72, minReach: 12, hitStun: 16, knockback: 3, pose: "roundbody" },
  { id: "g_low", name: "Low Kick", limb: "kick", startup: 16, active: 3, recovery: 20, damage: 5, reach: 66, minReach: 12, hitStun: 12, knockback: 0.8, low: true, effect: "slow", effectTicks: 110, pose: "lowkick" },
  { id: "g_teep", name: "Teep", limb: "kick", startup: 14, active: 4, recovery: 22, damage: 4, reach: 76, minReach: 6, hitStun: 14, knockback: 8, effect: "push", pose: "teep" },
  { id: "g_knee", name: "Knee", limb: "knee", startup: 16, active: 3, recovery: 20, damage: 7, reach: 42, hitStun: 14, knockback: 1.5, lunge: 6, pose: "knee" },
  { id: "g_elbow", name: "Elbow", limb: "elbow", startup: 14, active: 3, recovery: 18, damage: 7, reach: 40, hitStun: 14, knockback: 1.2, chip: 0.4, lunge: 6, pose: "elbow" },

  // ---- bosses
  { id: "b_jab", name: "Stiff Jab", limb: "punch", startup: 10, active: 3, recovery: 14, damage: 5, reach: 52, hitStun: 14, knockback: 1.5, lunge: 6, pose: "jab" },
  { id: "b_haymaker", name: "Haymaker", limb: "punch", startup: 30, active: 4, recovery: 38, damage: 16, reach: 54, hitStun: 20, knockback: 6, knockdown: true, heavy: true, chip: 0.2, lunge: 18, pose: "overhand" },
  { id: "b_teep", name: "Long Teep", limb: "kick", startup: 12, active: 4, recovery: 30, damage: 7, reach: 104, minReach: 18, hitStun: 16, knockback: 11, effect: "push", pose: "teep" },
  { id: "b_shove", name: "Shove Elbow", limb: "elbow", startup: 22, active: 4, recovery: 26, damage: 6, reach: 46, hitStun: 14, knockback: 7, chip: 0.3, pose: "elbow" },
  { id: "b_lowkick", name: "Chopping Low Kick", limb: "kick", startup: 15, active: 3, recovery: 22, damage: 7, reach: 82, minReach: 12, hitStun: 14, knockback: 0.5, low: true, effect: "slow", effectTicks: 160, pose: "lowkick" },
  { id: "b_runjab", name: "Blitz Jab", limb: "punch", startup: 7, active: 3, recovery: 10, damage: 5, reach: 50, hitStun: 12, knockback: 1, lunge: 6, pose: "jab" },
  { id: "b_runcross", name: "Blitz Cross", limb: "punch", startup: 8, active: 3, recovery: 16, damage: 7, reach: 54, hitStun: 14, knockback: 3, lunge: 8, pose: "cross" },
  { id: "b_guardcross", name: "Heavy Cross", limb: "punch", startup: 18, active: 3, recovery: 16, damage: 9, reach: 54, hitStun: 16, knockback: 2.5, armor: true, lunge: 8, pose: "cross" },
  { id: "b_guardhook", name: "Heavy Hook", limb: "punch", startup: 16, active: 4, recovery: 34, damage: 12, reach: 52, hitStun: 18, knockback: 5.5, knockdown: true, heavy: true, armor: true, lunge: 10, pose: "hook" },
  { id: "b_elbow1", name: "Slashing Elbow", limb: "elbow", startup: 11, active: 3, recovery: 8, damage: 8, reach: 46, hitStun: 14, knockback: 1.5, chip: 0.45, armor: true, lunge: 14, pose: "elbow" },
  { id: "b_elbow2", name: "Rising Elbow", limb: "elbow", startup: 11, active: 3, recovery: 8, damage: 8, reach: 46, hitStun: 14, knockback: 1.5, chip: 0.45, armor: true, lunge: 14, pose: "elbowup" },
  { id: "b_elbow3", name: "Spinning Elbow", limb: "elbow", startup: 14, active: 4, recovery: 30, damage: 12, reach: 50, hitStun: 18, knockback: 5.5, knockdown: true, heavy: true, chip: 0.5, armor: true, lunge: 16, pose: "elbowspin" },
  { id: "b_lunge", name: "Lead Lunge", limb: "punch", startup: 18, active: 4, recovery: 34, damage: 11, reach: 58, hitStun: 18, knockback: 3, lunge: 70, pose: "superman" },
  { id: "b_counter", name: "Counter Cross", limb: "punch", startup: 5, active: 3, recovery: 22, damage: 13, reach: 62, hitStun: 22, knockback: 4.5, heavy: true, lunge: 12, pose: "cross" },
  { id: "b_flyknee", name: "Flying Knee", limb: "knee", startup: 12, active: 26, recovery: 58, damage: 18, reach: 46, hitStun: 20, knockback: 7, knockdown: true, heavy: true, armor: true, chip: 0.3, travel: 10, pose: "flyknee" },
];

export const ENEMY_STRIKES: Record<string, StrikeDef> = Object.fromEntries(list.map((s) => [s.id, s]));

/** Enemy clinch work is slower and lighter than the player's; mash to get out before the third knee. */
// prettier-ignore
export const ENEMY_CLINCH: ClinchMoves = {
  knee: { id: "e_clinch_knee", name: "Clinch Knee", limb: "knee", startup: 14, active: 1, recovery: 20, damage: 6, reach: 0, hitStun: 0, knockback: 0, pose: "clinchknee" },
  elbow: { id: "e_clinch_elbow", name: "Elbow Out", limb: "elbow", startup: 12, active: 1, recovery: 16, damage: 7, reach: 0, hitStun: 0, knockback: 3, effect: "stun", effectTicks: 40, pose: "clinchelbow" },
  dump: { id: "e_clinch_dump", name: "Dump", limb: "knee", startup: 14, active: 1, recovery: 18, damage: 7, reach: 0, hitStun: 0, knockback: 0, pose: "clinchdump" },
};
