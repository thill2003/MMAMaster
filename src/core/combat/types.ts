import type { DepthBand } from "@/core/depth";
import type { Limb } from "@/core/input";

export type Team = "player" | "enemy";

export type FighterState =
  | "idle"
  | "walk"
  | "dash"
  | "strike"
  | "guard"
  | "blockstun"
  | "hit"
  | "stagger"
  | "knockdown"
  | "getup"
  | "ko"
  | "clinch"
  | "clinched"
  | "intro"
  | "win";

/** One strike. All timings are 60 Hz ticks; all distances are logical pixels. Lives in `content/moves`. */
export interface StrikeDef {
  id: string;
  name: string;
  limb: Limb;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Farthest target x in front of the attacker that still connects. */
  reach: number;
  /** Nearest target x that connects (default just behind the attacker's centre). */
  minReach?: number;
  hitStun: number;
  /** Initial slide speed given to the target, px/tick. */
  knockback: number;
  knockdown?: boolean;
  /** Fraction of damage that goes through a guard (default: tuning.chipDefault). */
  chip?: number;
  /** Total forward distance travelled during startup. */
  lunge?: number;
  /** Forward distance travelled per tick while active (flying strikes). */
  travel?: number;
  /** Tick from the start of the strike when a landed hit may cancel into the next string step. */
  cancelAt?: number;
  /** A low kick: checking it staggers the kicker. */
  low?: boolean;
  effect?: "slow" | "push" | "stun";
  effectTicks?: number;
  /** The attacker can't be stopped until the strike has finished its active frames. */
  armor?: boolean;
  unblockable?: boolean;
  /** Heavier hit-stop and shake. */
  heavy?: boolean;
  /** Animation key the engine draws for this strike. */
  pose: string;
}

/**
 * A fighter's strings as data. Keys are `limb.press.dir` (see core/input `inputKey`).
 * `openers` start a string; `links[strikeId]` lists what each input does next from that strike.
 * An input with no explicit link falls back to that limb's opener when it switches limbs.
 */
export interface MoveSet {
  strikes: Record<string, StrikeDef>;
  openers: Record<string, string>;
  links: Record<string, Record<string, string>>;
  clinch: ClinchMoves;
  /** Longest string, in strikes. */
  maxString: number;
}

export interface ClinchMoves {
  knee: StrikeDef;
  elbow: StrikeDef;
  dump: StrikeDef;
}

export type ClinchAction = keyof ClinchMoves;

export interface FighterStats {
  maxHp: number;
  walkSpeed: number;
  depthSpeed: number;
  dashSpeed: number;
  dashTicks: number;
  /** Multiplier on knockback received. */
  knockbackTaken: number;
  /** Multiplier on damage dealt. */
  damageDealt: number;
}

export interface Fighter {
  id: number;
  team: Team;
  /** Archetype or character id — picks the look and the brain. */
  kind: string;
  rank: number;
  name: string;
  isBoss: boolean;
  x: number;
  z: number;
  vx: number;
  facing: 1 | -1;
  hp: number;
  stats: FighterStats;
  state: FighterState;
  stateTick: number;
  /** Length of the current hit, stagger or block stun. */
  stun: number;
  strike: StrikeDef | null;
  /** Ids already struck by the current strike. */
  strikeHit: number[];
  /** The current strike touched something (hit or blocked) — opens the cancel window. */
  landed: boolean;
  lastStrikeId: string | null;
  lastStrikeEnd: number;
  stringLen: number;
  stringLimbs: Limb[];
  dashDir: 1 | -1;
  invuln: number;
  slow: number;
  /** Tick guard last went down; a strike landing within the check window is checked. */
  guardPressedAt: number;
  clinchWith: number | null;
  clinchCharge: number;
  clinchKnees: number;
  clinchAction: ClinchAction | null;
  clinchActionTick: number;
  clinchMoves: ClinchMoves;
  /** Knees a holder gets before this fighter breaks the clinch. */
  clinchKneeCap: number;
  clinchable: boolean;
  mashCount: number;
  /** Takes reduced damage and no stun. Set each tick by a boss brain. */
  armor: boolean;
  /** A push (teep) goes through armor and staggers. */
  pushBreaksArmor: boolean;
  /** Turns any frontal strike back on the attacker. Set each tick by a boss brain. */
  parry: boolean;
  /** Drawn winded, hands down — a punish window. */
  tired: boolean;
  /** Drawn coiled — a tell before a rush. */
  telegraph: boolean;
  /** Hits taken in a row without recovering. At the cap the next hit knocks down — no infinite strings. */
  hitChain: number;
  thrown: boolean;
  thrownHit: number[];
  remove: boolean;
}

export interface Command {
  moveX: number;
  moveZ: number;
  guard: boolean;
  guardPressed: boolean;
  dash: -1 | 0 | 1;
  strike: StrikeDef | null;
  /** The strike continues the current string instead of opening a new one. */
  continuesString: boolean;
  clinchAction: ClinchAction | null;
  /** Grab on contact (player: holding forward into an enemy). */
  wantClinch: boolean;
  mash: number;
  /** Facing override; 0 = face the direction of travel. */
  face: 1 | -1 | 0;
}

export const blankCommand = (): Command => ({
  moveX: 0,
  moveZ: 0,
  guard: false,
  guardPressed: false,
  dash: 0,
  strike: null,
  continuesString: false,
  clinchAction: null,
  wantClinch: false,
  mash: 0,
  face: 0,
});

export type HitResult = "hit" | "block" | "check" | "parry" | "armor";

export type CombatEvent =
  | { type: "strike"; fighterId: number; strikeId: string; limb: Limb }
  | {
      type: "hit";
      attackerId: number;
      targetId: number;
      strikeId: string;
      limb: Limb;
      result: HitResult;
      damage: number;
      x: number;
      z: number;
      heavy: boolean;
      knockdown: boolean;
      ko: boolean;
    }
  | { type: "clinch"; attackerId: number; targetId: number }
  | { type: "clinchBreak"; attackerId: number; targetId: number; reason: ClinchBreakReason }
  | { type: "ko"; fighterId: number; byId: number | null };

export type ClinchBreakReason = "elbow" | "knees" | "timeout" | "escape" | "hit" | "dump" | "ko";

export interface CombatTuning {
  depthTolerance: number;
  friction: number;
  hitStop: number;
  heavyHitStop: number;
  koHitStop: number;
  chipDefault: number;
  blockStun: number;
  checkWindow: number;
  checkRecoil: number;
  lowCheckStagger: number;
  parryStagger: number;
  knockdownFall: number;
  knockdownDown: number;
  getUp: number;
  getUpInvuln: number;
  koTicks: number;
  linkGrace: number;
  backpedal: number;
  slowFactor: number;
  armorDamage: number;
  lockOnRange: number;
  lockOnDepth: number;
  clinchBeat: number;
  clinchRange: number;
  clinchDepth: number;
  clinchHold: number;
  clinchTimeout: number;
  clinchEscapeMash: number;
  throwSpeed: number;
  throwSplashDamage: number;
  pushStagger: number;
  /** Hits a fighter can take in one unbroken string before the next one knocks them down. */
  maxHitChain: number;
  /** Fighters on opposite teams can't stand closer than this on the same depth line. */
  bodyWidth: number;
  bodyDepth: number;
}

export interface CombatWorld {
  tick: number;
  tuning: CombatTuning;
  band: DepthBand;
  fighters: Fighter[];
  events: CombatEvent[];
  /** Ticks the whole fight stays frozen after a hit. */
  hitStop: number;
}
