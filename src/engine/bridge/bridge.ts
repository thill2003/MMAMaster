import Phaser from "phaser";

import { DISPLAY } from "@/content/display";
import type { TownDef } from "@/content/towns";
import type { FightResult, HudState } from "@/core/fight";
import type { Action } from "@/core/input";
import type { Difficulty } from "@/core/progress";

import { BootScene } from "../scenes/BootScene";
import { FightScene } from "../scenes/FightScene";
import { PreloadScene } from "../scenes/PreloadScene";

import { type Held, InputDevices } from "./devices";

export interface FightRequest {
  town: TownDef;
  difficulty: Difficulty;
  reduceShake: boolean;
  debug: boolean;
  invincible?: boolean;
  /** Let the scripted bot play (attract mode / debugging). */
  autoplay?: boolean;
}

export interface FightCallbacks {
  onHud: (hud: HudState) => void;
  onFinished: (result: FightResult) => void;
}

export interface ViewMetrics {
  /** Logical size the game is laid out in: height is fixed, width follows the device's aspect. */
  logicalWidth: number;
  logicalHeight: number;
  /** Device pixels per logical pixel, after the DPR cap. */
  renderScale: number;
}

/** Work out the logical view and render scale for a stage of the given CSS size (plan §7). */
export const computeView = (cssWidth: number, cssHeight: number, dpr: number, dprCap = DISPLAY.dprCap): ViewMetrics => {
  const h = DISPLAY.logicalHeight;
  const aspect = Math.min(DISPLAY.maxAspect, Math.max(DISPLAY.minAspect, cssWidth / Math.max(1, cssHeight)));
  const logicalWidth = Math.round(h * aspect);
  const renderScale = Math.min(3, Math.max(1, (cssHeight * Math.min(dpr, dprCap)) / h));
  return { logicalWidth, logicalHeight: h, renderScale };
};

/**
 * The typed door between React and Phaser (MM-014). React hands in fight requests, held actions and
 * pause; the engine hands back HUD state and the result. Neither side reaches into the other.
 */
export class GameBridge {
  readonly game: Phaser.Game;
  view: ViewMetrics;
  request: FightRequest | null = null;
  paused = false;
  private callbacks: FightCallbacks | null = null;
  private readonly touch: Held = {};
  private readonly devices = new InputDevices();

  constructor(private readonly parent: HTMLElement) {
    this.view = computeView(parent.clientWidth || 960, parent.clientHeight || 540, window.devicePixelRatio || 1);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: Math.round(this.view.logicalWidth * this.view.renderScale),
      height: Math.round(this.view.logicalHeight * this.view.renderScale),
      backgroundColor: "#0b0b12",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
      render: { antialias: true, powerPreference: "high-performance" },
      fps: { target: 60 },
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scene: [BootScene, PreloadScene, FightScene],
    });
    this.game.registry.set("bridge", this);
    this.devices.attach();
  }

  /** Re-fit after the stage changes size (rotation, window resize). */
  resize(): void {
    this.view = computeView(this.parent.clientWidth || 960, this.parent.clientHeight || 540, window.devicePixelRatio || 1);
    this.game.scale.setGameSize(
      Math.round(this.view.logicalWidth * this.view.renderScale),
      Math.round(this.view.logicalHeight * this.view.renderScale),
    );
    this.game.scale.refresh();
  }

  startFight(request: FightRequest, callbacks: FightCallbacks): void {
    this.request = request;
    this.callbacks = callbacks;
    this.paused = false;
    for (const k of Object.keys(this.touch) as Action[]) this.touch[k] = false;
    // SceneManager.start restarts the scene if it is already running.
    const start = () => this.game.scene.start("Fight");
    if (this.game.isBooted && this.game.scene.getScene("Fight")) start();
    else this.game.events.once("mma-ready", start);
  }

  stopFight(): void {
    this.callbacks = null;
    this.request = null;
    if (this.game.scene.getScene("Fight")) this.game.scene.stop("Fight");
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Touch controls report presses here. */
  setAction(action: Action, down: boolean): void {
    this.touch[action] = down;
  }

  heldActions(): Held {
    return this.devices.merged(this.touch);
  }

  emitHud(hud: HudState): void {
    this.callbacks?.onHud(hud);
  }

  finish(result: FightResult): void {
    this.callbacks?.onFinished(result);
  }

  debugCommand(cmd: "clear" | "skip" | "god"): void {
    const scene = this.game.scene.getScene("Fight") as FightScene | null;
    scene?.debugCommand(cmd);
  }

  destroy(): void {
    this.devices.detach();
    this.callbacks = null;
    this.game.destroy(true);
  }
}
