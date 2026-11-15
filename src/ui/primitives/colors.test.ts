import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HUD_COLORS, type HudColor } from "@/content/display";

import { hudColorVars } from "./colors";

const css = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");

type Rgb = [number, number, number];

/** Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB. */
const VISION: Record<string, number[][] | null> = {
  typical: null,
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
};

/** The HUD sits over the dark gym; translucent colours are judged against this. */
const BACKDROP: Rgb = [0x17, 0x16, 0x24];

const parse = (color: string, under: Rgb = BACKDROP): Rgb => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb;
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color);
  if (!rgba) throw new Error(`unparsed colour ${color}`);
  const a = Number(rgba[4]);
  return [0, 1, 2].map((i) => Number(rgba[i + 1]) * a + under[i] * (1 - a)) as Rgb;
};

const toLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: Rgb, matrix: number[][] | null): number => {
  const lin = rgb.map(toLinear);
  const seen = matrix ? matrix.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))) : lin;
  return 0.2126 * seen[0] + 0.7152 * seen[1] + 0.0722 * seen[2];
};

const contrast = (a: Rgb, b: Rgb, matrix: number[][] | null): number => {
  const [hi, lo] = [luminance(a, matrix), luminance(b, matrix)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Every HUD state pair the player must tell apart, and the lightness contrast it needs under every vision. */
const PAIRS: [HudColor, HudColor, number, string][] = [
  ["health", "track", 3, "health bar against its track"],
  ["healthLow", "track", 3, "low health bar against its track"],
  ["healthLowDeep", "healthLowStripe", 1.5, "hazard stripes on the low bar"],
  ["boss", "track", 3, "leader bar against its track"],
  ["boss", "bossNotch", 1.5, "notches on the leader bar"],
  ["clockText", "clockPlate", 4.5, "clock digits"],
  ["clockWarnText", "clockWarnPlate", 4.5, "clock digits under 30 s"],
  ["clockWarnPlate", "clockPlate", 3, "clock warning plate against the normal plate"],
  ["pipOn", "pipOff", 3, "a passed stage pip against an unpassed one"],
  ["bossPipOn", "pipOff", 3, "the boss pip lit against unlit"],
  ["combo", "ink", 4.5, "combo count against its outline"],
  ["itemText", "item", 4.5, "item count"],
  ["itemEmptyText", "itemEmpty", 4.5, "empty item count"],
  ["item", "itemEmpty", 3, "a full item badge against an empty one"],
  ["starOn", "track", 3, "an earned star"],
  ["starOff", "track", 3, "an unearned star's outline"],
];

describe("colourblind-safe HUD (MM-109a)", () => {
  for (const [vision, matrix] of Object.entries(VISION)) {
    it(`every HUD state reads by lightness under ${vision} vision`, () => {
      for (const [a, b, min, what] of PAIRS) {
        const ratio = contrast(parse(HUD_COLORS[a]), parse(HUD_COLORS[b]), matrix);
        expect(ratio, `${what} (${a} vs ${b}): ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
      }
    });
  }

  it("exposes every colour as a --hud- variable", () => {
    const vars = hudColorVars();
    expect(vars["--hud-health-low-stripe"]).toBe(HUD_COLORS.healthLowStripe);
    expect(Object.keys(vars)).toHaveLength(Object.keys(HUD_COLORS).length);
  });

  const rule = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf("}", at));
  };

  it("adds a shape or pattern to each state, not only a hue", () => {
    expect(rule(".bar i.low")).toContain("repeating-linear-gradient");
    expect(rule(".bar.boss::after")).toContain("repeating-linear-gradient");
    expect(rule(".pip.bosspip")).toContain("rotate(45deg)");
    expect(rule(".clock.warn")).toContain("--hud-clock-warn-plate");
    expect(rule(".sbtn.item.empty")).toContain("dashed");
    expect(rule("svg.star.off path")).toContain("stroke-dasharray");
  });

  it("names no colour of its own in the HUD state rules", () => {
    const selectors = [".bar", ".bar i", ".bar i.low", ".bar i.lag", ".bar.boss i", ".clock", ".clock.warn", ".pip", ".pip.on"];
    for (const s of [...selectors, ".pip.bosspip.on", ".combo", ".combo b", ".sbtn.item", ".sbtn .count", "svg.star.on path"]) {
      expect(rule(s), s).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });
});
