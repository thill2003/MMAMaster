# Asset licensing log (MM-007)

Every asset that ships in the game gets a row here in the same PR that adds it.

## Shipping today

| Asset | Source | Licence | Notes |
|---|---|---|---|
| Fighters, backdrops, metro map, icons, VFX | Drawn in code in this repo (`src/engine`, `src/ui`) | Project's own | No external art |
| Sound effects and music | Synthesized at runtime from `src/content/audio.ts` | Project's own | No audio files |
| Fonts | System font stacks only | n/a | No font files bundled |

## Planned sources (plan §8) — terms to re-check on the day of download

| Source | Terms as understood on 2026-11-07 | Action before use |
|---|---|---|
| Mixamo (models, rigs, animations) | Free with an Adobe ID; royalty-free for commercial games; raw files not redistributable on their own | Read the current Adobe terms; keep the download date and the clip list here |
| Quaternius (low-poly characters, Universal Animation Library) | CC0 | Record the pack name and URL |
| BeepBox / Bosca Ceoil / sfxr output | Output is yours | Record the tool and the project file |

## Code dependencies

Runtime packages and their licences: `phaser` (MIT), `react` / `react-dom` (MIT), `@capacitor/*` (MIT).
