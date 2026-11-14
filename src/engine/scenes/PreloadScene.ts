import Phaser from "phaser";

/**
 * Asset loading lives here (MM-017). v0 has no files to load — fighters, backdrops and sound are all
 * procedural — so this scene only announces that the engine is ready. When atlases arrive in assets/,
 * their `this.load.atlas(...)` calls and the preload manifest go in `preload()`.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  create(): void {
    this.game.events.emit("mma-ready");
  }
}
