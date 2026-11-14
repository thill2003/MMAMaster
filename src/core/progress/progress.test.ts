import { describe, expect, it } from "vitest";

import {
  computeStars,
  currentLevel,
  dayKey,
  finishBonuses,
  grantDaily,
  hitPoints,
  isUnlocked,
  type LivesRules,
  migrate,
  newSave,
  recordOutcome,
  type ScoreRules,
  spendLife,
  totalStars,
  varietyBonus,
} from "./progress";

const lives: LivesRules = { startWith: 5, perDay: 5, cap: 10 };
const stars = { healthFraction: 0.5, clockFraction: 0.25 };
const score: ScoreRules = {
  hitBase: 10,
  perDamage: 2,
  comboStep: 0.1,
  comboCap: 20,
  comboWindow: 100,
  varietyBonus: [0, 0, 100, 300, 800],
  koBonus: 100,
  bossBonus: 2000,
  timeRate: 20,
  healthRate: 15,
};
const order = ["a", "b", "c"];
const win = { won: true, healthFraction: 0.8, clockFraction: 0.5, score: 1000, bestCombo: 9 };

describe("stars", () => {
  it("are independent: finish, half health, quarter clock", () => {
    expect(computeStars(win, stars)).toEqual([true, true, true]);
    expect(computeStars({ ...win, healthFraction: 0.49 }, stars)).toEqual([true, false, true]);
    expect(computeStars({ ...win, clockFraction: 0.2 }, stars)).toEqual([true, true, false]);
    expect(computeStars({ ...win, won: false }, stars)).toEqual([false, false, false]);
  });

  it("are kept once earned, each on its own, across attempts", () => {
    let save = newSave(lives, "2026-11-14");
    save = recordOutcome(save, "a", { ...win, clockFraction: 0.1 }, stars);
    save = recordOutcome(save, "a", { ...win, healthFraction: 0.1, score: 500 }, stars);
    expect(save.levels.a.stars).toEqual([true, true, true]);
    expect(save.levels.a.bestScore).toBe(1000);
    expect(totalStars(save)).toBe(3);
  });

  it("a loss records the combo but nothing else", () => {
    const save = recordOutcome(newSave(lives, "2026-11-14"), "a", { ...win, won: false, bestCombo: 14 }, stars);
    expect(save.levels.a.cleared).toBe(false);
    expect(save.levels.a.bestScore).toBe(0);
    expect(save.levels.a.bestCombo).toBe(14);
  });
});

describe("unlocks", () => {
  it("the first level is open; each next one opens when the one before is cleared", () => {
    let save = newSave(lives, "2026-11-14");
    expect(isUnlocked(save, order, "a")).toBe(true);
    expect(isUnlocked(save, order, "b")).toBe(false);
    expect(currentLevel(save, order)).toBe("a");
    save = recordOutcome(save, "a", win, stars);
    expect(isUnlocked(save, order, "b")).toBe(true);
    expect(isUnlocked(save, order, "c")).toBe(false);
    expect(currentLevel(save, order)).toBe("b");
    expect(isUnlocked(save, order, "nope")).toBe(false);
  });
});

describe("lives", () => {
  it("every attempt costs one, and none are left at zero", () => {
    let save = newSave(lives, "2026-11-14");
    for (let i = 0; i < 5; i++) save = spendLife(save)!;
    expect(save.lives).toBe(0);
    expect(spendLife(save)).toBeNull();
  });

  it("a new calendar day grants lives up to the cap, once", () => {
    let save = { ...newSave(lives, "2026-11-14"), lives: 2 };
    const same = grantDaily(save, "2026-11-14", lives);
    expect(same.granted).toBe(0);
    const next = grantDaily(save, "2026-11-15", lives);
    expect(next.granted).toBe(5);
    expect(next.save.lives).toBe(7);
    save = { ...next.save, lives: 8 };
    const capped = grantDaily(save, "2026-11-16", lives);
    expect(capped.save.lives).toBe(10);
    expect(capped.granted).toBe(2);
    expect(grantDaily(capped.save, "2026-11-16", lives).granted).toBe(0);
  });

  it("setting the device clock back grants nothing", () => {
    const save = newSave(lives, "2026-11-14");
    expect(grantDaily(save, "2026-11-01", lives).granted).toBe(0);
  });

  it("dayKey is the local calendar day", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("save model", () => {
  it("survives garbage, partial and old data", () => {
    expect(migrate(null, lives, "2026-11-14").lives).toBe(5);
    expect(migrate("nonsense", lives, "2026-11-14").levels).toEqual({});
    const partial = migrate({ lives: 99, levels: { a: { cleared: true, stars: [true] } }, settings: { sfx: 0.2 } }, lives, "2026-11-14");
    expect(partial.lives).toBe(10);
    expect(partial.levels.a).toEqual({ cleared: true, stars: [true, false, false], bestScore: 0, bestCombo: 0 });
    expect(partial.settings.sfx).toBe(0.2);
    expect(partial.settings.difficulty).toBe("normal");
    expect(partial.version).toBe(1);
  });
});

describe("score", () => {
  it("points per hit scale with the combo, up to a cap", () => {
    expect(hitPoints(5, 0, score)).toBe(20);
    expect(hitPoints(5, 10, score)).toBe(40);
    expect(hitPoints(5, 99, score)).toBe(hitPoints(5, 20, score));
  });

  it("limb variety pays only on real combos", () => {
    expect(varietyBonus(2, 4, score)).toBe(0);
    expect(varietyBonus(5, 1, score)).toBe(0);
    expect(varietyBonus(5, 3, score)).toBe(300);
    expect(varietyBonus(8, 4, score)).toBe(800);
  });

  it("time and health bonuses come from what is left at the finish", () => {
    expect(finishBonuses(60, 80, score)).toEqual({ time: 1200, health: 1200 });
  });
});
