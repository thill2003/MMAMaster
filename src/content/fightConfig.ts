import type { FightConfig } from "@/core/fight";
import type { Difficulty } from "@/core/progress";

import {
  ARCHETYPES,
  COMBAT_TUNING,
  DIFFICULTIES,
  INPUT_TUNING,
  ITEM_RULES,
  PLAYER_STATS,
  rampFor,
  RANKS,
  SCORE_RULES,
} from "./fighters/tuning";
import { ENEMY_CLINCH, ENEMY_STRIKES } from "./moves/enemies";
import { PLAYER_MOVES } from "./moves/player";
import type { TownDef } from "./towns/stLouis";

/** Everything one attempt at a town needs, assembled from content. */
export const buildFightConfig = (
  town: TownDef,
  difficulty: Difficulty,
  viewWidth: number,
  opts: { invincible?: boolean; metroIndex?: number } = {},
): FightConfig => ({
  level: town,
  playerMoves: PLAYER_MOVES,
  playerStats: PLAYER_STATS,
  enemyStrikes: ENEMY_STRIKES,
  enemyClinch: ENEMY_CLINCH,
  archetypes: ARCHETYPES,
  ranks: RANKS,
  tuning: COMBAT_TUNING,
  inputTuning: INPUT_TUNING,
  score: SCORE_RULES,
  difficulty: DIFFICULTIES[difficulty],
  ramp: rampFor(town.index, opts.metroIndex ?? 0),
  item: ITEM_RULES,
  viewWidth,
  invincible: opts.invincible,
});
