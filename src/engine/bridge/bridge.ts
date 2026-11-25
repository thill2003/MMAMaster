import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from "three";

import { DISPLAY } from "@/content/display";
import type { TownDef } from "@/content/towns";
import type { FightResult, HudState } from "@/core/fight";
import type { Action } from "@/core/input";
import type { Difficulty } from "@/core/progress";

import { FightScene, type SceneHost } from "../scenes/FightScene";

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
 * The typed door between React and the 3D engine (MM-014). React hands in fight requests, held actions and
 * pause; the engine hands back HUD state and the result. Neither side reaches into the other.
 */
export class GameBridge implements SceneHost {
  readonly renderer: WebGLRenderer;
  view: ViewMetrics;
  request: FightRequest | null = null;
  paused = false;
  private callbacks: FightCallbacks | null = null;
  private readonly touch: Held = {};
  private readonly devices = new InputDevices();
  private fight: FightScene | null = null;
  private raf = 0;
  private last = 0;
  private readonly flashEl: HTMLDivElement;
  private readonly debugEl: HTMLPreElement;

  constructor(private readonly parent: HTMLElement) {
    this.view = computeView(parent.clientWidth || 960, parent.clientHeight || 540, window.devicePixelRatio || 1);
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x0b0b12);
    this.applySize();
    parent.appendChild(this.renderer.domElement);

    // The boss-KO flash and the debug readout sit over the canvas.
    this.flashEl = document.createElement("div");
    Object.assign(this.flashEl.style, { position: "absolute", inset: "0", background: "#fff", opacity: "0", pointerEvents: "none" });
    parent.appendChild(this.flashEl);
    this.debugEl = document.createElement("pre");
    Object.assign(this.debugEl.style, {
      position: "absolute",
      left: "6px",
      bottom: "6px",
      margin: "0",
      padding: "2px 4px",
      font: "11px monospace",
      color: "#9effa0",
      background: "rgba(0,0,0,0.5)",
      pointerEvents: "none",
      display: "none",
    });
    parent.appendChild(this.debugEl);

    this.devices.attach();
    this.renderer.clear();
  }

  private applySize(): void {
    this.renderer.setSize(
      Math.round(this.view.logicalWidth * this.view.renderScale),
      Math.round(this.view.logicalHeight * this.view.renderScale),
      false,
    );
  }

  /** Re-fit after the stage changes size (rotation, window resize). */
  resize(): void {
    this.view = computeView(this.parent.clientWidth || 960, this.parent.clientHeight || 540, window.devicePixelRatio || 1);
    this.applySize();
    this.fight?.resize();
  }

  startFight(request: FightRequest, callbacks: FightCallbacks): void {
    this.stopLoop();
    this.request = request;
    this.callbacks = callbacks;
    this.paused = false;
    for (const k of Object.keys(this.touch) as Action[]) this.touch[k] = false;
    this.fight = new FightScene(this, request);
    this.last = performance.now();
    const tick = (now: number): void => {
      const fight = this.fight;
      if (!fight) return;
      const delta = now - this.last;
      this.last = now;
      fight.update(delta);
      // A finish callback may have stopped the fight inside update.
      if (this.fight === fight) {
        this.renderer.render(fight.scene, fight.camera);
        this.raf = requestAnimationFrame(tick);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.fight?.destroy();
    this.fight = null;
  }

  stopFight(): void {
    this.callbacks = null;
    this.request = null;
    this.stopLoop();
    this.renderer.clear();
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

  setFlash(alpha: number): void {
    this.flashEl.style.opacity = String(alpha * 0.85);
  }

  setDebugText(text: string | null): void {
    this.debugEl.style.display = text === null ? "none" : "block";
    if (text !== null) this.debugEl.textContent = text;
  }

  debugCommand(cmd: "clear" | "skip" | "god"): void {
    this.fight?.debugCommand(cmd);
  }

  destroy(): void {
    this.stopLoop();
    this.devices.detach();
    this.callbacks = null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.flashEl.remove();
    this.debugEl.remove();
  }
}
