# MMA Master — Backlog for Todoist (v1.1, 2026-11-07)

> **TO DO — push this backlog into Todoist.** Create a new Todoist project named `MMA Master` with the same seven sections as the GamesCasino board (Backlog · Task Review · Ready To Work · To Do · In Progress · PR · Hold/Blocked), then add all 118 stories below as tasks in **Backlog** with **no `Claude` label**, titled `[Exx] MM-nnn Title`, with the story text as the description. Nothing automated reads Backlog, so this is safe to do in one batch; the Product Architect promotes stories by hand afterwards. Not done yet as of 2026-11-07.

> Copied into the repo on 2026-11-14. Which stories the first build covers, in whole or in part, is in [BUILD_STATUS.md](BUILD_STATUS.md). The Todoist project for this game lives under Tyler Hill's account.

Stories grouped by epic, in rough build order. Every gap from the plan's §13 is its own story. Sizes: S (a day or less), M (a few days), L (a week or more). IDs are stable so Todoist tasks, PRs and plan references can cite them.

**How this lands in Todoist:** a new project named `MMA Master` with the same seven sections as the GamesCasino board (Backlog · Task Review · Ready To Work · To Do · In Progress · PR · Hold/Blocked). Every story starts in **Backlog** without the `Claude` label; the Product Architect refines, adds the label and promotes to Ready To Work by hand, per the handoff doc. Epic names become the task's prefix (`[E02] …`) so filters work.

**Milestones:** M0 skeleton · M1 vertical slice on a phone · M2 Fenton complete · M3 all St. Louis levels and the champion · M4 polish and beta · M5 store release · post-v1 for everything after.

## E00 — Repo and pipeline (M0)

- **MM-001** Create `{TylerHill}/MMAMaster` from the verified skeleton (rules file, tsconfig, vite/vitest configs, package.json, folder contract). Done when CI `lint-test-build` is green on `main`. (S)
- **MM-002** Trim `ci.yml` from GamesCasino: drop the rules-engine diff step and the `backend` job; require `lint-test-build` on `main`. (S)
- **MM-003** Stand up the agent pipeline: Todoist project, `daily-feature-agents.yml`, secrets `CLAUDE_CODE_OAUTH_TOKEN` and `TODOIST_API_TOKEN`, variable `TODOIST_PROJECT_NAME`. Done when a manager sweep completes against an empty Ready To Work. (M)
- **MM-004** README with the folder contract and boundaries table; copy `AGENT_CICD_HANDOFF.md` and add the Code structure contract section. (S)
- **MM-005** Project config: `.vscode`, `.env.example`, `.gitignore`, iOS helper scripts, Capacitor config with app id `com.{TylerHill}.mmamaster` and the landscape flag. (S)
- **MM-006** Git LFS (or a size rule) for atlases and audio. (S)
- **MM-007** `LICENSES.md` asset licensing log, seeded with the Mixamo and Quaternius terms. (S)
- **MM-008** Definition of Done and story template for this repo: plan + spec + dev checklist, lint, tests, device check. (S)

## E01 — Engine foundation (M1)

- **MM-010** Phaser boot: Boot, Preload and Fight scenes; fixed 60 Hz step driving `core/`; `core/` never sees a frame time. (M)
- **MM-011** Scaling: logical height 540, width fills 16:9–19.5:9, 4:3 letterbox rule, DPR cap 2, safe-area insets for HUD and controls. (M)
- **MM-012** Device profiles (`phone-small`, `phone`, `tablet`) as content data, chosen at launch, overridable from settings. (S)
- **MM-013** Orientation as one config value: Capacitor config, iOS orientation script, runtime layout read. (S)
- **MM-014** Typed React ↔ Phaser bridge (state in, events out) and the `PhaserGame` mount component. (M)
- **MM-015** Touch controls: decide React DOM overlay vs Phaser-drawn, then build the D-pad with guard hub and the six-slot cluster — multi-touch, dead zones, hub-vs-arm tolerance, browser gestures blocked, haptics hook. (L)
- **MM-016** Action map and input buffering (~6 frames): double-tap dash, hold detection, direction modifiers; keyboard and gamepad bindings for the web build. (M)
- **MM-017** Asset loader and atlas conventions: naming, atlas JSON, preload manifest. (S)
- **MM-018** Debug overlay: hitboxes and hurtboxes, state names, fps and tick counter, invincibility, level skip. (M)
- **MM-019** Move Lab scene: pick a string, play at any speed, scrub frames, live-edit `content/moves`. (M)
- **MM-020** Spawn-stream visualizer for gauntlet curves. (S)

## E02 — Combat core (M1–M2)

- **MM-030** Fighter state machine: idle, walk, dash, strike, guard, hit, knockdown, get up, KO. (L)
- **MM-031** Hitbox/hurtbox resolution with depth tolerance; hit-stop in ticks; knockback. (M)
- **MM-032** Strings and cancel windows: the `content/moves` data model and its executor. (L)
- **MM-033** Punch string, five taps on Punch alone: jab, cross, left hook, right hook, uppercut. (S)
- **MM-034** Tap vs hold on every strike button: a hold is a different strike from a tap, and strings may contain hold steps — tap-tap-hold, hold-tap-tap — each resolving to its own combo. Done when the Move Lab shows all three patterns on one button. (M)
- **MM-035** Cross-button combos: different buttons chain into different combos through limb-switch cancel windows (jab-cross-roundhouse, jab-elbow, cross-knee, jab-cross-hook-low kick). (M)
- **MM-036** Direction variants (teep, low kick, long knee, 12–6 elbow) and dash variants (superman punch, leaping elbow, flying kick, flying knee). (M)
- **MM-037** Guard on the D-pad hub: block, chip damage, the check window, low-kick check stagger. (M)
- **MM-038** Clinch: auto-grab on contact, clinch knees ×3, elbow break, dump/sweep with depth splash; enemy clinch and mash escape. (L)
- **MM-039** Tuning table v0 in `content/fighters`: player HP, damage per strike, hit-stun, knockdown rules, get-up invulnerability, enemy HP by rank. (S)
- **MM-040** Game-feel spec written and implemented: hit-stop ticks, screen shake, KO slow-mo, camera lead. (M)
- **MM-041** Elbow cut status (optional): extra chip and a cut VFX. (S)

## E03 — Enemies and AI (M2)

- **MM-050** Enemy design sheets for brawler, kicker, grappler and quick: moves, speed, tells. (S)
- **MM-051** Grunt AI: approach, flank in depth, attack patterns, spacing, clinch attempts. (L)
- **MM-052** Rank escalation: white → blue → brown → black belt stat and behavior multipliers. (S)
- **MM-053** Gym leader framework: signature moves, tells, intro, unique look on the shared rig. (M)
- **MM-054** Champion AI: phases and a unique moveset. (L)
- **MM-055** Seven one-page design sheets: six leaders and the champion. (M)
- **MM-056** Boss custom fighting styles: every leader and the champion fights a distinct style with a counter the player has to work out — a low-kick specialist who has to be checked, a clincher who has to be kept off with teeps, an elbow brawler you guard and punish, a counter-striker you can't rush. Each sheet names the key and the tells that hint at it; no on-screen hints in v1. Done when a playtester who found the key beats the boss far faster than one who didn't. (L)

## E04 — Gauntlet and level runtime (M2)

- **MM-060** Gauntlet engine: spawn by scroll distance, density curve, roster mix, set-piece holds, leader trigger. (L)
- **MM-061** Level clock in ticks: HUD countdown, warning SFX, time-out KO. (S)
- **MM-062** Knocked Out screen: Retry (costs a life, restarts the level), Back to map, lives remaining. (S)
- **MM-063** Superseded by MM-070 — no leader checkpoint; a life always retries the entire level.
- **MM-064** Score: hits scaled by combo, limb-variety bonus, time and health bonuses, all rates in content. (M)
- **MM-065** Stars: finish, at least half health, at least a quarter clock; results breakdown. (S)
- **MM-066** Energy drink item: decide the source (enemy drops, fixed pickups or starting count), then pickup, slot count and use. (M)
- **MM-067** Level length targets per town as numbers: scroll distance, enemy count, minutes, clock length. (S)
- **MM-068** Camera: scroll, holds, lead; depth sort by y; parallax. (M)
- **MM-069** Street kit variations: time of day, color grade, signage swaps. (S)
- **MM-070** Lives: every attempt at a level costs one life; a KO by damage or by the clock ends the attempt and the retry starts the entire level over. Lives count shown on the map and in the HUD; a finished level does not refund the life. (M)
- **MM-071** Daily tries: opening the game on a new calendar day grants X lives, capped at Y (both in content); an out-of-lives screen says when the next grant comes. Local device date for v1 (acceptable risk), server time when accounts arrive in v1.1. (M)
- **MM-072** Health bars: one player bar for the whole level; grunts show no bar; the gym leader and the champion get their own bar with a name plate that appears when that fight starts, Kung-Fu Master style. (S)

## E05 — Art pipeline (M1–M3)

- **MM-080** Golden sprite: frame size, animation fps, lighting and outline style; one approved player sprite before anything else is rendered. (M)
- **MM-081** Blender render script: import, retarget, fixed camera angle, batch-render clips to PNG frames. (L)
- **MM-082** Atlas packing script (free-tex-packer CLI), memory budget, 4096² texture cap. (S)
- **MM-083** Player character sheet — name, look, one-line backstory — and the model. (M)
- **MM-084** Player animation set: idle, walk, dash, all strikes and hold variants, guard, check, hit, knockdown, get up, KO, win. (L)
- **MM-085** Acquire or commission the missing clips: elbows, teep, clinch, spinning back elbow. (M)
- **MM-086** Enemy archetype models and animation sets, material swaps per gym, rank markers. (L)
- **MM-087** Six gym leader looks with signature-move clips. (L)
- **MM-088** Champion model and moveset clips. (L)
- **MM-089** Street kit parallax layers and skyline. (M)
- **MM-090** Boss arena interior kit. (M)
- **MM-091** VFX: hit spark, dust, KO flash, cut. (S)
- **MM-092** HUD and control icons: D-pad with hub, four strike icons, two locked placeholders, lives icon. (S)
- **MM-093** Metro map art for St. Louis: background or layers, path, node badges with states, stars, padlock, champion crest, level-card frame, leader portraits. (L)
- **MM-094** Retro font and type scale. (S)

## E06 — UI and screens (M2–M3)

- **MM-100** Title screen: logo, Play, Settings. (S)
- **MM-101** Metro map screen: scroll, node states, path draw-on, unlock animation, star totals, lives counter. (L)
- **MM-102** Level card: town, gym, leader, best stars, lives remaining, Fight. (S)
- **MM-103** Results screen: star breakdown, score, best combo. (S)
- **MM-104** Pause menu. (S)
- **MM-105** Settings: music and SFX sliders, haptics, left-handed mirror, button size and position, reduce screen shake. (M)
- **MM-106** HUD: player bar, boss bar when a boss fight starts, countdown, stage pips, combo counter, item slot, lives. (M)
- **MM-107** Onboarding: Fenton as the tutorial — control hints and first-use prompts. (M)
- **MM-108** All strings in `content/strings` from day one, English only. (S)
- **MM-109** Accessibility floor: minimum button sizes, colorblind-safe HUD, reduced motion, remappable layout. (M)

## E07 — Audio (M3–M4)

- **MM-120** Audio system: WebAudio unlock on first touch, loops, mute on background via the app lifecycle, audio sprites. (M)
- **MM-121** SFX set, about twenty: per-limb impacts, block, check, clinch, KO, clock warning, UI. (M)
- **MM-122** Music: map, six towns, champion's gym, champion fight — a chiptune take on sarama for leader and champion fights. (L)

## E08 — Progression and saves (M2)

- **MM-130** Progress model: unlocks, stars, best score and combo, lives and last grant date; versioned save schema with a migration path. (M)
- **MM-131** Local persistence through Capacitor Preferences with a web fallback. (S)
- **MM-132** Offline v1: confirm no accounts and no Supabase in the shipped build; `services/` stubbed behind its barrel. (S)
- **MM-133** v1.1: Supabase auth, cloud save merge (keep the best), leaderboards, server-time daily grants. (L)

## E09 — Content: St. Louis metro (M2–M3)

- **MM-140** Gym identities: seven gym names, leader names and looks, each town's flavor on the shared street kit. (S)
- **MM-141** Fenton level content (the tutorial level). (M)
- **MM-142** Chesterfield level content. (M)
- **MM-143** Kirkwood level content. (M)
- **MM-144** St. Charles level content. (M)
- **MM-145** East St. Louis level content. (M)
- **MM-146** Downtown level content. (M)
- **MM-147** St. Louis city levels before the champion: two or three neighborhood levels between Downtown and the boss (Soulard, The Hill, Central West End as candidates), each with its own gym and leader. (L)
- **MM-148** Champion level: arena and the boss fight. (L)
- **MM-149** Difficulty curve numbers across every St. Louis level. (S)

## E10 — Difficulty (M3)

- **MM-150** Difficulty setting — Easy, Normal, Hard — as multipliers on enemy HP, damage, density and clock length. (M)
- **MM-151** Progressive difficulty: per-level and per-metro multipliers that ramp automatically from content data, so later towns and later cities get harder without hand-tuning each one. (M)
- **MM-152** Optional assists for Easy: wider check window, more energy drinks. (S)

## E11 — Themes per level (M3 and later)

- **MM-160** Per-level theme config in content: kit (street, gym, dojo), palette and time of day, signage, mat and wall colors — every level can look different from data alone. (M)
- **MM-161** Gym interior kit with mat and wall variants. (L)
- **MM-162** Dojo kit: wood floor, tatami, scrolls. (M)
- **MM-163** Segment sequencing within a level: street approach → gym doors → mats → leader. (M)

## E12 — Combo and control setup by the player (post-v1)

- **MM-170** Control layout editor: drag and resize buttons, presets, defaults per device profile. (M)
- **MM-171** Combo setup by the player: assign strings to buttons and tap/hold patterns within the rule limits, with validation and a saved layout. (L)
- **MM-172** Combo list and training screen showing every available string and its input. (M)

## E13 — Special moves on the reserved buttons (post-v1)

- **MM-180** SPECIAL_1 grappling: hold is a different move from tap — tap for a grab variant, hold for a throw or takedown — with its cooldown or meter rule. (L)
- **MM-181** SPECIAL_2 jumping strike: hold is a different move from tap — tap for a jumping kick, hold for a charged flying strike — including the air state the v1 moveset leaves out. (L)
- **MM-182** Eight-limbs meter feeding the specials. (M)
- **MM-183** Special-move VFX, SFX and the unlock presentation when a reserved button lights up. (S)

## E14 — New characters (post-v1)

- **MM-190** Character select screen and roster data. (M)
- **MM-191** Second playable fighter with a different style and ranges. (L)
- **MM-192** New enemy archetypes flavored per metro. (M)
- **MM-193** Character unlock rules: stars or metro completion. (S)

## E15 — New metros (post-v1)

- **MM-200** Metro chapter framework: one map per metro, node data, unlock between metros, the progressive multipliers from MM-151, map scrolling on into the next chapter. (M)
- **MM-201** Chicago metro: suburbs → city levels → champion. (L)
- **MM-202** Kansas City metro. (L)
- **MM-203** Cleveland metro. (L)
- **MM-204** Major US cities roadmap: the ordered list, the per-metro template (suburbs, city levels, boss), the production checklist per metro. (S)
- **MM-205** Metro content pipeline: one PR per metro, map art template, gym and leader sheets template. (M)

## E16 — QA and testing (M2–M4)

- **MM-210** Deterministic replay tests for combat: seeded inputs → exact expected states, made exact by the fixed 60 Hz step. (M)
- **MM-211** Headless level simulation: an AI player runs a town end to end in CI. (M)
- **MM-212** Playwright smoke test of the web build in CI. (S)
- **MM-213** Device QA checklist and the floor device named (proposed iPhone SE 2nd gen and a Pixel 4a-class Android); perf budget. (S)
- **MM-214** Profiling pass on the floor device at M1 and again at M4. (M)

## E17 — Release (M4–M5)

- **MM-220** Icons, splash, iOS privacy manifest, Android keystore. (S)
- **MM-221** TestFlight and a Cloudflare Pages web URL for playtests. (M)
- **MM-222** Store listings: copy, screenshots, trailer. (M)
- **MM-223** Version and build-number scheme; release checklist. (S)
- **MM-224** Crash reporting and analytics: decide none or one lightweight tool; store disclosure either way. (S)
- **MM-225** Name clearance: App Store, Google Play and USPTO check for "MMA Master". (S)
- **MM-226** Monetization decision for v1: paid, ads or none. (S)
- **MM-227** Non-goals statement in the README: single player, no co-op, no online, no takedowns, no specials in v1. (S)

## E18 — Process

- **MM-230** Milestones M0–M5 with dates. (S)
- **MM-231** Budget: commissioned clips, environment art, music, store fees, hosting. (S)
- **MM-232** Roles: Blender pipeline, map and icon art, device testing. (S)
- **MM-233** Risk register, maintained in the plan. (S)
- **MM-234** Spike: depth movement on a real phone — settles open question #1 (depth vs flat plane) before the slice is built out. (S)
