import type { ClinchBreakReason } from "@/core/combat";
import type { Limb } from "@/core/input";

/**
 * Audio manifest. v0 has no audio files: the engine synthesizes every sound and every track from this data
 * (sfxr- and chiptune-style), so the whole soundtrack is a few hundred bytes and carries no licence.
 */
export type Wave = "sine" | "square" | "triangle" | "sawtooth";

export interface SfxLayer {
  type: "tone" | "noise";
  wave?: Wave;
  /** Start and end frequency, Hz (tone) or filter cutoff (noise). */
  from: number;
  to: number;
  /** Seconds. */
  dur: number;
  gain: number;
  delay?: number;
  filter?: "lowpass" | "highpass" | "bandpass";
}

export type SfxId =
  | "whoosh"
  | "hit_punch"
  | "hit_elbow"
  | "hit_kick"
  | "hit_knee"
  | "hit_heavy"
  | "block"
  | "check"
  | "parry"
  | "clinch"
  | "clinch_break"
  | "dump"
  | "knockdown"
  | "ko"
  | "player_ko"
  | "pickup"
  | "heal"
  | "clock"
  | "clock_final"
  | "go"
  | "combo"
  | "ui_tap"
  | "ui_back"
  | "unlock"
  | "star"
  | "win"
  | "lose"
  | "boss_intro"
  | "boss_phase";

export const SFX: Record<SfxId, SfxLayer[]> = {
  whoosh: [{ type: "noise", from: 900, to: 2600, dur: 0.07, gain: 0.1, filter: "bandpass" }],
  hit_punch: [
    { type: "noise", from: 1400, to: 500, dur: 0.07, gain: 0.5, filter: "lowpass" },
    { type: "tone", wave: "sine", from: 170, to: 70, dur: 0.09, gain: 0.6 },
  ],
  hit_elbow: [
    { type: "noise", from: 2600, to: 1200, dur: 0.05, gain: 0.5, filter: "bandpass" },
    { type: "tone", wave: "square", from: 260, to: 110, dur: 0.06, gain: 0.3 },
  ],
  hit_kick: [
    { type: "noise", from: 900, to: 300, dur: 0.11, gain: 0.55, filter: "lowpass" },
    { type: "tone", wave: "sine", from: 120, to: 48, dur: 0.14, gain: 0.75 },
  ],
  hit_knee: [
    { type: "noise", from: 1100, to: 400, dur: 0.08, gain: 0.5, filter: "lowpass" },
    { type: "tone", wave: "triangle", from: 150, to: 58, dur: 0.12, gain: 0.7 },
  ],
  hit_heavy: [
    { type: "noise", from: 700, to: 180, dur: 0.2, gain: 0.6, filter: "lowpass" },
    { type: "tone", wave: "sine", from: 110, to: 36, dur: 0.26, gain: 0.9 },
  ],
  block: [{ type: "noise", from: 3200, to: 2200, dur: 0.045, gain: 0.3, filter: "highpass" }],
  check: [
    { type: "tone", wave: "square", from: 880, to: 1320, dur: 0.09, gain: 0.3 },
    { type: "tone", wave: "sine", from: 1760, to: 1760, dur: 0.14, gain: 0.25, delay: 0.03 },
  ],
  parry: [
    { type: "tone", wave: "square", from: 620, to: 310, dur: 0.12, gain: 0.3 },
    { type: "noise", from: 2400, to: 1000, dur: 0.08, gain: 0.3, filter: "bandpass" },
  ],
  clinch: [
    { type: "tone", wave: "sawtooth", from: 120, to: 84, dur: 0.14, gain: 0.3 },
    { type: "noise", from: 700, to: 300, dur: 0.1, gain: 0.25, filter: "lowpass" },
  ],
  clinch_break: [
    { type: "noise", from: 1200, to: 2800, dur: 0.08, gain: 0.22, filter: "bandpass" },
    { type: "tone", wave: "sawtooth", from: 90, to: 140, dur: 0.08, gain: 0.2 },
  ],
  // The throw itself; the landing is the dump's knockdown hit.
  dump: [
    { type: "noise", from: 600, to: 2400, dur: 0.16, gain: 0.24, filter: "bandpass" },
    { type: "tone", wave: "sawtooth", from: 70, to: 150, dur: 0.12, gain: 0.18 },
  ],
  knockdown: [
    { type: "noise", from: 450, to: 110, dur: 0.22, gain: 0.5, filter: "lowpass", delay: 0.05 },
    { type: "tone", wave: "sine", from: 85, to: 32, dur: 0.24, gain: 0.7, delay: 0.05 },
  ],
  ko: [
    { type: "noise", from: 600, to: 120, dur: 0.34, gain: 0.6, filter: "lowpass" },
    { type: "tone", wave: "sine", from: 140, to: 30, dur: 0.4, gain: 0.9 },
    { type: "tone", wave: "square", from: 660, to: 220, dur: 0.22, gain: 0.16, delay: 0.02 },
  ],
  player_ko: [
    { type: "tone", wave: "square", from: 440, to: 55, dur: 0.9, gain: 0.3 },
    { type: "noise", from: 500, to: 100, dur: 0.5, gain: 0.5, filter: "lowpass" },
  ],
  pickup: [
    { type: "tone", wave: "square", from: 660, to: 660, dur: 0.06, gain: 0.25 },
    { type: "tone", wave: "square", from: 990, to: 990, dur: 0.09, gain: 0.25, delay: 0.06 },
  ],
  heal: [
    { type: "tone", wave: "triangle", from: 523, to: 523, dur: 0.08, gain: 0.35 },
    { type: "tone", wave: "triangle", from: 659, to: 659, dur: 0.08, gain: 0.35, delay: 0.08 },
    { type: "tone", wave: "triangle", from: 784, to: 784, dur: 0.14, gain: 0.35, delay: 0.16 },
  ],
  clock: [{ type: "tone", wave: "square", from: 1000, to: 1000, dur: 0.07, gain: 0.22 }],
  clock_final: [
    { type: "tone", wave: "square", from: 1320, to: 1320, dur: 0.06, gain: 0.24 },
    { type: "tone", wave: "square", from: 1320, to: 1320, dur: 0.06, gain: 0.24, delay: 0.1 },
  ],
  go: [
    { type: "tone", wave: "square", from: 784, to: 784, dur: 0.08, gain: 0.22 },
    { type: "tone", wave: "square", from: 1175, to: 1175, dur: 0.16, gain: 0.22, delay: 0.08 },
  ],
  combo: [
    { type: "tone", wave: "triangle", from: 880, to: 880, dur: 0.06, gain: 0.28 },
    { type: "tone", wave: "triangle", from: 1109, to: 1109, dur: 0.06, gain: 0.28, delay: 0.05 },
    { type: "tone", wave: "triangle", from: 1319, to: 1760, dur: 0.14, gain: 0.28, delay: 0.1 },
  ],
  ui_tap: [{ type: "tone", wave: "square", from: 520, to: 700, dur: 0.05, gain: 0.2 }],
  ui_back: [{ type: "tone", wave: "square", from: 500, to: 340, dur: 0.06, gain: 0.2 }],
  unlock: [
    { type: "tone", wave: "square", from: 523, to: 523, dur: 0.1, gain: 0.25 },
    { type: "tone", wave: "square", from: 659, to: 659, dur: 0.1, gain: 0.25, delay: 0.1 },
    { type: "tone", wave: "square", from: 784, to: 784, dur: 0.1, gain: 0.25, delay: 0.2 },
    { type: "tone", wave: "square", from: 1047, to: 1047, dur: 0.3, gain: 0.25, delay: 0.3 },
  ],
  star: [
    { type: "tone", wave: "triangle", from: 1319, to: 1319, dur: 0.08, gain: 0.3 },
    { type: "tone", wave: "triangle", from: 1760, to: 1760, dur: 0.2, gain: 0.3, delay: 0.07 },
  ],
  win: [
    { type: "tone", wave: "square", from: 392, to: 392, dur: 0.12, gain: 0.25 },
    { type: "tone", wave: "square", from: 523, to: 523, dur: 0.12, gain: 0.25, delay: 0.13 },
    { type: "tone", wave: "square", from: 659, to: 659, dur: 0.12, gain: 0.25, delay: 0.26 },
    { type: "tone", wave: "square", from: 784, to: 784, dur: 0.5, gain: 0.25, delay: 0.39 },
  ],
  lose: [
    { type: "tone", wave: "square", from: 392, to: 392, dur: 0.16, gain: 0.22 },
    { type: "tone", wave: "square", from: 330, to: 330, dur: 0.16, gain: 0.22, delay: 0.18 },
    { type: "tone", wave: "square", from: 262, to: 196, dur: 0.5, gain: 0.22, delay: 0.36 },
  ],
  boss_intro: [
    { type: "tone", wave: "sawtooth", from: 82, to: 82, dur: 0.5, gain: 0.3 },
    { type: "tone", wave: "sawtooth", from: 98, to: 98, dur: 0.6, gain: 0.3, delay: 0.5 },
    { type: "noise", from: 400, to: 4000, dur: 0.9, gain: 0.16, filter: "bandpass", delay: 0.2 },
  ],
  boss_phase: [
    { type: "noise", from: 300, to: 3000, dur: 0.5, gain: 0.4, filter: "bandpass" },
    { type: "tone", wave: "sawtooth", from: 60, to: 180, dur: 0.5, gain: 0.4 },
  ],
};

/** Which impact each limb lands with (MM-121). Heavy hits, knockdowns and KOs layer on top. */
export const LIMB_SFX: Record<Limb, SfxId> = { punch: "hit_punch", elbow: "hit_elbow", kick: "hit_kick", knee: "hit_knee" };

/** How a clinch ends. Breaks that come with a hit or a KO already have that sound. */
export const CLINCH_BREAK_SFX: Record<ClinchBreakReason, SfxId | null> = {
  elbow: null,
  knees: null,
  hit: null,
  ko: null,
  timeout: "clinch_break",
  escape: "clinch_break",
  dump: "dump",
};

/** The clock warns once at 30 s, then every second from 10; the last ones sound more urgent. */
export const CLOCK_FINAL_SECONDS = 5;

/**
 * A track is a looping step pattern. `lead` and `bass` are MIDI note numbers per 16th step (0 = rest);
 * `drums` is one character per step: k kick, s snare, h hat, c ching (the small cymbal that keeps time in
 * sarama), . rest. The loop is as long as `lead`; `bass` and `drums` repeat within it.
 */
export interface TrackDef {
  bpm: number;
  leadWave: Wave;
  lead: number[];
  bass: number[];
  drums: string;
  /** Sarama never stays at one tempo: each pass through the loop is this much faster, up to `max`. */
  speedUp?: { perLoop: number; max: number };
}

export type TrackId =
  | "title"
  | "map"
  | "fenton"
  | "chesterfield"
  | "kirkwood"
  | "st_charles"
  | "east_st_louis"
  | "downtown"
  | "soulard"
  | "the_hill"
  | "central_west_end"
  | "champion_gym"
  | "leader"
  | "champion";

const r = 0;

// prettier-ignore
export const TRACKS: Record<TrackId, TrackDef> = {
  title: {
    bpm: 96,
    leadWave: "square",
    lead: [64, r, r, 67, r, r, 69, r, 71, r, 69, r, 67, r, 64, r, 62, r, r, 64, r, r, 67, r, 64, r, r, r, r, r, r, r],
    bass: [40, r, r, r, 40, r, r, r, 43, r, r, r, 43, r, r, r, 38, r, r, r, 38, r, r, r, 40, r, r, r, 40, r, 47, r],
    drums: "k...h...s...h...k...h...s...h.h.",
  },
  map: {
    bpm: 108,
    leadWave: "triangle",
    lead: [72, r, 76, r, 79, r, 76, r, 74, r, 77, r, 81, r, 77, r, 72, r, 76, r, 79, r, 84, r, 83, r, 79, r, 76, r, r, r],
    bass: [48, r, r, 48, r, r, 55, r, 50, r, r, 50, r, r, 57, r, 48, r, r, 48, r, r, 55, r, 43, r, r, 43, r, r, 47, r],
    drums: "k..hk.h.s..hk.h.k..hk.h.s..hs.h.",
  },
  // Fenton, the tutorial: a bright morning in C major.
  fenton: {
    bpm: 120,
    leadWave: "square",
    lead: [72, r, 76, r, 79, r, 76, r, 77, r, 81, r, 79, r, 77, r, 76, r, 79, r, 84, r, 79, r, 77, 76, 74, r, 72, r, r, r],
    bass: [48, r, r, 48, 55, r, r, r, 53, r, r, 53, 48, r, r, r, 48, r, r, 48, 55, r, r, r, 43, r, r, 43, 47, r, 43, r],
    drums: "k...s...k.k.s...k...s...k.k.s.hh",
  },
  // Chesterfield: smooth and suburban, D minor rolling down to A.
  chesterfield: {
    bpm: 116,
    leadWave: "triangle",
    lead: [74, r, r, 77, r, 81, r, 79, 77, r, 74, r, 72, r, 74, r, 70, r, r, 74, r, 77, r, 76, 74, r, 72, r, 74, r, r, r],
    bass: [38, r, 50, r, 38, r, 50, r, 34, r, 46, r, 34, r, 46, r, 31, r, 43, r, 31, r, 43, r, 33, r, 45, r, 33, r, 45, r],
    drums: "k.h.s.h.k.h.s.hhk.h.s.h.k.hks.h.",
  },
  // Kirkwood: a railroad town, so the hats chug like a train.
  kirkwood: {
    bpm: 128,
    leadWave: "square",
    lead: [67, r, 71, r, 74, r, 71, 74, 76, r, 74, r, 71, r, 69, r, 67, r, 71, r, 74, r, 79, r, 78, r, 76, r, 74, r, r, r],
    bass: [43, 43, r, 43, 43, r, 43, r, 40, 40, r, 40, 40, r, 40, r, 36, 36, r, 36, 36, r, 36, r, 38, 38, r, 38, 38, r, 42, r],
    drums: "khhhshhhkhhhshhhkhhhshhhkhkhshss",
  },
  // St. Charles: the old riverfront, a lilting three-against-four in A minor.
  st_charles: {
    bpm: 112,
    leadWave: "triangle",
    lead: [69, r, r, 72, r, r, 76, r, 74, r, r, 72, r, r, 71, r, 72, r, r, 76, r, r, 79, r, 77, r, 76, r, 74, r, 72, r],
    bass: [45, r, r, r, 52, r, r, r, 43, r, r, r, 50, r, r, r, 41, r, r, r, 48, r, r, r, 40, r, r, r, 44, r, r, r],
    drums: "k..h..s.k..h..s.k..h..s.k..hk.s.",
  },
  // East St. Louis: gritty E minor with a blue note.
  east_st_louis: {
    bpm: 136,
    leadWave: "sawtooth",
    lead: [64, r, 67, r, 69, 70, 69, r, 67, r, 64, r, 62, r, 64, r, 64, r, 67, r, 69, 70, 69, 67, 64, r, 62, r, 59, r, r, r],
    bass: [40, r, 40, 52, r, 40, 50, r, 40, r, 40, 52, r, 40, 47, r, 45, r, 45, 57, r, 45, 55, r, 47, r, 47, r, 46, r, 45, r],
    drums: "k.hks.hkk.hks.h.k.hks.hkk.hks.ss",
  },
  // Downtown: the last suburb-to-city step, driving eighths in D minor.
  downtown: {
    bpm: 144,
    leadWave: "square",
    lead: [74, r, 74, 77, r, 74, 81, r, 79, r, 77, r, 76, r, 77, r, 74, r, 74, 77, r, 74, 82, r, 81, r, 79, r, 77, 76, 74, r],
    bass: [38, 38, 50, 38, 38, 50, 38, 50, 34, 34, 46, 34, 34, 46, 34, 46, 36, 36, 48, 36, 36, 48, 36, 48, 33, 33, 45, 33, 40, r, 45, r],
    drums: "k.hsk.hsk.hsk.hsk.hsk.hsk.hsksss",
  },
  soulard: {
    bpm: 132,
    leadWave: "square",
    lead: [69, r, 72, 69, r, 76, r, 74, 72, r, 69, r, 67, r, 69, r, 69, r, 72, 69, r, 76, r, 79, 76, r, 74, r, 72, 74, 76, r],
    bass: [45, 45, r, 45, 45, r, 45, r, 41, 41, r, 41, 43, r, 43, r, 45, 45, r, 45, 45, r, 45, r, 48, 48, r, 48, 43, r, 43, 47],
    drums: "k.h.s.h.k.hks.h.k.h.s.h.k.hks.sh",
  },
  the_hill: {
    bpm: 124,
    leadWave: "square",
    lead: [62, r, 65, r, 69, r, 67, 65, 62, r, 65, r, 60, r, r, r, 62, r, 65, r, 69, r, 72, 70, 69, r, 65, r, 67, r, r, r],
    bass: [38, r, 38, 50, r, 38, r, 50, 34, r, 34, 46, r, 34, r, 46, 38, r, 38, 50, r, 38, r, 50, 36, r, 36, 48, 31, r, 43, r],
    drums: "k.hhs.h.k.hhs.hkk.hhs.h.k.hhsshs",
  },
  central_west_end: {
    bpm: 140,
    leadWave: "sawtooth",
    lead: [64, 64, r, 67, r, 64, 71, r, 69, r, 67, r, 64, r, 62, r, 64, 64, r, 67, r, 64, 72, r, 71, r, 69, r, 67, 69, 71, r],
    bass: [40, r, 40, r, 40, r, 40, 47, 38, r, 38, r, 38, r, 38, 45, 40, r, 40, r, 40, r, 40, 47, 36, r, 36, r, 35, r, 35, 47],
    drums: "k.hks.h.k.hks.hhk.hks.h.kkhks.ss",
  },
  // The champion's gym: the walk to the ring. Slow, low and sparse, with the ching already counting.
  champion_gym: {
    bpm: 100,
    leadWave: "sawtooth",
    lead: [64, r, r, r, r, r, 67, r, 66, r, r, r, r, r, 62, r, 64, r, r, r, r, r, 71, r, 70, r, r, r, 69, r, 67, r],
    bass: [28, r, 40, r, 28, r, 40, r, 28, r, 40, r, 28, r, 40, r, 28, r, 40, r, 28, r, 40, r, 34, r, 46, r, 33, r, 45, r],
    drums: "k...c...s...c...k...c...s...k.c.",
  },
  // A chiptune take on sarama, the music played at ringside: a reedy pentatonic lead that keeps climbing
  // over hand drums and ching, getting faster the longer the fight goes.
  leader: {
    bpm: 148,
    leadWave: "sawtooth",
    lead: [69, 72, 74, 72, 69, 67, 69, r, 74, 76, 79, 76, 74, 72, 74, r, 76, 79, 81, 79, 76, 74, 76, r, 81, 79, 76, 74, 72, 74, 69, r],
    bass: [33, r, 45, 33, r, 45, 33, 45, 33, r, 45, 33, r, 45, 33, 45, 36, r, 48, 36, r, 48, 36, 48, 31, r, 43, 31, 28, 40, 28, 40],
    drums: "kchkshkckhskshkhkchkshkckhsksssh",
    speedUp: { perLoop: 3, max: 172 },
  },
  // The champion's sarama: higher, longer and faster, with an answering phrase that falls before it climbs.
  champion: {
    bpm: 160,
    leadWave: "sawtooth",
    lead: [
      76, 79, 81, 79, 76, 74, 76, r, 81, 84, 86, 84, 81, 79, 81, r, 84, 86, 88, 86, 84, 81, 84, r, 88, 86, 84, 81, 79, 81, 76, r,
      74, 76, 79, 76, 74, 72, 74, r, 72, 74, 76, 74, 72, 69, 72, r, 69, 72, 74, 76, 79, 81, 84, r, 86, 84, 81, 79, 76, 79, 76, r,
    ],
    bass: [40, r, 52, 40, r, 52, 40, 52, 40, r, 52, 40, r, 52, 40, 52, 45, r, 57, 45, r, 57, 45, 57, 38, r, 50, 38, 43, r, 47, r],
    drums: "kchkskckkchkskckkchkskckkcksssss",
    speedUp: { perLoop: 4, max: 188 },
  },
};

/** The tempo of a track on its `loop`th pass (0 = first). */
export const trackBpm = (track: TrackDef, loop: number): number =>
  track.speedUp ? Math.min(track.speedUp.max, track.bpm + loop * track.speedUp.perLoop) : track.bpm;
