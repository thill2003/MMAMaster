# MMA Master — Design & Build Plan (v0.11, 2026-11-07)

Draft from the 2026-11-07 planning session. ✅ = Scott's call. ⏳ = proposed, awaiting his call. Companion: `MMA_MASTER_BACKLOG.md` (stories MM-001…).

> Copied into the repo on 2026-11-14 so the design travels with the code. What has been built against it so far is in [BUILD_STATUS.md](BUILD_STATUS.md).

## 1. Concept

A side-scrolling beat 'em up in the line of the original TMNT and Simpsons arcade games, the Karate Kid NES game and Ninja Gaiden — not a runner. You move forward at your own pace while fighters keep coming at you; each town's level is **fighting an entire gym**: its members come at you in a steady stream, escalating in rank, until the **gym leader** at the end. The last level is the city champion's gym, with the **city champ as the big boss**. Striking is **Muay Thai** — the art of eight limbs: punches, elbows, kicks and knees, with real combinations. Played as a tour of a metro area; later metros (Chicago, Kansas City, Cleveland, then every major US city) are content updates on the same systems, each harder than the last.

**Framing:** every town has a rival gym. Fight through its roster, beat its leader, earn the right to challenge the city champion. Enemies are fighters everywhere — a few archetypes re-skinned per gym — which keeps art cost down and keeps the game on theme. Every boss fights a distinct style with a counter you have to work out.

## 2. v1 scope — St. Louis metro

- Levels in order: Fenton → Chesterfield → Kirkwood → St. Charles → East St. Louis → Downtown → two or three St. Louis city neighborhoods → St. Louis champion (boss level)
- One playable fighter; roughly an hour of play
- Levels before the champion share one city-street background; the champion's level is the boss arena
- A gym leader per level (distinct look, 1–2 signature moves, a style with a key) plus the champion (unique moveset, phases)
- Start screen → metro map with numbered nodes that unlock in order → level → results → map
- Lives granted daily; local progress and high scores; Supabase later for auth, cloud saves and leaderboards

## 3. Decisions

| Decision | Call | Status |
|---|---|---|
| Platform | Mobile-first (iOS/Android via Capacitor); web build for fast iteration | ✅ |
| Display | Landscape, set by one config value rather than hardcoded; simulation locked to the oldest supported phone's refresh rate (60 Hz); resolution and layout adjust per device type (small phone, notched phone, tablet) | ✅ |
| Controls | Nintendo-style D-pad (cross) left; action button cluster right, semi-transparent engraved icons | ✅ |
| Buttons | Right cluster, six on screen: four live strike buttons (Punch, Elbow, Kick, Knee) plus two placed but unused, reserved for future special moves. Guard is the button in the middle of the D-pad cross on the left. No jump button for now | ✅ |
| Striking | Muay Thai: all eight-limb strikes with combos; tap and hold are different strikes; no takedowns or ground game for now | ✅ |
| Level flow | Continuous gauntlet — different fighters keep coming as you advance, gym leader at the end of each level, city champion as the final boss level | ✅ |
| Timer and stars | Kung-Fu Master countdown per level; time out is a KO. Stars come from remaining health and remaining clock | ✅ |
| Lives | A KO costs a life and the retry restarts the entire level; lives are granted each day you open the game (X per day, capped) | ✅ |
| Health bars | One player bar for the whole level; grunts show none; the gym leader and the champion get their own bar when that fight starts | ✅ |
| Boss design | Each leader and the champion has a custom fighting style the player has to figure out how to beat | ✅ |
| Map / progression | Numbered level nodes on a winding path, next node unlocks when you pass the one before, boss at the end; clean screen, no currencies/timers/store | ✅ |
| Settings | Levels before the champion: the same city-street background; gym/dojo kits as later variants; champion level is the boss arena | ✅ |
| D-pad up/down | Walk in depth — toward or away from the camera, continuous (TMNT / Simpsons arcade style) | ⏳ confirm — alternative is one flat plane with up = jump, down = crouch (Karate Kid NES / Ninja Gaiden) |
| Look | 2D gameplay with a 3D look | ✅ |
| How the 3D look is made | Pre-rendered 3D: rigged models + stock fight animations rendered to sprite sheets | ⏳ |
| Stack | Same as GamesCasino: Phaser 3, React 18, TypeScript, Vite, Capacitor 6, Supabase, Vitest, pnpm | ✅ |
| Folder structure | New layered layout built for this game — GamesCasino's folders are not carried over | ✅ |
| Code structure rules | eslint-plugin-boundaries + eslint-plugin-import, enforced in CI — the mechanism is carried over, the rules are rewritten for the new layout | ✅ |
| Renderer fallback | Three.js replaces Phaser only if real-time 3D becomes a must; nothing else in the stack changes | — |

## 4. Start screen and metro map

**Screen flow:** Title (logo, Play, Settings) → Metro map → tap a node → level card (town, gym name, leader portrait, best stars, lives remaining, Fight) → level → results (stars, score, best combo) → back to the map, where the path draws on to the next node and it unlocks.

**The map** (modeled on the middle of the reference, re-themed, none of the extra chrome):
- Tall, vertically scrolling map; the path winds from the bottom (Fenton) to the top (the champion). Theme: stylized St. Louis metro — bluffs and trees in the south, the suburbs, the Mississippi and Missouri as the path's spine, the city neighborhoods, the Arch at the top under the champion node.
- Numbered nodes, each a gym badge or crest (the "different theme" in place of the pumpkins). The champion node is bigger with its own crest.
- Node states: locked (muted, padlock), current (highlighted, pulsing), completed (0–3 stars beneath). Beating a node unlocks the next; the champion unlocks after the last city neighborhood. Later option: a star gate on the champion.
- Stars per level: ★ finish the level · ★ finish with at least half your health · ★ finish with at least a quarter of the clock left. Independent, so the results screen can show which one was missed. Total stars shown at the top.
- Chrome kept to: back, settings gear, total stars, best score, lives remaining. No currencies, timers, events, daily rewards or store.
- Built so later metros are chapters: the map scrolls on into the next metro, or a metro picker — one map background plus node data per metro.

**To build it:**
- Assets: tall map background for the metro (or 2–3 parallax layers), path segments, node badges with locked and completed variants, star icons (filled/empty), padlock, champion crest, level-card frame, buttons, retro font, gym leader portraits.
- Data (`content/towns`): per node — id, name, gym name, leader, position on the map, level definition, clock length, star thresholds.
- State (`core/progress`): unlocked set, stars and best score per level, best combo, lives and last grant date; save local first, Supabase sync when signed in.
- UI (`ui/screens`): Title, MetroMap (scroll container, node components, path draw-on animation), LevelCard, Results, Knocked Out, Out of Lives, Settings.
- Sound: map theme, node tap, unlock fanfare.

## 5. Level design

**The gauntlet.** Each level is one continuous scroll. Fighters spawn by scroll distance, not in locked arenas: the stream never stops, its density and mix follow a curve per level, and the gym's roster escalates in rank as you go (white → blue → brown → black belt, or novice → pro by gym). Brief holds only where the level wants a set-piece: a pack of black belts before the leader, and the leader fight itself. Each level ends on the gym leader; the champion's level ends on the champ.

**The clock.** Every level has a Kung-Fu Master countdown, shown top center. It runs while you fight and pauses in menus. Hitting zero is a KO — a time-out, not a game over. Clock length is per level in `content/towns`, set generous at first (a clean run uses about half of it) and tightened by playtest; the remaining clock at the finish feeds the third star and the time bonus.

**Lives.** Starting a level is free while you have lives; losing one costs a life. A KO — by damage or by the clock — ends the attempt, and the retry starts the entire level over; there is no checkpoint at the leader. Opening the game on a new calendar day grants X lives, capped at Y (both in content); when you're out, an Out of Lives screen says when the next grant comes. v1 reads the device date; server time arrives with accounts in v1.1. Winning or quitting to the map costs nothing.

**Health bars.** One player bar for the whole level, restored only by energy drinks. Grunts show no bar — they drop in a few clean hits. The gym leader and the champion get their own bar and name plate that appear when that fight starts, Kung-Fu Master style.

**Bosses.** Each leader and the champion fights a distinct, custom style with a counter you have to work out: a low-kick specialist who has to be checked, a clincher who has to be kept off with teeps, an elbow brawler you guard and punish, a counter-striker you can't rush. The design sheet for each names the key and the tells that hint at it; v1 gives no on-screen hints.

**Score.** Points per hit scaled by combo length, a limb-variety bonus per string, then at the finish a time bonus (remaining seconds × rate) and a health bonus (remaining health × rate), all rates in content.

**The roster.** 3–4 base archetypes (brawler, kicker, grappler, quick) with material/palette swaps and rank markers per gym, so every level feels like a different gym on the same art. Gym leaders are unique looks on the same rig with a signature move or two; the champion gets a unique moveset and phases.

**Settings.** v1 ships one scrolling **street** kit — a city street with the skyline behind it — used for every level before the champion, varied cheaply by time of day, color grade and signage. The champion's level is the boss arena (his gym: a mat, cage walls, crowd — one interior kit). Later: per-level theme config in content, the **gym** kit with different mats and walls per gym, and a **dojo** kit (wood floor, tatami, scrolls); a level can then be a sequence — street approach → through the gym doors → the roster on the mats → the leader.

**Difficulty.** An Easy/Normal/Hard setting as multipliers on enemy HP, damage, density and clock, and a progressive ramp per level and per metro from content data, so later towns and later cities get harder without hand-tuning each one.

## 6. Striking — Muay Thai, the art of eight limbs

**Buttons.** Right thumb, six on screen: four live strike buttons in a diamond under the thumb's natural arc — Punch, Elbow, Kick, Knee — and two more placed in the cluster but inactive, drawn muted with a lock, reserved for special moves. The action map defines `SPECIAL_1` and `SPECIAL_2` now but binds nothing to them, so lighting one up later is content and UI work, not a rewrite. Left thumb: the D-pad, with **Guard as the button in the middle of the cross** — press the hub to block, which also means you stand still while guarding, as a fighter would.

No jump button for now. "Forward" and "back" below mean the facing direction on the D-pad; up/down are never modifiers, because they move you in depth.

**Tap and hold.** Every strike button distinguishes a tap from a hold, and a hold is a different strike. Strings can contain hold steps, so tap-tap-hold, hold-tap-tap and tap-tap-tap are three different combos on the same button; different buttons chain into different combos through limb-switch cancel windows.

- **Guard (D-pad hub):** hold = block (chip damage, no knockback). Tap at the moment a strike lands = check — a low kick checked on the shin staggers the kicker. Elbows are blocked but chip hardest.
- **Dash:** double-tap forward. Dash + a strike is the lunging version of that limb.
- **Clinch (the plum):** walk into an enemy and hold forward for a beat — the beat 'em up grab, automatic on contact. Inside it: Knee = clinch knees (up to three), Elbow = elbow out of the clinch (breaks it with a stun), back + Knee = dump/sweep (throws the enemy, hits anyone it lands on in depth). Enemies can clinch you; mash to escape.

| Limb | Tap string | With direction |
|---|---|---|
| Punch | jab → cross → left hook → right hook → uppercut (5-hit string on Punch alone) | dash + Punch = superman punch |
| Elbow | horizontal elbow → uppercut elbow → spinning back elbow (slow, big) | dash + Elbow = leaping elbow; back + Elbow = downward (12–6) elbow |
| Kick | body roundhouse → head roundhouse | forward + Kick = teep (push kick: knockback, makes space); back + Kick = low kick (slows the enemy); dash + Kick = flying kick |
| Knee | straight knee → curving knee | forward + Knee = long knee (lunge); dash + Knee = flying knee (big damage, launcher) |

**Combos:** strings can switch limbs at a cancel window, so the classic combinations are real inputs: jab-cross-roundhouse (P, P, K), jab-cross-hook-low kick (P, P, P, back+K), teep into jab-cross (forward+K, P, P), jab-elbow (P, E), cross-knee (P, P, N), clinch-knee-knee-elbow. Every string, its hold steps and its windows is data in `content/moves`, not code, so tuning is a file change — and later the player can set up their own combos within the same rules.

**Later — the reserved buttons:** `SPECIAL_1` is grappling, with hold a different move from tap (tap a grab variant, hold a throw or takedown); `SPECIAL_2` is a jumping strike, with hold a different move from tap (tap a jumping kick, hold a charged flying strike). An eight-limbs meter (landing hits with all four limb types in one string fills it fastest) feeds them. None of it is built in v1; score already counts hits, max combo and limb variety.

**For now:** strikes, guard and the clinch only. Takedowns and the ground game are a later layer that would make it full MMA.

## 7. Controls and display

**Controls**
- **Left thumb:** D-pad — left/right along the street or mat, up/down in depth, Guard in the hub; double-tap forward to dash.
- **Right thumb:** the four strike buttons plus the two reserved slots; one small item slot with a count (energy drink heal).
- **HUD:** player health bar top-left, the countdown top center, stage pips and lives top-right; the leader's or champion's bar and name plate appear when that fight starts; combo counter; pause in the top-right corner.
- All input routes through one action map, so gamepads and keyboard work on the web build.
- Input buffering (~6 frames), cancel windows per string, generous hit tolerances. Playtest thumb reach on a real phone early — the strike diamond has to sit under the right thumb's natural arc with the two reserved slots outside it, and the D-pad hub has to be big enough to hit without sliding onto an arm.

**Display**
- **Orientation:** landscape, set by one config value (Capacitor config plus the iOS orientation script, read by the layout code at runtime) — never hardcoded in scenes, so portrait or free rotation on iPad can be switched on later without touching gameplay.
- **Frame rate:** the simulation runs on a fixed 60 Hz step — the refresh rate of the oldest supported phone — and `core/` never sees a frame time. 120 Hz phones render more frames; nothing plays faster. Target: 60 fps sustained on the floor device, with hit-stop, animation timings and the clock all defined in ticks, not milliseconds.
- **Resolution:** a fixed logical height (540) with the width filling the device's aspect — 16:9 up to 19.5:9 on phones, so wider phones see more street instead of black bars; 4:3 tablets letterbox or show less width. HUD and controls anchor to the safe-area insets. Device pixel ratio capped at 2 so older phones aren't rendering 3× pixels they can't afford.
- **Device profiles:** `phone-small`, `phone` (notched) and `tablet`, chosen at launch from screen size and DPR, each setting button size and position, HUD scale and the DPR cap. Profiles are data, and the settings menu can override button size and position per player.
- **Floor device (⏳ name it):** proposed iPhone SE (2nd gen, A13) and a 2020 mid-range Android (Pixel 4a class) — the oldest phones the game is tested on, and the 60 fps bar.

## 8. Art pipeline — pre-rendered 3D

1. **Models/rigs:** Mixamo (free with an Adobe ID, royalty-free for commercial games, maintenance mode) or Quaternius CC0 low-poly characters.
2. **Animations:** Mixamo's striking set covers jabs, crosses, hooks, roundhouse and knee clips; Quaternius Universal Animation Library (CC0) has melee combos. Gaps — elbows, teep, clinch, spinning back elbow, hold variants — come from other free libraries or a small commission.
3. **Blender:** import, retarget, render each clip side-on at the game's camera angle to PNG frames. Python script, so agents can run it.
4. **Pack** frames into atlases (free-tex-packer or TexturePacker) → Phaser sprite sheets.
5. **Environments:** the street kit as parallax layers, the boss arena, then the gym and dojo kits later. No trademarked signage.

**Asset list:** player (idle, walk, dash, 5 punches, 3 elbows, 4 kicks, 3 knees, hold and dash variants, clinch set, guard, check, hit, knockdown, get up, KO, win); 3–4 enemy archetypes (walk, 2–3 strikes, hit, knockdown, KO) with swaps per gym and rank markers; a gym leader per level (unique look, 1–2 signature moves); champion (unique moveset, phases); street kit + boss arena; metro map set from §4; HUD, the D-pad with its guard hub, four strike icons, the two locked placeholder icons, lives icon, boss bar and name plate, the Knocked Out and Out of Lives screens; VFX (hit spark, dust, KO flash, cut); retro font.

**Audio:** map, a track per level, champion's gym, champion fight — and about twenty SFX (per-limb impacts, block, check, clinch, KO, clock warning, UI). BeepBox or Bosca Ceoil for chiptune, sfxr for SFX, or asset packs; a chiptune take on sarama for the boss fights.

## 9. Code systems — by folder

- `core/combat` — fighter state machine, strings with tap/hold steps and cancel windows, hitbox/hurtbox resolution, damage, knockback, hit-stop, guard and check, dash, clinch
- `core/depth` — depth math: y-tolerance for hits, sort key for drawing order
- `core/ai` — grunt brains (approach, flank in depth, attack patterns, clinch attempts), gym-leader styles and keys, champion phases
- `core/gauntlet` — the enemy stream: spawn triggers by scroll distance, density curve, rank escalation, set-piece holds, leader trigger, the level clock
- `core/progress` — unlocks, stars from health and clock, score and bonuses, best combo, lives and the daily grant, save model
- `core/input` — action map (MOVE_LEFT, MOVE_RIGHT, MOVE_UP, MOVE_DOWN, GUARD, PUNCH, ELBOW, KICK, KNEE, SPECIAL_1, SPECIAL_2, ITEM), input buffering, tap/hold and double-tap detection, direction modifiers
- `engine/` — Phaser scenes (Boot, Preload, Fight), sprites, environment kits and parallax, camera scroll and holds, depth sort by y, the fixed-step loop driving `core/`, touch input → action map, and the typed bridge React talks to
- `ui/` — React screens (title, metro map, level card, results, knocked out, out of lives, pause, settings), HUD, D-pad with guard hub and six-slot cluster, device profiles and safe-area layout, primitives
- `content/` — data, not code: towns (map node, segments, gauntlet curve, roster, leader, music, clock length, star thresholds, theme), fighters, moves (strings, hold steps, windows, damage), score rates, lives rules, difficulty multipliers, device profiles, audio manifest
- `services/` — Supabase client, auth, saves sync, leaderboard (stubbed behind the barrel in v1)
- `platform/` — Capacitor native vs web: haptics, storage, app lifecycle, orientation, billing port with a web no-op
- Saves local first; Supabase sync when signed in. Every `core/` module ships with `*.test.ts` beside its files.

## 10. New repo setup — `{TylerHill}/MMAMaster`

**What carries over from GamesCasino:** the toolchain (pnpm, Vite, Vitest, Capacitor 6, Supabase, TypeScript config with `@/* → src/*`), `.github/workflows/ci.yml` (trimmed), the `.vscode` settings, the iOS helper scripts, `docs/AGENT_CICD_HANDOFF.md`, and the *mechanism* of eslint-plugin-boundaries. **Not carried over:** its `app/features/games/shared/platform` folders and its `.eslintrc.cjs` — this game gets its own layout and its own rules file.

**Status:** the skeleton below plus the rules file have been built and verified (2026-11-07): the clean skeleton lints with zero errors, and a planted violation of each rule is caught. It lives in the Claude session workspace until the repo exists.

### Folder contract

```
src/
  main.tsx          entry (ignored by the boundaries plugin)
  env.d.ts
  app/              composition root: App, navigation, providers
  ui/               React — screens/, hud/, controls/, primitives/, index.ts
  engine/           Phaser — scenes/, sprites/, world/, bridge/, index.ts
  core/             pure rules, one module per folder, each with index.ts and *.test.ts
    combat/  depth/  ai/  gauntlet/  progress/  input/
  content/          data, not code: towns/, fighters/, moves/, audio manifest
  services/         Supabase: client, auth, saves sync, leaderboard; index.ts
  platform/         Capacitor native vs web adapters; index.ts
  shared/           framework-free helpers and types
assets/             atlases, environment layers, map, audio, fonts (served at /assets)
```

### Boundaries — who may import whom (low to high)

| From | May import |
|---|---|
| shared | shared |
| core/* | its own module freely; other core modules via `index.ts`; shared |
| content | core barrels, shared |
| platform | platform, shared |
| services | core barrels, shared, platform barrel |
| engine | core barrels, content, shared, platform barrel |
| ui | core barrels, content, shared, services, platform, engine (barrels) |
| app | everything, through barrels |

Hard rules, all errors in CI:
- `core/`, `content/` and `shared/` cannot import `phaser`, `react`, `@capacitor/*` or `@supabase/*` — rules stay pure and testable (`boundaries/external`).
- Only `platform/` imports `@capacitor/*`, only `services/` imports `@supabase/*`, only `engine/` imports `phaser` (`boundaries/external`).
- `engine/` never imports `ui/`; `ui/` never reaches into `engine/` internals (`element-types` + `entry-point`).
- Core modules, `engine/`, `services/`, `platform/` and `ui/` are imported only through their `index.ts` (`boundaries/entry-point`). `content/` and `shared/` are open.
- A source file outside these folders fails lint (`boundaries/no-unknown-files`).
- No import cycles (`import/no-cycle`); grouped, alphabetized imports (`import/order`, warn).

### `.eslintrc.cjs` — the verified rules file

The rules file is at the repo root: [`.eslintrc.cjs`](../.eslintrc.cjs). It is the file this section of the plan specified, unchanged apart from an `ignorePatterns` line for build output and native projects.

Adding a layer later means one entry in `boundaries/elements` and one row in `element-types`, in the same PR as the folder.

**CI (`ci.yml`):** keep `lint-test-build` — pnpm → Node 22 → `pnpm install --frozen-lockfile` → `pnpm run lint` → `pnpm run test` → `pnpm run build`. Drop the rules-engine diff step and the `backend` job until Supabase is added. Branch protection on `main` requires `lint-test-build`.

**Agent pipeline:** new Todoist project (set repo variable `TODOIST_PROJECT_NAME`), copy `daily-feature-agents.yml`, add the `CLAUDE_CODE_OAUTH_TOKEN` and `TODOIST_API_TOKEN` secrets — all per the handoff doc. Agents never edit `.github/workflows/`.

**Docs:** add the "Code structure contract" section below to `docs/AGENT_CICD_HANDOFF.md` in this repo (GamesCasino gets its own version for its layout), and put the folder contract plus the boundaries table in the README.

### Handoff doc section — "Code structure contract"

> **Code structure contract (enforced, not optional).** The import graph is policed by `eslint-plugin-boundaries` and `eslint-plugin-import` in `.eslintrc.cjs`, run by `pnpm run lint` inside the `lint-test-build` CI job, which is a required status check on `main`. A PR that breaks structure cannot merge.
>
> Elements: `src/app`, `src/ui`, `src/engine`, `src/services`, `src/platform`, `src/content`, `src/core/<module>`, `src/shared`. A source file outside these fails `boundaries/no-unknown-files`.
>
> Allowed imports run low to high — shared → core → content → platform → services → engine → ui → app — per the table in `MMA_MASTER_PLAN.md` §10. `engine/` never imports `ui/`.
>
> Entry points: core modules, `engine/`, `services/`, `platform/` and `ui/` are imported only through their `index.ts` (`boundaries/entry-point`). `content/` and `shared/` are open.
>
> Packages: `core/`, `content/` and `shared/` import no `phaser`, `react`, `@capacitor/*` or `@supabase/*`; only `platform/` touches Capacitor, only `services/` touches Supabase, only `engine/` touches Phaser (`boundaries/external`). Also `import/no-cycle` (error) and `import/order` (warn).
>
> Adding a layer: one entry in `boundaries/elements`, one row in `element-types`, same PR as the folder.

## 11. What to install

### On the Mac

| Tool | Why | How |
|---|---|---|
| Node 22 | Matches CI (`setup-node` 22) | nvm or Homebrew |
| pnpm 11.20 | Pinned by `packageManager` in package.json; workspace + lockfile | `corepack enable` (or `npm i -g pnpm`) |
| Git + GitHub CLI (`gh`) | Agents and the PR-review sweep use `gh api` | `brew install gh`, `gh auth login` |
| VS Code + extensions | ESLint (fix on save), Prettier, TypeScript Next — from `.vscode/extensions.json` | Extensions pane |
| Claude Code CLI | Local skills, `claude setup-token` for the GitHub secret | `npm i -g @anthropic-ai/claude-code` (CI pins 2.1.296) |
| Xcode + Command Line Tools + CocoaPods | Capacitor 6 iOS builds (`cap sync` runs `pod install`) | App Store; `xcode-select --install`; `brew install cocoapods` |
| Android Studio + SDK + JDK 17 | Capacitor 6 Android builds — can wait until Android is next | Android Studio installer |
| Docker Desktop | Local Supabase stack (`pnpm exec supabase start`) — when the backend is added | docker.com |
| Deno 2 | `deno check` on Edge Functions — only once functions exist | `brew install deno` |
| Blender | Renders the sprite frames; its Python API drives the render script | blender.org (free) |
| free-tex-packer or TexturePacker | Packs frames into Phaser atlases | free-tex-packer is free |
| Aseprite (~$20) or Pixelorama (free) | Touch up frames, draw HUD and control icons — optional | aseprite.org / GitHub |
| Audio | BeepBox (web) or Bosca Ceoil, sfxr (web), Audacity for trimming | all free |

Not needed globally: the Supabase CLI is a devDependency (`pnpm exec supabase`), and `psql` is replaced by `docker exec -i supabase_db_<app> psql …`.

### npm packages

- **Runtime:** `phaser ^3.80`, `react ^18.3`, `react-dom ^18.3`, `@capacitor/core ^6.1`, `@capacitor/app ^6`, `@capacitor/haptics ^6`, `@supabase/supabase-js ^2.45`
- **Dev:** `typescript ^5.5`, `vite ^5.3`, `@vitejs/plugin-react ^4.3`, `vite-tsconfig-paths ^4.3`, `vitest ^2`, `eslint ^8.57`, `@typescript-eslint/parser` + `eslint-plugin ^7.16`, `eslint-plugin-boundaries ^4.2`, `eslint-plugin-import ^2.29`, `eslint-import-resolver-typescript ^3.6`, `eslint-plugin-react-hooks ^4.6`, `@capacitor/cli ^6.1`, `@capacitor/ios ^6.1`, `@capacitor/android ^6.1`, `@types/react`, `@types/react-dom`, `supabase ^2.115`
- **Stay on ESLint 8.** The rules file is eslintrc format; ESLint 9's flat config would mean rewriting the boundaries setup.
- **Not needed:** GamesCasino's `capacitor-storekit` and `capacitor-apple-signin` plugins, `esbuild`, and its `build-engine` script.

### Accounts and keys

- **GitHub:** repo `{TylerHill}/MMAMaster`, Actions on, branch protection on `main` requiring `lint-test-build`; secrets `CLAUDE_CODE_OAUTH_TOKEN`, `TODOIST_API_TOKEN`; variable `TODOIST_PROJECT_NAME`. Later: `SIT_SUPABASE_ACCESS_TOKEN`, `SIT_SUPABASE_DB_PASSWORD`, `SIT_SUPABASE_PROJECT_REF`.
- **Todoist:** a project for MMA Master with the sections and agent labels from the handoff doc.
- **Supabase:** SIT and production projects, when the backend is added.
- **Adobe ID** (free) for Mixamo; Quaternius downloads need no account.
- **Apple Developer Program** ($99/yr) for device builds, TestFlight and the App Store; **Google Play Console** ($25 one-time) when Android ships.

### First commands

```bash
pnpm install
cp .env.example .env.local
pnpm lint && pnpm test && pnpm build
pnpm dev
# when ready for the phone:
npx cap add ios && pnpm build && pnpm cap:sync && pnpm cap:ios
```

## 12. Naming / IP

- Inspiration only: no Kung-Fu Master, Karate Kid, TMNT, Simpsons or Ninja Gaiden names, characters or likenesses. Real town names are fine; landmarks stylized; no trademarked signage or logos.
- Check "MMA Master" on the App Store, Google Play and USPTO before any branding spend.

## 13. Gap analysis (2026-11-07)

What the plan does not yet define, grouped by when it bites. Every open line here is a story in `MMA_MASTER_BACKLOG.md`. Closed items are struck through.

### Blocks the vertical slice
- ~~**Screen spec**~~ — closed; see §7 Display. Still owed: the floor device by name (MM-213).
- **Sprite spec** (MM-080): frame size, animation fps, left/right by flip, outline and lighting style — one approved "golden" player sprite before mass rendering, plus an atlas and memory budget.
- **Controls implementation** (MM-015): React DOM overlay vs Phaser-drawn buttons; multi-touch, dead zones, hub-vs-arm tolerance; no browser gestures; haptics.
- **Numbers** (MM-039): a tuning table in `content/fighters`, however rough.
- **Game-feel spec** (MM-040): hit-stop in ticks, screen shake, KO slow-mo, camera lead.
- **The player** (MM-083): name, look, one-line backstory.
- **Debug tooling** (MM-018, MM-019, MM-020).

### Needed before Fenton is complete
- ~~**Fail state and timer**~~ — closed; see §5 (the clock, lives, health bars) and the star rule in §4.
- **The item** (MM-066), **enemy design sheets** (MM-050, MM-055, MM-056), **level length** (MM-067), **gym identities** (MM-140), **onboarding** (MM-107), **settings contents** (MM-105), **audio implementation** (MM-120), **strings** (MM-108).

### Needed before shipping
- **Offline v1** (MM-132, open question #3), **save model** (MM-130), **licensing log** (MM-007), **Git LFS** (MM-006), **release mechanics** (MM-220–MM-223), **testing beyond unit** (MM-210–MM-213), **crash reporting and analytics** (MM-224), **accessibility floor** (MM-109), **non-goals** (MM-227).

### Process
- **Milestones** (MM-230), **budget** (MM-231), **roles** (MM-232), **risk register** (MM-233), ~~**backlog**~~ — written, `MMA_MASTER_BACKLOG.md`.

## 14. Open questions

1. Up/down = walk in depth (TMNT / Simpsons arcade), or one flat plane with up = jump, down = crouch (Karate Kid NES / Ninja Gaiden)? Default: depth (MM-234 spike).
2. Pre-rendered 3D acceptable, or is real-time 3D required?
3. Ship v1 offline (no accounts, no Supabase) and add leaderboards in v1.1?
4. Monetization for v1 — paid, ads, or none?
5. Floor device by name (proposed: iPhone SE 2nd gen and a Pixel 4a-class Android).
6. Lives numbers: X granted per day, cap Y.
7. Repo name, and when to create it.

## 15. Build order

1. Push the verified skeleton; CI green on an empty game.
2. Vertical slice: one fighter with the punch and kick strings, one grunt type, the street kit, the D-pad with its guard hub and the six-slot cluster with four live buttons — on a real phone.
3. Tap/hold strikes, elbows, knees, dash variants, clinch, check timing.
4. The gauntlet: enemy stream by scroll distance, density curve, rank escalation; depth movement and flanking AI; hit-stop, knockback; the clock, lives and the Knocked Out screen.
5. Title, metro map with unlocks, stars and lives, level card, results, saves, daily grant.
6. Fenton as the first complete level: full roster, gym leader with a style and a key.
7. Remaining suburbs, the St. Louis city neighborhoods and their leaders; the champion's arena and the champion.
8. Difficulty setting and progressive ramp; audio, polish, store builds.

**References (GamesCasino):** `README.md` §Getting started, §Native builds; `docs/AGENT_CICD_HANDOFF.md`; `.github/workflows/ci.yml`; `package.json`.
