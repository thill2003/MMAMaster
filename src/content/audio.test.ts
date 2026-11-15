import { describe, expect, it } from "vitest";

import { LIMBS } from "@/core/input";

import { CLINCH_BREAK_SFX, CLOCK_FINAL_SECONDS, LIMB_SFX, SFX, type SfxId, TRACKS, type TrackId, trackBpm } from "./audio";
import { ST_LOUIS } from "./towns";

const ids = Object.keys(SFX) as SfxId[];

describe("SFX set (MM-121)", () => {
  it("has about twenty sounds, each with at least one layer", () => {
    expect(ids.length).toBeGreaterThanOrEqual(20);
    for (const id of ids) expect(SFX[id].length, id).toBeGreaterThan(0);
  });

  it("covers the plan's list: per-limb impacts, block, check, clinch, KO, clock warning, UI", () => {
    const required: SfxId[] = ["block", "check", "clinch", "ko", "clock", "ui_tap", "ui_back"];
    for (const id of required) expect(SFX[id], id).toBeDefined();
    for (const limb of LIMBS) expect(SFX[LIMB_SFX[limb]], limb).toBeDefined();
    expect(new Set(LIMBS.map((l) => LIMB_SFX[l])).size).toBe(LIMBS.length);
  });

  it("every layer is audible, short and in a playable range", () => {
    for (const id of ids) {
      for (const l of SFX[id]) {
        expect(l.dur, id).toBeGreaterThan(0);
        expect(l.gain, id).toBeGreaterThan(0);
        expect(l.gain, id).toBeLessThanOrEqual(1);
        expect(Math.min(l.from, l.to), id).toBeGreaterThanOrEqual(20);
        expect(Math.max(l.from, l.to), id).toBeLessThanOrEqual(20000);
        expect((l.delay ?? 0) + l.dur, id).toBeLessThanOrEqual(1.5);
        if (l.type === "tone") expect(l.filter, id).toBeUndefined();
        else expect(l.wave, id).toBeUndefined();
      }
    }
  });

  it("clinch breaks and the clock map to real sounds", () => {
    for (const id of Object.values(CLINCH_BREAK_SFX)) if (id) expect(SFX[id]).toBeDefined();
    expect(CLOCK_FINAL_SECONDS).toBeGreaterThan(0);
    expect(CLOCK_FINAL_SECONDS).toBeLessThan(10);
  });
});

const trackIds = Object.keys(TRACKS) as TrackId[];

describe("soundtrack (MM-122)", () => {
  it("every track is a playable loop: 16th-note bars, notes in range, known drum hits", () => {
    for (const id of trackIds) {
      const t = TRACKS[id];
      expect(t.lead.length % 16, id).toBe(0);
      expect(t.lead.length % t.bass.length, id).toBe(0);
      expect(t.lead.length % t.drums.length, id).toBe(0);
      const notes = [...t.lead, ...t.bass].filter((n) => n !== 0);
      expect(Math.min(...notes), id).toBeGreaterThanOrEqual(24);
      expect(Math.max(...notes), id).toBeLessThanOrEqual(96);
      expect(t.drums, id).toMatch(/^[kshc.]+$/);
      expect(t.bpm, id).toBeGreaterThanOrEqual(60);
      expect(trackBpm(t, 1000), id).toBeLessThanOrEqual(200);
    }
  });

  it("every level has its own track, and the champion's gym its own", () => {
    const tracks = ST_LOUIS.map((t) => t.music);
    expect(new Set(tracks).size).toBe(ST_LOUIS.length);
    for (const id of tracks) expect(TRACKS[id], id).toBeDefined();
    for (const id of ["title", "map"] as TrackId[]) expect(tracks).not.toContain(id);
    expect(ST_LOUIS.find((t) => t.isChampion)?.music).toBe("champion_gym");
  });

  it("leaders fight to sarama, the champion to a faster one of its own", () => {
    for (const town of ST_LOUIS) {
      expect(town.leaderMusic, town.id).toBe(town.isChampion ? "champion" : "leader");
      expect(town.leaderMusic, town.id).not.toBe(town.music);
    }
    const leader = TRACKS.leader;
    const champion = TRACKS.champion;
    expect(champion.bpm).toBeGreaterThan(leader.bpm);
    expect(trackBpm(champion, 1000)).toBeGreaterThan(trackBpm(leader, 1000));
    for (const t of [leader, champion]) {
      expect(t.drums).toContain("c");
      expect(trackBpm(t, 1)).toBeGreaterThan(trackBpm(t, 0));
      expect(trackBpm(t, 1000)).toBe(t.speedUp?.max);
    }
  });

  it("a track without speedUp keeps its tempo", () => {
    expect(trackBpm(TRACKS.map, 50)).toBe(TRACKS.map.bpm);
  });
});
