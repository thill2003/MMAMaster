# MMA Master — Definition of Done and story template (MM-008)

Every story in [MMA_MASTER_BACKLOG.md](MMA_MASTER_BACKLOG.md) is written to the template below before the
Product Architect promotes it to Ready To Work, and is done only when every line of the Definition of Done
that applies to it is true. Agents and people use the same list. The code rules it points at are in
[CLAUDE.md](../CLAUDE.md); the pipeline rules are in [AGENT_CICD_HANDOFF.md](AGENT_CICD_HANDOFF.md).

## Story template

Paste this into the Todoist task description. The title stays `[Exx] MM-nnn Title`. A section that does not
apply says "n/a" rather than being deleted, so a reviewer can tell it was considered.

```markdown
**Plan** — why this story exists and where it comes from.
- Plan reference: MMA_MASTER_PLAN.md §<n> (or the gap in §13, or the bug report)
- Depends on: MM-nnn, MM-nnn (merged first) — or none
- Size: S | M | L

**Spec** — what the player or the developer sees when it is finished.
- Behaviour: <what happens, in the player's words where there is a player>
- Data: <what is added or changed in src/content — strikes, tuning, strings, towns>
- Out of scope: <what this story deliberately does not do>
- Done when: <one or more checks a reviewer can run or see, e.g. "the Fenton bot run clears on Easy">

**Dev checklist** — where the work goes.
- Layers touched: shared | core/<module> | content | platform | services | engine | ui | app
- New tests: <file and what each proves>
- Device check: needed | not needed — <why>
- Docs: <BUILD_STATUS.md, README, plan or backlog lines to update> — or none
```

## Definition of Done

### Plan

- [ ] The story names the plan section, gap or bug it answers, and any story it depends on is merged.
- [ ] A decision the plan leaves open (a ⏳ item in the plan) was made by the Product Architect, not by the
      implementer. An agent that hits one stops with a `BLOCKED:` line.

### Spec

- [ ] Every "done when" in the story is met, and the PR says how each was checked.
- [ ] Nothing outside "out of scope" was quietly added; unrelated problems found on the way are reported,
      not fixed.

### Dev checklist

- [ ] Code is in the right layer (CLAUDE.md, "Where things go"); no lint rule was loosened to make it fit.
- [ ] `core/` stays pure: no `phaser`, `react`, DOM, `Date.now()`, `Math.random()` or frame times; time in
      60 Hz ticks, randomness from the seeded `Rng`.
- [ ] Tuning is data in `src/content`; every string the player reads is in `src/content/strings.ts`.
- [ ] A new `core/` module has an `index.ts` barrel and `*.test.ts` beside its files; other elements are
      imported through barrels only.
- [ ] Orientation still comes from the one config value; nothing hardcodes it.
- [ ] No real businesses, logos, or other games' names or characters (plan §12).
- [ ] New assets are in `assets/` with a row in `LICENSES.md` in the same PR.
- [ ] Nothing under `.github/` changed on an agent branch.
- [ ] Docs that describe the change are updated in the same PR — at least `BUILD_STATUS.md` when a story
      moves from "Not built" or "Not verified".
- [ ] One commit per task, imperative subject starting with the story id (`MM-037 Widen the check window on
      Easy`); the PR checklist line carries the Todoist id (`- [x] <title> (todoist:<id>)`).

### Lint

- [ ] `pnpm lint` passes with zero warnings, import boundaries included.

### Tests

- [ ] `pnpm test` passes: unit tests, content integrity, determinism replay, and the headless bot run of
      every level.
- [ ] New rules have tests that fail without the change. A bug fix has a test that reproduces the bug.
- [ ] `pnpm build` passes (type check and Vite build).
- [ ] A change to the pipeline scripts passes `pnpm test:pipeline`.

### Device check

Needed for anything a player feels or sees on a phone: touch controls, layout and safe areas, device
profiles, HUD, frame rate, audio, haptics, and fight timing or difficulty. Not needed for docs, tests,
pipeline scripts or pure refactors with no visible change — the story says which, and why.

- [ ] Run in the browser with the [run skill](../.claude/skills/run/SKILL.md) at a phone size (844×390 and
      667×375) and a tablet size (1024×768), landscape, and the change exercised there. Screenshot or exact
      steps go in the PR.
- [ ] Run on a real phone (`pnpm build && pnpm cap:sync && pnpm cap:ios`) — the Product Architect's step,
      since device builds need a signing identity. Until the floor device is named and the device QA
      checklist exists (MM-213), the PR says "not yet device-checked" so the check is recorded as still
      owed; that does not hold back the merge, and the Todoist task is completed as usual.
- [ ] Holds 60 fps on the floor device once it is named (MM-213, MM-214).

A story is done when `pnpm lint && pnpm test && pnpm build` pass, its "done when" is met, and every item
above that applies is ticked — or, for the device check, recorded as still owed.
