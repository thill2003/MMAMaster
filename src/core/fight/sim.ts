import { type AiEvent, type ArchetypeDef, assignTokens, BossBrain, type Brain, GruntBrain, type RankDef } from "@/core/ai";
import {
  blankCommand,
  type ClinchMoves,
  type CombatEvent,
  type CombatTuning,
  type CombatWorld,
  createFighter,
  type Fighter,
  type FighterStats,
  knockOut,
  type MoveSet,
  PlayerController,
  resolveStrikes,
  resolveThrown,
  separateBodies,
  setState,
  stepFighter,
  type StrikeDef,
} from "@/core/combat";
import { DEFAULT_BAND, type DepthBand } from "@/core/depth";
import { Gauntlet, buildSchedule, type HoldDef, type LevelDef, LevelClock, type SpawnEntry } from "@/core/gauntlet";
import { type InputFrame, type InputTuning, type Limb } from "@/core/input";
import { finishBonuses, hitPoints, type ScoreRules, varietyBonus } from "@/core/progress";
import { clamp } from "@/shared/math";
import { Rng } from "@/shared/rng";

export interface ArchetypeEntry extends ArchetypeDef {
  stats: FighterStats;
  clinchable: boolean;
}

export interface DifficultyDef {
  enemyHp: number;
  enemyDamage: number;
  density: number;
  clock: number;
  /** Extra ticks on the check window. */
  checkWindowBonus: number;
  /** Extra energy drinks at the start. */
  extraItems: number;
}

export interface ItemRules {
  heal: number;
  max: number;
  start: number;
}

export interface FightConfig {
  level: LevelDef;
  playerMoves: MoveSet;
  playerStats: FighterStats;
  enemyStrikes: Record<string, StrikeDef>;
  enemyClinch: ClinchMoves;
  archetypes: Record<string, ArchetypeEntry>;
  ranks: RankDef[];
  tuning: CombatTuning;
  inputTuning: InputTuning;
  score: ScoreRules;
  difficulty: DifficultyDef;
  /** Progressive ramp for this level (and metro), applied to grunts. */
  ramp: { enemyHp: number; enemyDamage: number };
  item: ItemRules;
  /** Logical width of the view, px. */
  viewWidth: number;
  band?: DepthBand;
  /** Debug: the player takes no damage. */
  invincible?: boolean;
}

export type FightPhase = "ready" | "fight" | "leaderIntro" | "leader" | "won" | "ko" | "timeout";

export type FightEvent =
  | CombatEvent
  | AiEvent
  | { type: "spawn"; fighterId: number }
  | { type: "hold"; x: number }
  | { type: "holdCleared" }
  | { type: "leaderIntro"; fighterId: number }
  | { type: "drop"; x: number; z: number }
  | { type: "pickup" }
  | { type: "heal"; amount: number }
  | { type: "comboEnd"; hits: number; limbs: number; bonus: number }
  | { type: "clockWarning"; seconds: number }
  | { type: "phase"; phase: FightPhase };

export interface Drop {
  id: number;
  x: number;
  z: number;
}

export interface HudState {
  phase: FightPhase;
  hp: number;
  maxHp: number;
  clockSeconds: number;
  clockFraction: number;
  score: number;
  combo: number;
  items: number;
  progress: number;
  boss: { name: string; title: string; hp: number; maxHp: number } | null;
  slowed: boolean;
  clinched: boolean;
}

export interface FightResult {
  outcome: "won" | "ko" | "timeout";
  healthFraction: number;
  clockFraction: number;
  /** Score from hits, combos and KOs. */
  baseScore: number;
  timeBonus: number;
  healthBonus: number;
  score: number;
  bestCombo: number;
  hits: number;
  kos: number;
  ticks: number;
}

const READY_TICKS = 50;
const END_TICKS = 150;
const PLAYER_ID = 1;

/**
 * One attempt at one town, start to finish. The whole fight is this object: feed it one InputFrame per 60 Hz
 * tick and read the state back. It never sees a frame time, a canvas or a clock.
 */
export class FightSim {
  readonly config: FightConfig;
  readonly world: CombatWorld;
  readonly player: Fighter;
  readonly clock: LevelClock;
  readonly gauntlet: Gauntlet;
  readonly viewWidth: number;
  tick = 0;
  phase: FightPhase = "ready";
  phaseTick = 0;
  cameraX = 0;
  score = 0;
  combo = 0;
  bestCombo = 0;
  hits = 0;
  kos = 0;
  items: number;
  drops: Drop[] = [];
  boss: Fighter | null = null;
  finished = false;
  /** Events raised during the last step. */
  events: FightEvent[] = [];

  private readonly rng: Rng;
  private readonly controller: PlayerController;
  private readonly brains: Brain[] = [];
  private readonly dropCarriers = new Set<number>();
  private readonly allStrikes: Record<string, StrikeDef>;
  private prevCombat: CombatEvent[] = [];
  private nextId = PLAYER_ID + 1;
  private nextDropId = 1;
  private progressX = 0;
  private furthestCam = 0;
  private comboTimer = 0;
  private comboLimbs: Limb[] = [];
  private holdIds: number[] | null = null;
  private lastWarned = -1;

  constructor(config: FightConfig) {
    this.config = config;
    this.viewWidth = config.viewWidth;
    const band = config.band ?? DEFAULT_BAND;
    this.rng = new Rng(config.level.seed);
    const tuning: CombatTuning = {
      ...config.tuning,
      checkWindow: config.tuning.checkWindow + config.difficulty.checkWindowBonus,
    };
    this.world = { tick: 0, tuning, band, fighters: [], events: [], hitStop: 0 };
    this.player = createFighter({
      id: PLAYER_ID,
      team: "player",
      kind: "player",
      name: "Player",
      x: 150,
      z: (band.min + band.max) / 2,
      facing: 1,
      stats: { ...config.playerStats },
      clinchMoves: config.playerMoves.clinch,
    });
    this.world.fighters.push(this.player);
    this.controller = new PlayerController(config.playerMoves, config.inputTuning.bufferTicks);
    this.clock = new LevelClock(config.level.clockSeconds * config.difficulty.clock);
    this.gauntlet = new Gauntlet(
      config.level,
      buildSchedule(config.level, new Rng(config.level.seed ^ 0x9e3779b9), config.difficulty.density),
    );
    this.items = Math.min(config.item.max, config.item.start + config.difficulty.extraItems);
    this.allStrikes = { ...config.enemyStrikes };
  }

  // ---------------------------------------------------------------- bounds

  private get leaderArenaLeft(): number {
    return this.config.level.length - this.viewWidth / 2;
  }

  private cameraBounds(): { min: number; max: number } {
    const holdX = this.gauntlet.activeHoldX;
    if (holdX !== null) {
      const c = Math.max(0, holdX - this.viewWidth / 2);
      return { min: c, max: c };
    }
    if (this.phase === "leaderIntro" || this.phase === "leader" || this.phase === "won") {
      return { min: this.leaderArenaLeft, max: this.leaderArenaLeft };
    }
    return { min: Math.max(0, this.furthestCam - 140), max: this.leaderArenaLeft };
  }

  // ---------------------------------------------------------------- spawning

  private spawnGrunt(entry: { kind: string; rank: number; side: 1 | -1; zFrac: number; drop: boolean }): Fighter {
    const c = this.config;
    const arch = c.archetypes[entry.kind] ?? Object.values(c.archetypes)[0];
    const rank = c.ranks[clamp(entry.rank, 0, c.ranks.length - 1)];
    const band = this.world.band;
    const stats: FighterStats = {
      ...arch.stats,
      maxHp: Math.max(1, Math.round(arch.stats.maxHp * rank.hp * c.difficulty.enemyHp * c.ramp.enemyHp)),
      walkSpeed: arch.stats.walkSpeed * rank.speed,
      depthSpeed: arch.stats.depthSpeed * rank.speed,
      damageDealt: arch.stats.damageDealt * rank.damage * c.difficulty.enemyDamage * c.ramp.enemyDamage,
    };
    const x = entry.side === 1 ? this.cameraX + this.viewWidth + 40 + this.rng.range(0, 70) : this.cameraX - 40 - this.rng.range(0, 70);
    const f = createFighter({
      id: this.nextId++,
      team: "enemy",
      kind: arch.id,
      rank: entry.rank,
      x,
      z: band.min + (band.max - band.min) * entry.zFrac,
      facing: entry.side === 1 ? -1 : 1,
      stats,
      clinchMoves: c.enemyClinch,
      clinchable: arch.clinchable,
    });
    this.world.fighters.push(f);
    // Most wait on the side they came from; some cross over to surround.
    const hoverSide = (this.rng.chance(0.3) ? -entry.side : entry.side) as 1 | -1;
    const zOffset = this.rng.range(28, 62) * (this.rng.chance(0.5) ? 1 : -1);
    this.brains.push(new GruntBrain(f.id, arch, rank, hoverSide, zOffset, this.rng.int(20, 70)));
    if (entry.drop) this.dropCarriers.add(f.id);
    this.events.push({ type: "spawn", fighterId: f.id });
    return f;
  }

  private startHold(hold: HoldDef): void {
    this.holdIds = [];
    hold.pack.forEach((m, i) => {
      const f = this.spawnGrunt({
        kind: m.kind,
        rank: m.rank,
        side: i % 3 === 2 ? -1 : 1,
        zFrac: (i + 0.5) / hold.pack.length,
        drop: i === hold.pack.length - 1,
      });
      this.holdIds!.push(f.id);
    });
    this.events.push({ type: "hold", x: this.gauntlet.activeHoldX ?? this.player.x });
  }

  private spawnLeader(): void {
    const c = this.config;
    const L = c.level.leader;
    const band = this.world.band;
    const f = createFighter({
      id: this.nextId++,
      team: "enemy",
      kind: L.kind,
      name: L.name,
      isBoss: true,
      rank: 3,
      x: this.cameraX + this.viewWidth + 70,
      z: (band.min + band.max) / 2,
      facing: -1,
      stats: {
        maxHp: Math.round(L.hp * c.difficulty.enemyHp),
        walkSpeed: L.walkSpeed,
        depthSpeed: L.walkSpeed * 0.65,
        dashSpeed: 8.5,
        dashTicks: 12,
        knockbackTaken: L.knockbackTaken,
        damageDealt: L.damage * c.difficulty.enemyDamage,
      },
      clinchMoves: c.enemyClinch,
      clinchable: L.clinchable,
      clinchKneeCap: L.clinchKneeCap,
    });
    f.state = "intro";
    this.world.fighters.push(f);
    this.brains.push(new BossBrain(f.id, L.boss));
    this.boss = f;
    this.setPhase("leaderIntro");
    this.events.push({ type: "leaderIntro", fighterId: f.id });
  }

  // ---------------------------------------------------------------- scoring

  private endCombo(): void {
    if (this.combo > 0) {
      const bonus = varietyBonus(this.combo, this.comboLimbs.length, this.config.score);
      this.score += bonus;
      this.events.push({ type: "comboEnd", hits: this.combo, limbs: this.comboLimbs.length, bonus });
    }
    this.combo = 0;
    this.comboLimbs = [];
    this.comboTimer = 0;
  }

  private onCombatEvent(e: CombatEvent): void {
    const rules = this.config.score;
    if (e.type === "hit") {
      if (e.attackerId === PLAYER_ID || (e.strikeId === "thrown" && e.targetId !== PLAYER_ID)) {
        if (e.result === "hit" || e.result === "armor") {
          this.score += hitPoints(e.damage, this.combo, rules);
          this.combo++;
          this.hits++;
          this.comboTimer = 0;
          if (!this.comboLimbs.includes(e.limb)) this.comboLimbs.push(e.limb);
          if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        } else if (e.result === "parry") {
          this.endCombo();
        }
      } else if (e.targetId === PLAYER_ID && e.result === "hit") {
        this.endCombo();
      } else if (e.targetId === PLAYER_ID && e.result === "check") {
        this.score += rules.hitBase * 5;
      }
    } else if (e.type === "ko" && e.fighterId !== PLAYER_ID) {
      this.kos++;
      const f = this.world.fighters.find((o) => o.id === e.fighterId);
      this.score += f?.isBoss ? rules.bossBonus : Math.round(rules.koBonus * (1 + 0.5 * (f?.rank ?? 0)));
      if (f && this.dropCarriers.has(f.id)) {
        this.dropCarriers.delete(f.id);
        this.drops.push({ id: this.nextDropId++, x: f.x, z: f.z });
        this.events.push({ type: "drop", x: f.x, z: f.z });
      }
    }
  }

  // ---------------------------------------------------------------- phases

  private setPhase(phase: FightPhase): void {
    this.phase = phase;
    this.phaseTick = 0;
    this.events.push({ type: "phase", phase });
  }

  private updateCamera(): void {
    const b = this.cameraBounds();
    const p = this.player;
    const target = clamp(p.x - this.viewWidth * 0.4 + p.facing * 30, b.min, Math.max(b.min, b.max));
    this.cameraX += (target - this.cameraX) * 0.1;
    if (Math.abs(target - this.cameraX) < 0.3) this.cameraX = target;
    if (this.cameraX > this.furthestCam) this.furthestCam = this.cameraX;
  }

  private clampFighters(): void {
    const left = this.cameraX + 26;
    const right = this.cameraX + this.viewWidth - 26;
    const p = this.player;
    p.x = clamp(p.x, left, right);
    if (this.phase === "leader" || this.phase === "leaderIntro") {
      for (const f of this.world.fighters) {
        if (f.team === "enemy" && f.state !== "intro") f.x = clamp(f.x, left, right);
      }
    }
  }

  // ---------------------------------------------------------------- step

  step(input: InputFrame): void {
    this.events = [];
    if (this.finished) return;
    this.tick++;
    this.controller.feed(input, this.tick);

    const w = this.world;
    if (w.hitStop > 0) {
      w.hitStop--;
      return;
    }
    w.tick = this.tick;
    w.events = [];
    this.phaseTick++;
    const p = this.player;

    if (this.phase === "ready" && this.phaseTick >= READY_TICKS) this.setPhase("fight");

    // --- the stream
    if (this.phase === "fight") {
      this.progressX = Math.max(this.progressX, p.x);
      const alive = w.fighters.filter((f) => f.team === "enemy" && f.state !== "ko").length;
      const up = this.gauntlet.update(this.progressX, alive);
      for (const s of up.spawns) this.spawnGrunt(s as SpawnEntry);
      if (up.holdStarted) this.startHold(up.holdStarted);
      if (this.holdIds && this.holdIds.every((id) => !w.fighters.some((f) => f.id === id && f.state !== "ko"))) {
        this.holdIds = null;
        this.gauntlet.holdCleared();
        this.events.push({ type: "holdCleared" });
      }
      if (up.leaderReady && alive === 0) this.spawnLeader();
    }

    // --- item
    if (input.item && this.items > 0 && p.state !== "ko" && p.hp < p.stats.maxHp) {
      this.items--;
      const before = p.hp;
      p.hp = Math.min(p.stats.maxHp, p.hp + this.config.item.heal);
      this.events.push({ type: "heal", amount: p.hp - before });
    }

    // --- orders
    const fighting = this.phase === "fight" || this.phase === "leader" || this.phase === "ready";
    const commands = new Map<number, ReturnType<typeof blankCommand>>();
    if (p.state !== "ko" && p.state !== "win") {
      commands.set(p.id, this.phase === "won" ? blankCommand() : this.controller.command(p, w));
    }
    if (fighting || this.phase === "leaderIntro") {
      assignTokens(this.brains, w.fighters, p, this.gauntlet.maxEngaged(this.progressX));
      const view = {
        tick: this.tick,
        player: p,
        fighters: w.fighters,
        strikes: this.allStrikes,
        rng: this.rng,
        band: w.band,
        minX: this.cameraX + 30,
        maxX: this.cameraX + this.viewWidth - 30,
        events: this.prevCombat,
        emit: (e: AiEvent) => {
          this.events.push(e);
          // A phase change throws the player back to reset the exchange.
          if (e.type === "bossPhase" && Math.abs(p.x - (this.boss?.x ?? 0)) < 170 && p.state !== "ko") {
            p.vx = (p.x >= (this.boss?.x ?? 0) ? 1 : -1) * 10;
          }
        },
      };
      for (const b of this.brains) {
        const f = w.fighters.find((o) => o.id === b.fighterId);
        if (!f || f.state === "ko") continue;
        commands.set(f.id, p.state === "ko" ? blankCommand() : b.think(f, view));
      }
    }

    // --- leader walk-on
    if (this.phase === "leaderIntro" && this.boss) {
      const spot = this.cameraX + this.viewWidth * 0.74;
      if (this.boss.x > spot) this.boss.x -= 2.4;
      if (this.boss.x <= spot && this.phaseTick >= 70) {
        this.boss.state = "idle";
        this.boss.stateTick = 0;
        this.setPhase("leader");
      }
    }

    // --- move, then hit
    const hpBefore = p.hp;
    for (const f of w.fighters) stepFighter(f, commands.get(f.id) ?? blankCommand(), w);
    separateBodies(w);
    resolveStrikes(w);
    resolveThrown(w);
    if (this.config.invincible && p.hp < hpBefore) {
      p.hp = hpBefore;
      if (p.state === "ko") setState(p, "idle");
    }

    for (const e of w.events) {
      this.onCombatEvent(e);
      this.events.push(e);
    }
    this.prevCombat = w.events;

    // --- combo window
    if (this.combo > 0) {
      this.comboTimer++;
      if (this.comboTimer > this.config.score.comboWindow) this.endCombo();
    }

    // --- pickups
    if (p.state !== "ko" && this.drops.length > 0) {
      this.drops = this.drops.filter((d) => {
        const near = Math.abs(d.x - p.x) < 30 && Math.abs(d.z - p.z) < 22;
        if (near && this.items < this.config.item.max) {
          this.items++;
          this.events.push({ type: "pickup" });
          return false;
        }
        return true;
      });
    }

    // --- clean up
    for (let i = w.fighters.length - 1; i >= 0; i--) {
      const f = w.fighters[i];
      if (f.remove) {
        w.fighters.splice(i, 1);
        const bi = this.brains.findIndex((b) => b.fighterId === f.id);
        if (bi >= 0) this.brains.splice(bi, 1);
      }
    }

    // --- clock and endings
    if (this.phase === "fight" || this.phase === "leader") {
      const expired = this.clock.tick();
      const secs = this.clock.seconds;
      if ((secs === 30 || secs <= 10) && secs !== this.lastWarned && this.clock.left % 60 === 0 && secs > 0) {
        this.lastWarned = secs;
        this.events.push({ type: "clockWarning", seconds: secs });
      }
      if (p.state === "ko") {
        this.endCombo();
        this.setPhase("ko");
      } else if (expired) {
        this.endCombo();
        knockOut(p, -p.facing * 3, w, null);
        this.events.push({ type: "ko", fighterId: p.id, byId: null });
        this.setPhase("timeout");
      } else if (this.phase === "leader" && this.boss && this.boss.state === "ko") {
        this.endCombo();
        this.setPhase("won");
      }
    } else if (this.phase === "won") {
      if (this.phaseTick === 70 && p.state !== "ko") {
        p.state = "win";
        p.stateTick = 0;
        p.strike = null;
      }
      if (this.phaseTick >= END_TICKS) this.finished = true;
    } else if (this.phase === "ko" || this.phase === "timeout") {
      if (this.phaseTick >= END_TICKS - 30) this.finished = true;
    }

    this.updateCamera();
    this.clampFighters();
  }

  // ---------------------------------------------------------------- read-outs

  hud(): HudState {
    const p = this.player;
    const b = this.boss;
    const L = this.config.level.leader;
    return {
      phase: this.phase,
      hp: Math.max(0, p.hp),
      maxHp: p.stats.maxHp,
      clockSeconds: this.clock.seconds,
      clockFraction: this.clock.fraction,
      score: this.score,
      combo: this.combo,
      items: this.items,
      progress: this.gauntlet.progress(this.progressX),
      boss:
        b && this.phase !== "fight" && this.phase !== "ready"
          ? { name: L.name, title: L.title, hp: Math.max(0, b.hp), maxHp: b.stats.maxHp }
          : null,
      slowed: p.slow > 0,
      clinched: p.state === "clinched",
    };
  }

  result(): FightResult {
    const p = this.player;
    const won = this.phase === "won";
    const bonuses = won ? finishBonuses(this.clock.seconds, Math.max(0, p.hp), this.config.score) : { time: 0, health: 0 };
    return {
      outcome: won ? "won" : this.phase === "timeout" ? "timeout" : "ko",
      healthFraction: Math.max(0, p.hp) / p.stats.maxHp,
      clockFraction: this.clock.fraction,
      baseScore: this.score,
      timeBonus: bonuses.time,
      healthBonus: bonuses.health,
      score: this.score + bonuses.time + bonuses.health,
      bestCombo: this.bestCombo,
      hits: this.hits,
      kos: this.kos,
      ticks: this.tick,
    };
  }

  /** Debug: knock out every enemy on screen. */
  debugClear(): void {
    for (const f of this.world.fighters) {
      if (f.team === "enemy" && f.state !== "ko" && f.state !== "intro") knockOut(f, 4, this.world, PLAYER_ID);
    }
  }

  /** Debug: jump to just before the leader. */
  debugSkipToLeader(): void {
    this.player.x = this.config.level.length - 100;
    this.cameraX = this.leaderArenaLeft;
    this.furthestCam = this.cameraX;
    this.progressX = this.player.x;
    for (let i = 0; i < 64; i++) {
      this.gauntlet.holdCleared();
      const up = this.gauntlet.update(this.config.level.length, -9999);
      if (up.spawns.length === 0 && !up.holdStarted) break;
    }
    this.gauntlet.holdCleared();
    this.holdIds = null;
    this.debugClear();
  }
}
