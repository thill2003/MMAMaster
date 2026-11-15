import { describe, expect, it } from "vitest";

import { LIMBS } from "@/core/input";

import { CLINCH_BREAK_SFX, CLOCK_FINAL_SECONDS, LIMB_SFX, SFX, type SfxId } from "./audio";

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
