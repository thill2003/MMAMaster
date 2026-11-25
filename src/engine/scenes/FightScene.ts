import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";

import { CAMERA_3D, DISPLAY } from "@/content/display";
import { buildFightConfig } from "@/content/fightConfig";
import { ARCHETYPE_LOOKS, type FighterLook, PLAYER_LOOK, RANK_COLORS } from "@/content/fighters/looks";
import { COMBAT_TUNING, INPUT_TUNING } from "@/content/fighters/tuning";
import type { Fighter } from "@/core/combat";
import { BotPlayer, type FightEvent, FightSim, type HudState } from "@/core/fight";
import { InputInterpreter } from "@/core/input";
import { haptics } from "@/platform";

import { audio } from "../audio/synth";
import type { FightRequest, ViewMetrics } from "../bridge/bridge";
import type { Held } from "../bridge/devices";
import { FighterModel } from "../sprites/fighterModel";
import { poseFor } from "../sprites/poses";
import { Fx } from "../sprites/vfx";
import { type Backdrop, buildBackdrop } from "../world/kits";

const STEP_MS = 1000 / DISPLAY.tickRate;
const MAX_STEPS_PER_FRAME = 5;
const K = CAMERA_3D.depthStretch;
/** Height of a strike's impact above the floor, in world units. */
const IMPACT_Y = 108;

const LIMB_SFX = { punch: "hit_punch", elbow: "hit_elbow", kick: "hit_kick", knee: "hit_knee" } as const;

interface View {
  model: FighterModel;
  flash: number;
}

/** What the scene needs from the bridge, and nothing else. */
export interface SceneHost {
  readonly request: FightRequest | null;
  readonly paused: boolean;
  readonly view: ViewMetrics;
  heldActions(): Held;
  emitHud(hud: HudState): void;
  finish(result: ReturnType<FightSim["result"]>): void;
  /** Full-screen white flash, 0–1. */
  setFlash(alpha: number): void;
  setDebugText(text: string | null): void;
}

/**
 * Draws one attempt at a town in real-time 3D. All rules live in core/fight's FightSim; this scene feeds it
 * one input frame per 60 Hz tick from a fixed-step accumulator and renders whatever state comes back.
 * World units are logical pixels: x along the street as in the sim, y up, z = sim depth × depthStretch.
 */
export class FightScene {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  private readonly sim: FightSim;
  private readonly interp = new InputInterpreter(INPUT_TUNING);
  private readonly bot: BotPlayer | null;
  private readonly views = new Map<number, View>();
  private readonly world = new Group();
  private readonly backdrop: Backdrop;
  private readonly fx: Fx;
  private readonly cans = new Map<number, Group>();
  private readonly canGeo = new CylinderGeometry(7, 7, 24, 14);
  private readonly canMats = [
    new MeshStandardMaterial({ color: 0x27c46b, roughness: 0.3, metalness: 0.6 }),
    new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.5 }),
  ];
  private readonly debugBoxes = new Map<number, LineSegments>();
  private readonly debugGeo = new EdgesGeometry(new BoxGeometry(1, 1, 1));
  private readonly debugMats = [new LineBasicMaterial({ color: 0x4dff88 }), new LineBasicMaterial({ color: 0xffd24d })];
  private readonly reachMat = new MeshStandardMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.35, depthWrite: false });
  private readonly reachBox = new Mesh(new BoxGeometry(1, 1, 1), this.reachMat);
  private acc = 0;
  private frame = 0;
  private lastHud = "";
  private reported = false;
  private fpsAvg = 60;
  private shakeLeft = 0;
  private shakeAmp = 0;
  private flash = 0;

  constructor(
    private readonly host: SceneHost,
    request: FightRequest,
  ) {
    const viewWidth = host.view.logicalWidth;
    this.sim = new FightSim(buildFightConfig(request.town, request.difficulty, viewWidth, { invincible: request.invincible }));
    this.bot = request.autoplay ? new BotPlayer() : null;
    this.camera = new PerspectiveCamera(CAMERA_3D.fov, viewWidth / host.view.logicalHeight, 10, 12000);
    this.scene.add(this.world);
    this.backdrop = buildBackdrop(this.scene, request.town.theme, request.town.seed, this.sim.config.level.length);
    this.fx = new Fx(this.world);
    this.reachBox.visible = false;
    this.world.add(this.reachBox);
    this.placeCamera();
    audio.music(request.town.music as Parameters<typeof audio.music>[0]);
  }

  /** Re-aim after the view changes shape. The sim keeps the width it started with. */
  resize(): void {
    this.camera.aspect = this.sim.viewWidth / this.host.view.logicalHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Aim the camera so the simulation's view window [cameraX, cameraX + viewWidth] spans the screen at the
   * frame depth, looking down by `pitch`.
   */
  private placeCamera(): void {
    const sim = this.sim;
    const cam = this.camera;
    const half = (CAMERA_3D.fov / 2) * (Math.PI / 180);
    const dist = DISPLAY.logicalHeight / 2 / Math.tan(half);
    const pitch = CAMERA_3D.pitch * (Math.PI / 180);
    const centerX = sim.cameraX + sim.viewWidth / 2;
    const target = new Vector3(centerX, CAMERA_3D.aimHeight, CAMERA_3D.frameDepth * K);
    cam.position.set(centerX, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    if (this.shakeLeft > 0 && !this.host.request?.reduceShake) {
      const a = this.shakeAmp * DISPLAY.logicalHeight * (this.shakeLeft > 4 ? 1 : this.shakeLeft / 4);
      cam.position.x += (Math.random() - 0.5) * 2 * a;
      cam.position.y += (Math.random() - 0.5) * 2 * a;
      this.shakeLeft--;
    }
    cam.lookAt(cam.position.x, target.y, target.z);
    this.backdrop.update(centerX, sim.cameraX);
  }

  // ---------------------------------------------------------------- loop

  update(delta: number): void {
    const sim = this.sim;
    this.frame++;
    this.fpsAvg += (1000 / Math.max(1, delta) - this.fpsAvg) * 0.05;

    if (!this.host.paused) {
      // KO slow-motion: the last blow plays out at a third of the speed.
      const slowmo = (sim.phase === "won" || sim.phase === "ko" || sim.phase === "timeout") && sim.phaseTick < 46;
      this.acc += Math.min(delta, 100) * (slowmo ? 0.34 : 1);
      let steps = 0;
      while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        const held = this.bot ? this.bot.next(sim) : this.host.heldActions();
        sim.step(this.interp.step(held));
        for (const e of sim.events) this.onEvent(e, sim);
        this.acc -= STEP_MS;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    }

    this.render(sim);
    this.pushHud(sim);

    if (sim.finished && !this.reported) {
      this.reported = true;
      this.host.finish(sim.result());
    }
  }

  private pushHud(sim: FightSim): void {
    if (this.frame % 2 !== 0) return;
    const hud: HudState = sim.hud();
    const key = JSON.stringify(hud);
    if (key !== this.lastHud) {
      this.lastHud = key;
      this.host.emitHud(hud);
    }
  }

  // ---------------------------------------------------------------- events → sound, sparks, shake

  private shake(ms: number, intensity: number): void {
    if (this.host.request?.reduceShake) return;
    this.shakeLeft = Math.max(this.shakeLeft, Math.round(ms / STEP_MS));
    this.shakeAmp = Math.max(this.shakeLeft > 0 ? this.shakeAmp : 0, intensity);
  }

  private onEvent(e: FightEvent, sim: FightSim): void {
    const playerId = sim.player.id;
    switch (e.type) {
      case "strike":
        if (e.fighterId === playerId) audio.sfx("whoosh");
        break;
      case "hit": {
        const z = e.z * K + 24;
        const y = IMPACT_Y;
        const view = this.views.get(e.targetId);
        if (e.result === "hit") {
          audio.sfx(e.heavy ? "hit_heavy" : LIMB_SFX[e.limb]);
          this.fx.spark(e.x, y, z, e.ko ? "ko" : e.heavy ? "heavy" : "hit");
          const target = sim.world.fighters.find((f) => f.id === e.targetId);
          const attacker = sim.world.fighters.find((f) => f.id === e.attackerId);
          const dir = target && attacker ? Math.sign(target.x - attacker.x) : 0;
          this.fx.blood(e.x, y, e.z * K, dir, e.ko ? 22 : e.heavy ? 14 : 7);
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
          this.fx.spark(e.x, y, z, "block");
        } else if (e.result === "armor") {
          audio.sfx("block", 1.4);
          this.fx.spark(e.x, y, z, "armor");
        } else if (e.result === "check") {
          audio.sfx("check");
          this.fx.spark(e.x, y, z, "check");
          this.fx.text(e.x, y + 40, z, e.targetId === playerId ? "CHECK!" : "CHECKED", "#f2c14e");
          haptics.tap();
        } else if (e.result === "parry") {
          audio.sfx("parry");
          this.fx.spark(e.x, y, z, "check");
          this.fx.text(e.x, y + 40, z, "COUNTERED", "#ff6b6b");
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
          if (sim.boss && e.fighterId === sim.boss.id && !this.host.request?.reduceShake) this.flash = 1;
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
        this.fx.text(sim.player.x, 190, sim.player.z * K + 30, `+${e.amount}`, "#7dff9a");
        break;
      case "comboEnd":
        if (e.bonus > 0) this.fx.text(sim.player.x, 205, sim.player.z * K + 30, `${e.limbs} LIMBS +${e.bonus}`, "#f2c14e", 20);
        break;
      case "clockWarning":
        audio.sfx("clock");
        break;
      case "holdCleared":
        this.fx.text(sim.cameraX + sim.viewWidth - 110, 200, 120 * K, "GO ▶", "#ffffff", 34);
        break;
      case "leaderIntro":
        audio.music(null);
        audio.sfx("boss_intro");
        break;
      case "bossPhase":
        audio.sfx("boss_phase");
        this.shake(380, 0.012);
        if (sim.boss) this.fx.spark(sim.boss.x, IMPACT_Y + 10, sim.boss.z * K + 24, "ko");
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
    const town = this.host.request!.town;
    if (f.team === "player") return { look: PLAYER_LOOK, armband: null };
    if (f.isBoss) return { look: town.leaderLook, armband: null };
    const base = ARCHETYPE_LOOKS[f.kind] ?? ARCHETYPE_LOOKS.brawler;
    return {
      look: { ...base, shorts: town.theme.gymColor, trim: town.theme.gymTrim },
      armband: RANK_COLORS[Math.min(f.rank, RANK_COLORS.length - 1)],
    };
  }

  private armbands = new Map<number, number | null>();

  private render(sim: FightSim): void {
    this.placeCamera();
    const tuning = COMBAT_TUNING;
    const seen = new Set<number>();

    for (const f of sim.world.fighters) {
      seen.add(f.id);
      let view = this.views.get(f.id);
      if (!view) {
        const { look, armband } = this.lookFor(f);
        view = { model: new FighterModel(look), flash: 0 };
        this.armbands.set(f.id, armband);
        this.world.add(view.model.group);
        this.views.set(f.id, view);
      }
      const look = view.model;
      const scale = this.lookScale(f) * DISPLAY.fighterScale;
      const pose = poseFor(f, sim.tick, tuning);
      const aura = f.armor ? 0xf2c14e : f.invuln > 0 && f.isBoss ? 0xffffff : null;
      // Knocked-out fighters blink away; a fighter getting up flickers while it can't be hit.
      let alpha = 1;
      if (f.state === "ko" && f.team === "enemy" && f.stateTick > tuning.koTicks - 34) alpha = sim.tick % 6 < 3 ? 0.25 : 0.9;
      else if (f.invuln > 0 && f.state !== "getup" && !f.isBoss) alpha = sim.tick % 4 < 2 ? 0.55 : 1;
      look.update(pose, { flash: view.flash, armband: this.armbands.get(f.id) ?? null, aura, alpha });
      look.group.position.set(f.x, 0, f.z * K);
      look.group.scale.set(f.facing * scale, scale, scale);
      if (view.flash > 0) view.flash = Math.max(0, view.flash - 0.2);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.model.dispose();
        this.views.delete(id);
        this.armbands.delete(id);
      }
    }

    // energy drinks on the ground: a can that bobs and turns
    const cansSeen = new Set<number>();
    for (const d of sim.drops) {
      cansSeen.add(d.id);
      let can = this.cans.get(d.id);
      if (!can) {
        can = new Group();
        const body = new Mesh(this.canGeo, this.canMats[0]);
        body.castShadow = true;
        const band = new Mesh(this.canGeo, this.canMats[1]);
        band.scale.set(1.02, 0.22, 1.02);
        band.position.y = 3;
        can.add(body, band);
        this.world.add(can);
        this.cans.set(d.id, can);
      }
      can.position.set(d.x, 14 + Math.abs(Math.sin(sim.tick * 0.08)) * 8, d.z * K);
      can.rotation.y = sim.tick * 0.05;
    }
    for (const [id, can] of this.cans) {
      if (!cansSeen.has(id)) {
        can.removeFromParent();
        this.cans.delete(id);
      }
    }

    this.fx.update();
    if (this.flash > 0) {
      this.host.setFlash(this.flash);
      this.flash = Math.max(0, this.flash - 0.08);
      if (this.flash === 0) this.host.setFlash(0);
    }
    this.renderDebug(sim);
  }

  private lookScale(f: Fighter): number {
    const town = this.host.request!.town;
    if (f.team === "player") return PLAYER_LOOK.scale;
    if (f.isBoss) return town.leaderLook.scale;
    return (ARCHETYPE_LOOKS[f.kind] ?? ARCHETYPE_LOOKS.brawler).scale;
  }

  /** MM-018: hurtboxes, strike reach, state names, fps and tick. */
  private renderDebug(sim: FightSim): void {
    const on = !!this.host.request?.debug;
    if (!on) {
      if (this.debugBoxes.size > 0) {
        for (const b of this.debugBoxes.values()) b.removeFromParent();
        this.debugBoxes.clear();
        this.host.setDebugText(null);
      }
      this.reachBox.visible = false;
      return;
    }
    const t = sim.world.tuning;
    const seen = new Set<number>();
    this.reachBox.visible = false;
    for (const f of sim.world.fighters) {
      seen.add(f.id);
      let box = this.debugBoxes.get(f.id);
      if (!box) {
        box = new LineSegments(this.debugGeo, this.debugMats[f.team === "player" ? 0 : 1]);
        this.world.add(box);
        this.debugBoxes.set(f.id, box);
      }
      box.position.set(f.x, 80, f.z * K);
      box.scale.set(t.bodyWidth, 160, t.depthTolerance * 2 * K);
      const s = f.strike;
      if (f.team === "player" && f.state === "strike" && s) {
        const active = f.stateTick >= s.startup && f.stateTick < s.startup + s.active;
        const x0 = f.x + f.facing * (s.minReach ?? -8);
        const x1 = f.x + f.facing * s.reach;
        this.reachBox.visible = true;
        this.reachMat.opacity = active ? 0.45 : 0.18;
        this.reachBox.position.set((x0 + x1) / 2, 75, f.z * K);
        this.reachBox.scale.set(Math.max(1, Math.abs(x1 - x0)), 70, 20);
      }
    }
    for (const [id, b] of this.debugBoxes) {
      if (!seen.has(id)) {
        b.removeFromParent();
        this.debugBoxes.delete(id);
      }
    }
    const p = sim.player;
    this.host.setDebugText(
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
    if (cmd === "clear") sim.debugClear();
    else if (cmd === "skip") sim.debugSkipToLeader();
    else sim.config.invincible = !sim.config.invincible;
  }

  destroy(): void {
    for (const v of this.views.values()) v.model.dispose();
    this.views.clear();
    this.backdrop.destroy();
    this.fx.destroy();
    this.canGeo.dispose();
    for (const m of this.canMats) m.dispose();
    this.debugGeo.dispose();
    for (const m of this.debugMats) m.dispose();
    this.reachBox.geometry.dispose();
    this.reachMat.dispose();
    this.host.setFlash(0);
    this.host.setDebugText(null);
  }
}
