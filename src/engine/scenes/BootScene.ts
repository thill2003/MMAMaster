import Phaser from "phaser";

/** First scene: nothing to configure beyond what the game config sets; hands straight to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.scene.start("Preload");
  }
}
