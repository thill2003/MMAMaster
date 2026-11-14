/**
 * Progress rules: unlocks, stars, score bonuses, lives and the daily grant, and the versioned save model.
 * Pure functions over plain data — storage lives in platform/, the numbers live in content/.
 */
export type Difficulty = "easy" | "normal" | "hard";

export interface Settings {
  difficulty: Difficulty;
  music: number;
  sfx: number;
  haptics: boolean;
  leftHanded: boolean;
  /** Multiplier on the device profile's button size. */
  buttonScale: number;
  reduceShake: boolean;
  showHints: boolean;
  debug: boolean;
}

export interface LevelRecord {
  cleared: boolean;
  /** [finished, half health, quarter clock] */
  stars: [boolean, boolean, boolean];
  bestScore: number;
  bestCombo: number;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelRecord>;
  lives: number;
  /** Local calendar day of the last daily grant, YYYY-MM-DD. */
  lastGrantDate: string;
  settings: Settings;
}

export interface LivesRules {
  startWith: number;
  perDay: number;
  cap: number;
}

export interface StarRules {
  healthFraction: number;
  clockFraction: number;
}

export interface ScoreRules {
  hitBase: number;
  perDamage: number;
  /** Extra multiplier per hit already in the combo. */
  comboStep: number;
  comboCap: number;
  /** Ticks without a hit before the combo drops. */
  comboWindow: number;
  /** Bonus by number of different limbs used in a combo of 3+ hits: index = limb count. */
  varietyBonus: number[];
  koBonus: number;
  bossBonus: number;
  /** Points per second left on the clock. */
  timeRate: number;
  /** Points per health point left. */
  healthRate: number;
}

export interface FightOutcome {
  won: boolean;
  healthFraction: number;
  clockFraction: number;
  score: number;
  bestCombo: number;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "normal",
  music: 0.6,
  sfx: 0.8,
  haptics: true,
  leftHanded: false,
  buttonScale: 1,
  reduceShake: false,
  showHints: true,
  debug: false,
};

export const SAVE_VERSION = 1;

export const newSave = (rules: LivesRules, today: string): SaveData => ({
  version: SAVE_VERSION,
  levels: {},
  lives: rules.startWith,
  lastGrantDate: today,
  settings: { ...DEFAULT_SETTINGS },
});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Accept whatever was stored — an older version, a partial object, garbage — and return a valid save. */
export const migrate = (raw: unknown, rules: LivesRules, today: string): SaveData => {
  const base = newSave(rules, today);
  if (!isRecord(raw)) return base;
  const levels: Record<string, LevelRecord> = {};
  if (isRecord(raw.levels)) {
    for (const [id, rec] of Object.entries(raw.levels)) {
      if (!isRecord(rec)) continue;
      const s = Array.isArray(rec.stars) ? rec.stars : [];
      levels[id] = {
        cleared: !!rec.cleared,
        stars: [!!s[0], !!s[1], !!s[2]],
        bestScore: typeof rec.bestScore === "number" ? rec.bestScore : 0,
        bestCombo: typeof rec.bestCombo === "number" ? rec.bestCombo : 0,
      };
    }
  }
  const settings = { ...DEFAULT_SETTINGS, ...(isRecord(raw.settings) ? (raw.settings as Partial<Settings>) : {}) };
  return {
    version: SAVE_VERSION,
    levels,
    lives: typeof raw.lives === "number" ? Math.max(0, Math.min(rules.cap, Math.floor(raw.lives))) : base.lives,
    lastGrantDate: typeof raw.lastGrantDate === "string" ? raw.lastGrantDate : today,
    settings,
  };
};

/** Local calendar day as YYYY-MM-DD. v1 reads the device date; server time arrives with accounts (MM-133). */
export const dayKey = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** Opening the game on a new calendar day grants lives, up to the cap. Returns how many were granted. */
export const grantDaily = (save: SaveData, today: string, rules: LivesRules): { save: SaveData; granted: number } => {
  if (today <= save.lastGrantDate) return { save, granted: 0 };
  const lives = Math.min(rules.cap, save.lives + rules.perDay);
  return { save: { ...save, lives, lastGrantDate: today }, granted: lives - save.lives };
};

/** Every attempt at a level costs one life. Returns null when there are none left. */
export const spendLife = (save: SaveData): SaveData | null => (save.lives > 0 ? { ...save, lives: save.lives - 1 } : null);

export const computeStars = (o: FightOutcome, rules: StarRules): [boolean, boolean, boolean] => [
  o.won,
  o.won && o.healthFraction >= rules.healthFraction,
  o.won && o.clockFraction >= rules.clockFraction,
];

export const starCount = (stars: readonly boolean[]): number => stars.filter(Boolean).length;

export const recordOutcome = (save: SaveData, levelId: string, o: FightOutcome, rules: StarRules): SaveData => {
  const prev = save.levels[levelId] ?? { cleared: false, stars: [false, false, false], bestScore: 0, bestCombo: 0 };
  const now = computeStars(o, rules);
  const next: LevelRecord = {
    cleared: prev.cleared || o.won,
    // Stars are kept once earned, each on its own.
    stars: [prev.stars[0] || now[0], prev.stars[1] || now[1], prev.stars[2] || now[2]],
    bestScore: o.won ? Math.max(prev.bestScore, o.score) : prev.bestScore,
    bestCombo: Math.max(prev.bestCombo, o.bestCombo),
  };
  return { ...save, levels: { ...save.levels, [levelId]: next } };
};

/** A level is open when it is the first, or the one before it has been cleared. */
export const isUnlocked = (save: SaveData, order: readonly string[], levelId: string): boolean => {
  const i = order.indexOf(levelId);
  if (i <= 0) return i === 0;
  return !!save.levels[order[i - 1]]?.cleared;
};

/** The node the map highlights: the first level not yet cleared (or the last one when all are). */
export const currentLevel = (save: SaveData, order: readonly string[]): string =>
  order.find((id) => !save.levels[id]?.cleared) ?? order[order.length - 1];

export const totalStars = (save: SaveData): number => Object.values(save.levels).reduce((n, r) => n + starCount(r.stars), 0);

export const bestTotalScore = (save: SaveData): number => Object.values(save.levels).reduce((n, r) => n + r.bestScore, 0);

export const hitPoints = (damage: number, comboBefore: number, rules: ScoreRules): number =>
  Math.round((rules.hitBase + damage * rules.perDamage) * (1 + rules.comboStep * Math.min(comboBefore, rules.comboCap)));

export const varietyBonus = (hits: number, limbs: number, rules: ScoreRules): number =>
  hits >= 3 ? (rules.varietyBonus[Math.min(limbs, rules.varietyBonus.length - 1)] ?? 0) : 0;

export const finishBonuses = (secondsLeft: number, healthLeft: number, rules: ScoreRules): { time: number; health: number } => ({
  time: Math.round(secondsLeft * rules.timeRate),
  health: Math.round(healthLeft * rules.healthRate),
});
