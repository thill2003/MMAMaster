# assets/

Atlases, environment layers, map art, audio and fonts go here (plan §8), served at `/assets`.

Nothing is here yet on purpose: v0 draws every fighter, backdrop, map and icon in code and synthesizes
all sound, so the game runs with zero binary assets. When real art arrives:

1. Put packed atlases under `assets/atlases/`, layers under `assets/env/`, audio under `assets/audio/`.
2. Set `publicDir` in `vite.config.ts` so the folder is served, and add the files to the preload
   manifest in `src/engine/scenes/PreloadScene.ts`.
3. Log every asset's source and licence in `LICENSES.md` in the same PR.
4. Track binaries with Git LFS (see `.gitattributes`).
