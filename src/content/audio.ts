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
  | "ko"
  | "player_ko"
  | "pickup"
  | "heal"
  | "clock"
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
  clinch: [{ type: "tone", wave: "sawtooth", from: 120, to: 84, dur: 0.14, gain: 0.3 }],
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

/**
 * A track is a looping step pattern. `lead` and `bass` are MIDI note numbers per 16th step (0 = rest);
 * `drums` is one character per step: k kick, s snare, h hat, . rest.
 */
export interface TrackDef {
  bpm: number;
  leadWave: Wave;
  lead: number[];
  bass: number[];
  drums: string;
}

export type TrackId = "title" | "map" | "street_a" | "street_b" | "street_c" | "boss";

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
  street_a: {
    bpm: 132,
    leadWave: "square",
    lead: [69, r, 72, 69, r, 76, r, 74, 72, r, 69, r, 67, r, 69, r, 69, r, 72, 69, r, 76, r, 79, 76, r, 74, r, 72, 74, 76, r],
    bass: [45, 45, r, 45, 45, r, 45, r, 41, 41, r, 41, 43, r, 43, r, 45, 45, r, 45, 45, r, 45, r, 48, 48, r, 48, 43, r, 43, 47],
    drums: "k.h.s.h.k.hks.h.k.h.s.h.k.hks.sh",
  },
  street_b: {
    bpm: 124,
    leadWave: "square",
    lead: [62, r, 65, r, 69, r, 67, 65, 62, r, 65, r, 60, r, r, r, 62, r, 65, r, 69, r, 72, 70, 69, r, 65, r, 67, r, r, r],
    bass: [38, r, 38, 50, r, 38, r, 50, 34, r, 34, 46, r, 34, r, 46, 38, r, 38, 50, r, 38, r, 50, 36, r, 36, 48, 31, r, 43, r],
    drums: "k.hhs.h.k.hhs.hkk.hhs.h.k.hhsshs",
  },
  street_c: {
    bpm: 140,
    leadWave: "sawtooth",
    lead: [64, 64, r, 67, r, 64, 71, r, 69, r, 67, r, 64, r, 62, r, 64, 64, r, 67, r, 64, 72, r, 71, r, 69, r, 67, 69, 71, r],
    bass: [40, r, 40, r, 40, r, 40, 47, 38, r, 38, r, 38, r, 38, 45, 40, r, 40, r, 40, r, 40, 47, 36, r, 36, r, 35, r, 35, 47],
    drums: "k.hks.h.k.hks.hhk.hks.h.kkhks.ss",
  },
  // A chiptune nod to sarama, the music played at ringside: a reedy pentatonic lead that keeps climbing
  // over a fast hand-drum pattern.
  boss: {
    bpm: 152,
    leadWave: "sawtooth",
    lead: [69, 72, 74, 72, 69, 67, 69, r, 74, 76, 79, 76, 74, 72, 74, r, 76, 79, 81, 79, 76, 74, 76, r, 81, 79, 76, 74, 72, 74, 69, r],
    bass: [33, r, 45, 33, r, 45, 33, 45, 33, r, 45, 33, r, 45, 33, 45, 36, r, 48, 36, r, 48, 36, 48, 31, r, 43, 31, 28, 40, 28, 40],
    drums: "k.hkshk.khskshkhk.hkshk.khsksssh",
  },
};
