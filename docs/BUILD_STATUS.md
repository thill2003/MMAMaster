# MMA Master — build status (first build, 2026-11-14)

The game was built in one pass from `MMA_MASTER_PLAN.md` and `MMA_MASTER_BACKLOG.md`. It is playable from the
title screen to the champion in a browser. It has **not** been run on a phone, and no person has played it
yet — see "Not verified" before trusting the feel or the difficulty.

## What was checked

| Check | Result |
|---|---|
| `pnpm lint` (ESLint with the import boundaries, zero warnings allowed) | Passes. A planted violation of each boundary rule was caught, then removed. |
| `pnpm test` | 88 tests pass: input, combat, depth, AI, gauntlet, progress, content integrity. |
| Headless level simulation (MM-211) | A scripted bot clears Fenton on Normal with clock to spare; all ten levels run to a win with an invincible bot; 90 further runs (3 view widths × 3 difficulties × 10 levels) found no soft-lock. |
| Determinism (MM-210) | The same inputs replay to the same fight, tick for tick. |
| `pnpm build` | Passes. About 99 kB gzipped of game code plus 340 kB gzipped of Phaser. |
| `pnpm test:pipeline` | 8 scenarios, 63 checks pass: the real pipeline scripts against a mock Todoist API and stub `claude` and `gh`. Planted bugs (no agent-name check, no `.github/` guard, a create command without `temp_id`) were caught. `shellcheck` and `actionlint` are clean. |
| Browser run (headless Chrome, 960×540, 1170×540, 1024×768, 844×390, 667×375) | Title → map → level card → fight → leader → results → map with the path drawn on and the next node unlocked; pause; touch controls under simulated multi-touch (D-pad held while tapping Punch, guard hub, hold-Kick). No page errors. |

## Not verified

- **Never run on a phone or tablet.** No iOS or Android project has been generated. Thumb reach, the D-pad
  hub size, safe-area insets and 60 fps on the floor device are all untested (MM-213, MM-214, MM-234).
- **No human has played it.** Difficulty, clock lengths and game feel come from reasoning and from bot runs.
  The bot reads enemy tells straight from the simulation and guards perfectly, so "the bot wins" says the
  levels are completable, not that they are fair or fun.
- **Sound was never heard.** The synthesizer runs without errors; what it sounds like is unknown.
- Gamepad input, the left-handed layout and the Out of Lives screen were not exercised in a browser.
- **The agent pipeline has never run for real.** It was written from the handoff document's description —
  the reference workflow file was not available — and tested only against a mock Todoist and stub CLIs. No
  run on GitHub, no call to the real Todoist API, no real Claude session. Field names and endpoints follow
  Todoist's API reference and the handoff doc's notes.

## Built, by epic

| Epic | Built | Stories covered (whole or in part) |
|---|---|---|
| E00 Repo and pipeline | Skeleton, rules file, CI, README, handoff doc with the code-structure contract, `CLAUDE.md`, config, LFS rules, licence log | MM-001, 002, 004, 005, 006, 007 |
| E01 Engine foundation | Boot/Preload/Fight scenes on a fixed 60 Hz step; logical height 540 with width by aspect, DPR cap 2, safe areas; device profiles; one orientation value; typed bridge and `PhaserGame`; DOM touch controls; action map with keyboard and gamepad; debug overlay | MM-010–016, 018; 017 as conventions only |
| E02 Combat core | State machine, hit resolution with depth tolerance, hit-stop, knockback; strings as data with tap/hold steps and limb-switch cancels; direction and dash variants; guard, chip, check, low-kick stagger; clinch with knees, elbow, dump and splash; enemy clinch and mash escape; tuning table; game feel | MM-030–040 |
| E03 Enemies and AI | Four archetypes, attack tokens and flanking, four ranks, leader framework, nine boss styles each with a key, champion with three phases | MM-050–056 (design sheets are the `design` field per town) |
| E04 Gauntlet and level runtime | Spawn by scroll distance, density by segment, holds, leader trigger; clock; Knocked Out; score; stars; energy drink; camera; lives and the daily grant; health bars | MM-060–062, 064–072 |
| E05 Art | **Placeholder only** — see below | MM-089–093 as procedural stand-ins; MM-094 type scale and font roles (`content/display.ts`) on system font stacks |
| E06 UI and screens | Title, metro map, level card, results, pause with combo list, settings, HUD, Fenton hints, strings in one file, 44 px touch floor and reduced motion | MM-100–109 (109 in part) |
| E07 Audio | WebAudio unlock, looping sequencer, mute in background; 23 synthesized SFX; six synthesized tracks | MM-120–122 as stand-ins |
| E08 Progression and saves | Versioned save with migration, Capacitor Preferences with web fallback, services stubbed | MM-130–132 |
| E09 St. Louis content | Ten levels with gyms, leaders, looks, themes and a curve | MM-140–149 |
| E10 Difficulty | Easy/Normal/Hard multipliers, per-level and per-metro ramp, Easy assists | MM-150–152 |
| E11 Themes | Theme per level as data (time of day, signage, gym colours, street or arena kit) | MM-160 |
| E16 QA | Replay test, headless level runs | MM-210, 211 |
| Agent pipeline | `daily-feature-agents.yml` (Dana plus John, Brock, Silva, Matt, Jose) with its logic in `.github/agents/`, `merge-gate.yml`, the two review skills, and an offline test suite | MM-003 in part |

## Decisions taken to get it built — all yours to overturn

| Open item in the plan | What the build does | Where to change it |
|---|---|---|
| Up/down: depth or jump/crouch (Q1) | Walk in depth, the plan's default | `core/combat`, `core/depth` |
| How the 3D look is made (Q2) | **Not done.** Fighters, backdrops, the map and icons are drawn in code; fighters are jointed figures posed from angle tables, shaded to read as rounded. A stand-in until the Blender pipeline exists. | `engine/sprites`, `engine/world` |
| Offline v1 (Q3) | Offline. `services/` is a stub and `@supabase/supabase-js` is not installed. | `src/services` |
| Lives X and Y (Q6) | Start with 5, +5 each new day, cap 10 | `content/fighters/tuning.ts` `LIVES_RULES` |
| Controls: DOM or Phaser (MM-015) | React DOM overlay on pointer events; the hub has hysteresis against the arms | `ui/controls` |
| Energy drink source (MM-066) | Start with 1; every 5th grunt in a stream and the last fighter of each pack drops one; hold 3; heals 35 | `ITEM_RULES`, `dropEvery` per town |
| The player (MM-083) | "The Challenger", placeholder look | `PLAYER_CHARACTER`, `PLAYER_LOOK` |
| Gym identities (MM-140) | Invented gyms and leaders for all ten levels; city neighborhoods are Soulard, The Hill, Central West End | `content/towns/stLouis.ts` |
| App id | `com.sharperproducts.mmamaster` — the plan's `com.{TylerHill}.mmamaster` was a placeholder. **Set the real one before `cap add`.** | `capacitor.config.ts` |
| Clock lengths (MM-067) | About 3.5× the bot's clear time per level | `clockSeconds` per town |

Things the plan did not ask for that the build needed:

- **A seventh core module, `core/fight`**, holds `FightSim`, which composes the other six. The plan listed six.
- **Taps resolve on release** (a press held 10 ticks becomes the hold strike), so a tap costs a few ticks of
  latency. The alternative — fire on press, morph into the hold — needs strike data designed for it.
- **Lock-on facing.** The player faces the nearest fighter in reach, so "back + Kick" is a low kick rather
  than a turn. Pressing toward a fighter on the other side turns to them.
- **A cap on unbroken strings.** The seventh hit in a row knocks down. Without it the bot stun-locked every
  leader from full health.
- **Bodies don't overlap** on one depth line, and grunts never swing from off screen. Both came out of
  soft-locks the bot found.
- **Demo mode** (`?demo=<townId>`) and **Prettier** (`pnpm format`).
- Phaser is pinned to the 3.x line (3.90) as the plan says; Phaser 4 exists and was not adopted.

## The levels as built

| # | Town | Gym | Leader | Style → key | Stream + packs | Clock |
|---|---|---|---|---|---|---|
| 1 | Fenton | Meramec Fight Club | Big Dale Hutchins | Haymaker brawler → guard, then punish | 10 + 2 | 170 s |
| 2 | Chesterfield | Valley Elite Kickboxing | Coach Brandt Keller | Teep master → come in off his line, or dash | 13 + 3 | 185 s |
| 3 | Kirkwood | Station Street Muay Thai | Mae Sullivan | Low kicker → check the kick | 14 + 3 | 200 s |
| 4 | St. Charles | Riverfront Clinch Works | Bear Novak | Armored clincher → teep him | 17 + 3 | 280 s |
| 5 | East St. Louis | Eastside Athletic Club | Marcus Cole | In-and-out runner → low kick to slow him | 17 + 6 | 300 s |
| 6 | Downtown | Gateway Combat Center | Vic Moretti | Blocks everything → clinch | 18 + 6 | 350 s |
| 7 | Soulard | Brick Alley Thai Boxing | Eddie Tran | Armored elbow flurries → guard, punish while winded | 22 + 6 | 390 s |
| 8 | The Hill | Hilltop Fight Society | Sal Russo | Counter-striker → wait for his lunge | 24 + 7 | 390 s |
| 9 | Central West End | West End Athletic | Jet Okafor | Flying knee → step off the line, hit his back | 24 + 7 | 480 s |
| 10 | St. Louis | Champion's Hall | Rex Calloway | Three phases built from the styles above | 13 + 7 | 420 s |

Stream counts are on Normal; Easy and Hard scale them.

## Not built

- **Real art and audio** (E05, E07): no models, sprite sheets, atlases, Blender script, packing script,
  golden sprite, a bundled pixel font file (its name goes at the front of `FONTS.retro`) or audio files. `assets/` is empty.
- **A live run of the agent pipeline** (MM-003). The workflows and scripts are in the repo (see below) but
  the Todoist project, the secrets and the smoke test are still to do.
- **Native projects**: `ios/` and `android/` have not been generated.
- Move Lab (MM-019), spawn-stream visualizer (MM-020), elbow cut status (MM-041), gym and dojo kits and
  segment sequencing (MM-161–163), Playwright smoke test in CI (MM-212), a colourblind pass and remappable
  layout (rest of MM-109 — button size and left-handed mirror exist).
- Everything post-v1 (E12–E15), release (E17) and process (E18).
