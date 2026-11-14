# MMA Master

A side-scrolling Muay Thai beat 'em up. Every town has a rival gym: fight through its roster as it comes at
you, beat its leader, and earn the shot at the city champion. The first tour stop is the St. Louis metro —
Fenton, Chesterfield, Kirkwood, St. Charles, East St. Louis, Downtown, Soulard, The Hill, the Central West
End, then the champion under the Arch.

Mobile-first (iOS and Android through Capacitor), with a web build for fast iteration.

- **Setting up the repository and the pipeline: [docs/SETUP.md](docs/SETUP.md)**
- Design: [docs/MMA_MASTER_PLAN.md](docs/MMA_MASTER_PLAN.md)
- Backlog: [docs/MMA_MASTER_BACKLOG.md](docs/MMA_MASTER_BACKLOG.md)
- **What is built, what is placeholder, what is untested: [docs/BUILD_STATUS.md](docs/BUILD_STATUS.md)**
- Agent pipeline and review rules: [docs/AGENT_CICD_HANDOFF.md](docs/AGENT_CICD_HANDOFF.md)
- Conventions for anyone (or any agent) changing code: [CLAUDE.md](CLAUDE.md)

## Getting started

Node 22 and pnpm 11.20 (`corepack enable` reads the pinned version from `package.json`).

```bash
pnpm install
pnpm lint && pnpm test && pnpm build
pnpm dev            # http://localhost:5173 — size the window landscape
```

`.env.example` lists the Supabase variables for later; v1 runs without any of them.

### Playing on the web build

| | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Move (left/right, and up/down across the street) | D-pad | Arrows / WASD | D-pad / left stick |
| Guard — tap as a strike lands to check it | Middle of the D-pad | Space | LB / RB |
| Punch · Kick · Elbow · Knee (tap, or hold for a different strike) | P · K · E · N | J · K · U · I | X · A · Y · B |
| Dash (then a strike for the flying version) | Double-tap a direction | same | same |
| Clinch — then N knees, E elbow out, back + N dump | Walk into a fighter and keep holding toward them | same | same |
| Energy drink | The can | E | RT |
| Pause (with the combo list) | ⏸ | Esc | — |

`http://localhost:5173/?demo=fenton` (or any town id) lets the scripted bot play a level — useful for a look
at later levels and for screenshots. Settings → Debug overlay adds hitboxes, "Skip to leader" and
invincibility.

### On a phone

```bash
npx cap add ios          # once; or: npx cap add android
pnpm build && pnpm cap:sync && pnpm cap:ios
```

`cap:sync` applies the orientation from `capacitor.config.ts` to the native projects. Device builds need
Xcode with a signing identity (iOS) or Android Studio with JDK 17.

## Code structure

```
src/
  main.tsx          entry
  app/              composition root: navigation, save, stage
  ui/               React — screens/, hud/, controls/, primitives/
  engine/           Phaser — scenes/, sprites/, world/, audio/, bridge/
  core/             pure rules, one module per folder, each with index.ts and tests
    input/  combat/  depth/  ai/  gauntlet/  progress/  fight/
  content/          data, not code: moves/, fighters/, towns/, strings, audio, display
  services/         Supabase: auth, saves sync, leaderboard (stubbed in v1)
  platform/         Capacitor native vs web adapters
  shared/           framework-free helpers
assets/             atlases, layers, audio, fonts — empty for now, everything is drawn and synthesized in code
```

The whole fight is `core/fight`'s `FightSim`: one input frame in per 60 Hz tick, state out. It never sees a
frame time, a canvas or a random number that isn't seeded, so a level can be played headlessly in a test and
the same inputs always replay to the same fight. The engine draws that state; React draws everything around
it; all tuning is data in `content/`.

### Who may import whom

Enforced by `eslint-plugin-boundaries` in [`.eslintrc.cjs`](.eslintrc.cjs), run by `pnpm lint` in CI. A PR that
breaks the structure fails `lint-test-build`.

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

- `core/`, `content/` and `shared/` cannot import `phaser`, `react`, `@capacitor/*` or `@supabase/*`.
- Only `platform/` imports `@capacitor/*`, only `services/` imports `@supabase/*`, only `engine/` imports `phaser`.
- `engine/` never imports `ui/`; `ui/` never reaches into `engine/` internals.
- Core modules, `engine/`, `services/`, `platform/` and `ui/` are imported only through their `index.ts`.
- A source file outside these folders fails lint. No import cycles.

Adding a layer: one entry in `boundaries/elements`, one row in `element-types`, in the same PR as the folder.

## CI and the agent pipeline

Three workflows in `.github/workflows/`:

- **`ci.yml`** — one job, `lint-test-build`, on pushes to `main` and on pull requests: pnpm → Node 22 →
  `pnpm install --frozen-lockfile` → lint → test → pipeline tests → build. Make it a required check on `main`.
- **`daily-feature-agents.yml`** — the agent pipeline: Dana (manager) routes and reviews tasks on a Todoist
  board; John, Brock, Silva, Matt and Jose each implement tasks on their own branch and keep one PR open.
  Hourly, and dormant until its two secrets are set. Its logic is in `.github/agents/`; `pnpm test:pipeline`
  runs it against a mock Todoist.
- **`merge-gate.yml`** — a status check on every PR: its Todoist tasks complete, Claude's peer review on
  the head commit, and a person's approval.

How it works and how to switch it on: [docs/AGENT_CICD_HANDOFF.md](docs/AGENT_CICD_HANDOFF.md) and
[docs/SETUP.md](docs/SETUP.md). It has been tested offline only — see the build status.

## Non-goals for v1

Single player. No co-op, no online play, no accounts. No takedowns or ground game — strikes, guard and the
clinch only. No special moves: the two reserved buttons are on screen, locked, and bound to nothing. No
currencies, timers, events or store on the map.

## Naming and IP

Inspired by the arcade and NES beat 'em ups of the 1980s and '90s; it uses none of their names, characters or
likenesses. Town names are real. Gyms, leaders and storefronts are invented, and the Arch is drawn as a
landmark, not a logo. "MMA Master" still needs a name check on the App Store, Google Play and USPTO before
any branding spend (MM-225).
