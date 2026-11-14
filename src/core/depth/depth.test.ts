import { describe, expect, it } from "vitest";

import { clampDepth, DEFAULT_BAND, depthScale, sortKey, withinDepth } from "./depth";

describe("depth", () => {
  it("hits only connect inside the tolerance", () => {
    expect(withinDepth(40, 52, 16)).toBe(true);
    expect(withinDepth(40, 60, 16)).toBe(false);
  });

  it("clamps to the walkable band", () => {
    expect(clampDepth(-5)).toBe(DEFAULT_BAND.min);
    expect(clampDepth(999)).toBe(DEFAULT_BAND.max);
  });

  it("sorts nearer fighters later and is stable for ties", () => {
    expect(sortKey(100, 1)).toBeGreaterThan(sortKey(20, 2));
    expect(sortKey(50, 2)).toBeGreaterThan(sortKey(50, 1));
  });

  it("scales up toward the camera", () => {
    expect(depthScale(DEFAULT_BAND.max)).toBeGreaterThan(depthScale(DEFAULT_BAND.min));
  });
});
