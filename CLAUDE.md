# MMA Master — conventions for agents and people

A side-scrolling Muay Thai beat 'em up: fight through each town's gym to its leader, then the city champion.
Design: `docs/MMA_MASTER_PLAN.md`. Stories: `docs/MMA_MASTER_BACKLOG.md`. What exists: `docs/BUILD_STATUS.md`.
Pipeline rules: `docs/AGENT_CICD_HANDOFF.md`.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm lint      # ESLint incl. the import boundaries — zero warnings allowed
pnpm test      # Vitest: unit tests plus a headless bot run of every level
pnpm build     # tsc --noEmit, then vite build
pnpm dev       # http://localhost:5173
pnpm format    # Prettier
pnpm test:pipeline   # the agent pipeline's scripts against a mock Todoist (python3, jq, git)
```

A change is done when `pnpm lint && pnpm test && pnpm build` pass and the story's own "done when" is met.
The full checklist and the story template are in `docs/DEFINITION_OF_DONE.md`.

## Where things go

| Folder | What lives there | May import |
|---|---|---|
| `src/shared` | framework-free helpers (`math`, seeded `Rng`) | shared |
| `src/core/<module>` | pure rules: `input`, `combat`, `depth`, `ai`, `gauntlet`, `progress`, `fight` | own module; other core modules via `index.ts`; shared |
| `src/content` | data, not code: moves, tuning, towns, strings, audio, display | core barrels, shared |
| `src/platform` | Capacitor vs web adapters | platform, shared |
| `src/services` | Supabase (stubbed in v1) | core barrels, shared, platform barrel |
| `src/engine` | Three.js: scenes, fighter models, 3D world, audio, bridge | core barrels, content, shared, platform barrel |
| `src/ui` | React: screens, HUD, controls, primitives | everything below it, through barrels |
| `src/app` | composition root: navigation, save, stage | everything, through barrels |

Lint enforces this (`.eslintrc.cjs`). If lint says a dependency is not allowed, the code is in the wrong
layer — move it; do not loosen the rule. Adding a layer is one entry in `boundaries/elements` and one row in
`element-types`, in the same PR as the folder.

## Rules that are easy to break

- **`core/` is pure.** No `three`, `react`, DOM, `Date.now()`, `Math.random()` or frame times. Time is 60 Hz
  ticks; randomness is the seeded `Rng` from `@/shared/rng`. The same inputs must replay to the same fight —
  `src/content/content.test.ts` checks it.
- **`core/` cannot import `content/`.** Rules take their numbers as arguments; `content/fightConfig.ts`
  assembles them. Tests in `core/` use small fixtures of their own.
- **Tuning is data.** A strike, a string, a cancel window, an enemy's stats, a level's stream, a clock, a
  score rate: change `src/content`, not code. Nothing in `core/` or `engine/` names a strike.
- **Every string the player reads** is in `src/content/strings.ts`.
- **Every `core/` module** has `*.test.ts` beside its files and an `index.ts` barrel. Import other elements
  through their barrel only.
- **The simulation is `core/fight`'s `FightSim`.** `engine/` feeds it one input frame per tick from a
  fixed-step accumulator and draws the state. Game rules never go in a 3D scene or a React component.
- **All input is the action map** (`core/input`): touch, keyboard and gamepad reduce to held actions.
  `SPECIAL_1` and `SPECIAL_2` are defined and bound to nothing in v1.
- **Orientation is one value** (`capacitor.config.ts` and `src/content/display.ts`). Never hardcode it.
- **No real businesses, logos or other games' names or characters** in art, signage or text
  (plan §12). Town names are real; gyms and people are invented.
- **Never edit anything under `.github/`** from an agent branch — workflows or the pipeline scripts in
  `.github/agents/`. The pipeline rejects the commit. Ask for the change with a `BLOCKED:` line instead.
- Art and sound are procedural in v0 (`engine/sprites`, `engine/world`, `engine/audio`). When real assets
  arrive they go in `assets/`, with a row in `LICENSES.md` in the same PR.

## Git

- `main` is reached only through merged PRs. Agent branches are `auto/agent-<Name>` (John, Brock, Silva,
  Matt, Jose; the manager is Dana and has no branch); human branches are `feat/*`, `docs/*`, `chore/*`,
  `hotfix/*`.
- One commit per task, message in the imperative, story id in the subject when there is one
  (`MM-037 Widen the check window on Easy`).
