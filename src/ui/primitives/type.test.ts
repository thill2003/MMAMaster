import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FONTS, MIN_FONT_SIZE, TYPE_SCALE } from "@/content/display";

import { typeVars } from "./type";

const css = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

describe("retro type (MM-094)", () => {
  it("the scale climbs step by step and never drops below the accessibility floor", () => {
    const sizes = Object.values(TYPE_SCALE);
    sizes.forEach((s, i) => i > 0 && expect(s).toBeGreaterThan(sizes[i - 1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });

  it("exposes every face and step as a CSS variable", () => {
    const vars = typeVars();
    for (const [role, stack] of Object.entries(FONTS)) expect(vars[`--font-${role}`]).toBe(stack);
    for (const [step, px] of Object.entries(TYPE_SCALE)) expect(vars[`--fs-${step}`]).toBe(String(px));
  });

  it("every font size in the stylesheet is a step of the scale", () => {
    const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      const step = /var\(--fs-([a-z]+)\)/.exec(size)?.[1];
      // Control labels size with the button (--btn), not the stage.
      if (!step) expect(size, size).toMatch(/var\(--btn\)/);
      else expect(TYPE_SCALE, size).toHaveProperty(step);
    }
  });

  it("the stylesheet names no font family of its own", () => {
    for (const m of css.matchAll(/font-family:\s*([^;]+);/g)) expect(m[1].trim()).toMatch(/^var\(--font-[a-z]+\)$/);
  });
});
