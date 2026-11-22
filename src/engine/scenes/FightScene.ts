import Phaser from "phaser";

import { DISPLAY } from "@/content/display";
import { buildFightConfig } from "@/content/fightConfig";
import { ARCHETYPE_LOOKS, type FighterLook, PLAYER_LOOK, RANK_COLORS } from "@/content/fighters/looks";
import { COMBAT_TUNING, INPUT_TUNING } from "@/content/fighters/tuning";
import type { Fighter } from "@/core/combat";
import { depthScale, depthToScreenY, sortKey } from "@/core/depth";
import { BotPlayer, type FightEvent, FightSim, type HudState } from "@/core/fight";
import { InputInterpreter } from "@/core/input";
import { haptics } from "@/platform";

import { audio } from "../audio/synth";
import type { GameBridge } from "../bridge/bridge";
import { drawFighter } from "../sprites/fighterView";
import { poseFor } from "../sprites/poses";
import { Fx } from "../sprites/vfx";
import { type Backdrop, buildBackdrop } from "../world/kits";

const STEP_MS = 1000 / DISPLAY.tickRate;
const MAX_STEPS_PER_FRAME = 5;
const FLOOR_TOP = DISPLAY.floorTop;

interface View {
  g: Phaser.GameObjects.Graphics;
  look: FighterLook;
  armband: number | null;
  flash: number;
}

const LIMB_SFX = { punch: "hit_punch", elbow: "hit_elbow", kick: "hit_kick", knee: "hit_knee" } as const;

/**
 * Draws one attempt at a town. All rules live in core/fight's FightSim; this scene feeds it one input
 * frame per 60 Hz tick from a fixed-step accumulator and renders whatever state comes back.
 */
export class FightScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private sim: FightSim | null = null;
  private interp = new InputInterpreter(INPUT_TUNING);
  private bot: BotPlayer | null = null;
  private views = new Map<number, View>();
  private shadows!: Phaser.GameObjects.Graphics;
  private dropsG!: Phaser.GameObjects.Graphics;
  private debugG!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private backdrop: Backdrop | null = null;
  private fx!: Fx;
  private acc = 0;
  private frame = 0;
  private lastHud = "";
  private reported = false;
  private fpsAvg = 60;

  constructor() {
    super("Fight");
  }

  create(): void {
    this.bridge = this.registry.get("bridge") as GameBridge;
    const req = this.bridge.request;
    if (!req) return;

    const viewWidth = this.bridge.view.logicalWidth;
    this.sim = new FightSim(buildFightConfig(req.town, req.difficulty, viewWidth, { invincible: req.invincible }));
    this.interp = new InputInterpreter(INPUT_TUNING);
    this.bot = req.autoplay ? new BotPlayer() : null;
    this.views = new Map();
    this.acc = 0;
    this.frame = 0;
    this.lastHud = "";
    this.reported = false;

    this.backdrop = buildBackdrop(this, req.town.theme, req.town.seed, viewWidth);
    this.shadows = this.add.graphics().setDepth(-100);
    this.dropsG = this.add.graphics().setDepth(-50);
    this.debugG = this.add.graphics().setDepth(850000);
    this.debugText = this.add
      .text(6, 306, "", { fontFamily: "monospace", fontSize: "11px", color: "#9effa0", backgroundColor: "rgba(0,0,0,0.5)" })
      .setScrollFactor(0)
      .setDepth(850001)
      .setResolution(this.bridge.view.renderScale);
    this.fx = new Fx(this, this.bridge.view.renderScale);
    this.applyCamera();

    audio.music(req.town.music as Parameters<typeof audio.music>[0]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    for (const v of this.views.values()) v.g.destroy();
    this.views.clear();
    this.backdrop?.destroy();
    this.backdrop = null;
    this.fx?.destroy();
    this.sim = null;
  }

  /** The camera works in logical pixels; zoom maps them onto the device's render size. */
  private applyCamera(): void {
    const cam = this.cameras.main;
    const sim = this.sim;
    const zoom = sim ? this.scale.width / sim.viewWidth : this.bridge.view.renderScale;
    cam.setOrigin(0, 0);
    cam.setZoom(zoom);
    cam.setScroll(sim ? sim.cameraX : 0, 0);
  }

  // ---------------------------------------------------------------- loop

  update(_time: number, delta: number): void {
    const sim = this.sim;
    if (!sim) return;
    this.frame++;
    this.fpsAvg += (1000 / Math.max(1, delta) - this.fpsAvg) * 0.05;

    if (!this.bridge.paused) {
      // KO slow-motion: the last blow plays out at a third of the speed.
      const slowmo = (sim.phase === "won" || sim.phase === "ko" || sim.phase === "timeout") && sim.phaseTick < 46;
      this.acc += Math.min(delta, 100) * (slowmo ? 0.34 : 1);
      let steps = 0;
      while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        const held = this.bot ? this.bot.next(sim) : this.bridge.heldActions();
        sim.step(this.interp.step(held));
        for (const e of sim.events) this.onEvent(e, sim);
        this.acc -= STEP_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0; // fell behind: drop the backlog rather than spiral
    }

    this.render(sim);
    this.pushHud(sim);

    if (sim.finished && !this.reported) {
      this.reported = true;
      this.bridge.finish(sim.result());
    }
  }

  private pushHud(sim: FightSim): void {
    if (this.frame % 2 !== 0) return;
    const hud: HudState = sim.hud();
    const key = JSON.stringify(hud);
    if (key !== this.lastHud) {
      this.lastHud = key;
      this.bridge.emitHud(hud);
    }
  }

  // ---------------------------------------------------------------- events → sound, sparks, shake

  private shake(ms: number, intensity: number): void {
    if (this.bridge.request?.reduceShake) return;
    this.cameras.main.shake(ms, intensity);
  }

  private onEvent(e: FightEvent, sim: FightSim): void {
    const playerId = sim.player.id;
    switch (e.type) {
      case "strike":
        if (e.fighterId === playerId) audio.sfx("whoosh");
        break;
      case "hit": {
        const y = depthToScreenY(e.z, FLOOR_TOP) - 96;
        const view = this.views.get(e.targetId);
        if (e.result === "hit") {
          audio.sfx(e.heavy ? "hit_heavy" : LIMB_SFX[e.limb]);
          this.fx.spark(e.x, y, e.ko ? "ko" : e.heavy ? "heavy" : "hit");
          const target = sim.world.fighters.find((f) => f.id === e.targetId);
          const attacker = sim.world.fighters.find((f) => f.id === e.attackerId);
          const dir = target && attacker ? Math.sign(target.x - attacker.x) : 0;
          this.fx.blood(e.x, y, depthToScreenY(e.z, FLOOR_TOP), dir, e.ko ? 22 : e.heavy ? 14 : 7);
          if (view) view.flash = 1;
          if (e.heavy) this.shake(110, 0.006);
          if (e.targetId === playerId) {
            haptics.thud();
            this.shake(90, 0.004);
          } else if (e.attackerId === playerId) {
            haptics.tap();
          }
        } else if (e.result === "block") {
          audio.sfx("block");
          this.fx.spark(e.x, y, "block");
        } else if (e.result === "armor") {
          audio.sfx("block", 1.4);
          this.fx.spark(e.x, y, "armor");
        } else if (e.result === "check") {
          audio.sfx("check");
          this.fx.spark(e.x, y, "check");
          this.fx.text(e.x, y - 30, e.targetId === playerId ? "CHECK!" : "CHECKED", "#f2c14e");
          haptics.tap();
        } else if (e.result === "parry") {
          audio.sfx("parry");
          this.fx.spark(e.x, y, "check");
          this.fx.text(e.x, y - 30, "COUNTERED", "#ff6b6b");
        }
        break;
      }
      case "ko":
        if (e.fighterId === playerId) {
          audio.sfx("player_ko");
          audio.music(null);
          haptics.thud();
        } else {
          audio.sfx("ko");
          if (sim.boss && e.fighterId === sim.boss.id && !this.bridge.request?.reduceShake) this.cameras.main.flash(220, 255, 255, 255);
        }
        break;
      case "clinch":
        audio.sfx("clinch");
        break;
      case "pickup":
        audio.sfx("pickup");
        break;
      case "heal":
        audio.sfx("heal");
        this.fx.text(sim.player.x, depthToScreenY(sim.player.z, FLOOR_TOP) - 140, `+${e.amount}`, "#7dff9a");
        break;
      case "comboEnd":
        if (e.bonus > 0) {
          this.fx.text(sim.player.x, depthToScreenY(sim.player.z, FLOOR_TOP) - 150, `${e.limbs} LIMBS +${e.bonus}`, "#f2c14e", 20);
        }
        break;
      case "clockWarning":
        audio.sfx("clock");
        break;
      case "holdCleared":
        this.fx.text(sim.cameraX + sim.viewWidth - 90, 250, "GO ▶", "#ffffff", 34);
        break;
      case "leaderIntro":
        audio.music(null);
        audio.sfx("boss_intro");
        break;
      case "bossPhase":
        audio.sfx("boss_phase");
        this.shake(380, 0.012);
        if (sim.boss) this.fx.spark(sim.boss.x, depthToScreenY(sim.boss.z, FLOOR_TOP) - 80, "ko");
        break;
      case "phase":
        if (e.phase === "leader") audio.music("boss");
        else if (e.phase === "won") {
          audio.music(null);
          audio.sfx("win");
        } else if (e.phase === "ko" || e.phase === "timeout") audio.sfx("lose");
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- drawing

  private lookFor(f: Fighter): { look: FighterLook; armband: number | null } {
    const town = this.bridge.request!.town;
    if (f.team === "player") return { look: PLAYER_LOOK, armband: null };
    if (f.isBoss) return { look: town.leaderLook, armband: null };
    const base = ARCHETYPE_LOOKS[f.kind] ?? ARCHETYPE_LOOKS.brawler;
    return {
      look: { ...base, shorts: town.theme.gymColor, trim: town.theme.gymTrim },
      armband: RANK_COLORS[Math.min(f.rank, RANK_COLORS.length - 1)],
    };
  }

  private render(sim: FightSim): void {
    this.applyCamera();
    this.backdrop?.update(sim.cameraX, sim.viewWidth);
    const tuning = COMBAT_TUNING;
    const seen = new Set<number>();
    this.shadows.clear();

    for (const f of sim.world.fighters) {
      seen.add(f.id);
      let view = this.views.get(f.id);
      if (!view) {
        const { look, armband } = this.lookFor(f);
        view = { g: this.add.graphics(), look, armband, flash: 0 };
        this.views.set(f.id, view);
      }
      const y = depthToScreenY(f.z, FLOOR_TOP);
      const scale = view.look.scale * DISPLAY.fighterScale * depthScale(f.z, sim.world.band);
      const pose = poseFor(f, sim.tick, tuning);
      const aura = f.armor ? 0xf2c14e : f.invuln > 0 && f.isBoss ? 0xffffff : null;
      drawFighter(view.g, pose, view.look, { flash: view.flash, armband: view.armband, aura });
      view.g.setPosition(f.x, y);
      view.g.setScale(f.facing * scale, scale);
      view.g.setDepth(sortKey(f.z, f.id));
      // Knocked-out fighters blink away; a fighter getting up flickers while it can't be hit.
      let alpha = 1;
      if (f.state === "ko" && f.team === "enemy" && f.stateTick > tuning.koTicks - 34) alpha = sim.tick % 6 < 3 ? 0.25 : 0.9;
      else if (f.invuln > 0 && f.state !== "getup" && !f.isBoss) alpha = sim.tick % 4 < 2 ? 0.55 : 1;
      view.g.setAlpha(alpha);
      if (view.flash > 0) view.flash = Math.max(0, view.flash - 0.2);

      const lying = f.state === "knockdown" || f.state === "ko";
      this.shadows.fillStyle(0x000000, 0.28);
      this.shadows.fillEllipse(f.x - (lying ? f.facing * 24 : 0), y + 2, (lying ? 96 : 58) * scale, 13 * scale);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.g.destroy();
        this.views.delete(id);
      }
    }

    // energy drinks on the ground
    this.dropsG.clear();
    for (const d of sim.drops) {
      const y = depthToScreenY(d.z, FLOOR_TOP) - 4 - Math.abs(Math.sin(sim.tick * 0.08)) * 6;
      this.dropsG.fillStyle(0x000000, 0.25);
      this.dropsG.fillEllipse(d.x, depthToScreenY(d.z, FLOOR_TOP) + 2, 22, 6);
      this.dropsG.fillStyle(0x17121c, 1);
      this.dropsG.fillRoundedRect(d.x - 8, y - 24, 16, 26, 4);
      this.dropsG.fillStyle(0x27c46b, 1);
      this.dropsG.fillRoundedRect(d.x - 6, y - 22, 12, 22, 3);
      this.dropsG.fillStyle(0xf2f2f2, 1);
      this.dropsG.fillRect(d.x - 6, y - 15, 12, 5);
      this.dropsG.fillStyle(0xcfd6dd, 1);
      this.dropsG.fillRect(d.x - 4, y - 25, 8, 3);
    }

    this.fx.update();
    this.renderDebug(sim);
  }

  /** MM-018: hurtboxes, strike reach, state names, fps and tick. */
  private renderDebug(sim: FightSim): void {
    const on = !!this.bridge.request?.debug;
    this.debugG.clear();
    this.debugText.setVisible(on);
    if (!on) return;
    const t = sim.world.tuning;
    for (const f of sim.world.fighters) {
      const y = depthToScreenY(f.z, FLOOR_TOP);
      this.debugG.lineStyle(1, f.team === "player" ? 0x4dff88 : 0xffd24d, 0.9);
      this.debugG.strokeRect(f.x - t.bodyWidth / 2, y - 160, t.bodyWidth, 160);
      this.debugG.lineStyle(1, 0xffffff, 0.35);
      this.debugG.strokeEllipse(f.x, y, t.bodyWidth * 1.4, t.depthTolerance * 2);
      const s = f.strike;
      if (f.state === "strike" && s) {
        const active = f.stateTick >= s.startup && f.stateTick < s.startup + s.active;
        this.debugG.fillStyle(active ? 0xff3b3b : 0xff9d2e, active ? 0.45 : 0.18);
        const x0 = f.x + f.facing * (s.minReach ?? -8);
        const x1 = f.x + f.facing * s.reach;
        this.debugG.fillRect(Math.min(x0, x1), y - 110, Math.abs(x1 - x0), 70);
      }
    }
    const p = sim.player;
    this.debugText.setText(
      [
        `fps ${this.fpsAvg.toFixed(0)}  tick ${sim.tick}  phase ${sim.phase}`,
        `player ${p.state}${p.strike ? `:${p.strike.id}` : ""}  x ${p.x.toFixed(0)} z ${p.z.toFixed(0)}  string ${p.stringLen}`,
        `enemies ${sim.world.fighters.length - 1}  spawned ${sim.gauntlet.spawned}/${sim.gauntlet.totalSpawns}`,
        sim.boss ? `boss ${sim.boss.state} hp ${sim.boss.hp}${sim.boss.armor ? " ARMOR" : ""}${sim.boss.parry ? " PARRY" : ""}` : "",
      ].join("\n"),
    );
  }

  // ---------------------------------------------------------------- debug commands from the bridge

  debugCommand(cmd: "clear" | "skip" | "god"): void {
    const sim = this.sim;
    if (!sim) return;
    if (cmd === "clear") sim.debugClear();
    else if (cmd === "skip") sim.debugSkipToLeader();
    else sim.config.invincible = !sim.config.invincible;
  }
}
