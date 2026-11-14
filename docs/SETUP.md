# Setting up the MMAMaster repository

For Tyler — and for Claude Code working with him. This folder is the whole game plus its CI and the
pipeline documents, ready to become `thill2003/MMAMaster`. Steps marked **(H)** need a person: Claude Code is
blocked from writing secrets, and the accounts are yours.

If you are handing this to Claude Code, open it in this folder and say:

> Read `docs/SETUP.md`. Do steps 1 to 3, show me the results, and stop before anything marked (H).

`CLAUDE.md` at the root loads on its own and carries the project's conventions.

## 1. Check it runs

Needs Node 22. `corepack enable` picks up the pinned pnpm (11.20.0) from `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint && pnpm test && pnpm build
pnpm dev        # http://localhost:5173, landscape window; ?demo=fenton lets the bot play
```

Expected: lint prints nothing after its command line, 88 tests pass, the build writes `dist/`.
`pnpm test:pipeline` checks the agent pipeline separately (step 5).
If `pnpm install` complains about ignored build scripts, `pnpm-workspace.yaml` (which allows `esbuild`)
did not come along — check that hidden and dot-files were unzipped.

## 2. Put it in the repository

The GitHub repo exists and is empty. From this folder:

```bash
git init -b main
git remote add origin https://github.com/thill2003/MMAMaster.git
git add -A
git status --short | grep -E "node_modules|dist/" && echo "STOP: build output is staged"
git commit -m "Build MMA Master v0: playable St. Louis metro on the layered skeleton"
git push -u origin main
```

These must be in the commit — they are easy to lose when copying by hand: `.github/workflows/` (three files), `.github/agents/`,
`.eslintrc.cjs`, `.gitignore`, `.gitattributes`, `.npmrc`, `.prettierrc.json`, `.env.example`, `.vscode/`,
`.claude/skills/run/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.

Pushing a workflow file needs a credential with the `workflow` scope (`gh auth login` grants it;
`gh auth setup-git` makes git use it).

## 3. Confirm CI

The push starts the `CI` workflow. Its one job, `lint-test-build`, should go green:

```bash
gh run list --workflow=ci.yml --limit 3
gh run watch
```

## 4. Repository settings (H)

- **Actions** enabled (Settings → Actions → General).
- **Branch protection** on `main` requiring the `lint-test-build` check, if the plan allows it. On a private
  Free-plan repo it does not; the handoff doc §4.1 and §7.5 explain what to do instead.
- **Before generating native projects**, set the real app id in `capacitor.config.ts`. It is
  `com.sharperproducts.mmamaster` as a placeholder; the plan left it as `com.{TylerHill}.mmamaster`.

## 5. The agent pipeline (H for the accounts and secrets)

The pipeline is in the repo and switched off until its two secrets exist: `.github/workflows/
daily-feature-agents.yml` (Dana the manager, then workers John, Brock, Silva, Matt and Jose) and
`.github/workflows/merge-gate.yml`. `docs/AGENT_CICD_HANDOFF.md` part 1 says how it was built and what
has not been proven: it was written from the handoff document's description and tested against a mock
Todoist, and it has never run on GitHub. Treat the first real run as a test.

1. **Check the pipeline's own tests pass on your machine:** `pnpm test:pipeline` (needs python3, jq, git).
   Expected last line: `8 scenario(s), 63 check(s), 0 failed`.
2. **Todoist, in your account.** Create a project named exactly `MMA Master` with seven sections named
   exactly: Backlog, Task Review, Ready To Work, To Do, In Progress, PR, Hold/Blocked (descriptions in the
   handoff doc §3.1). Create labels `Claude`, `John`, `Brock`, `Silva`, `Matt`, `Jose`.
3. **Load the backlog.** With the Todoist connector on, ask Claude Code:

   > Read `docs/MMA_MASTER_BACKLOG.md`. In the Todoist project `MMA Master`, add every story as a task in
   > the Backlog section, titled `[Exx] MM-nnn Title`, with the story text as the description and no labels.
   > Show me the count before you create anything.

   Nothing automated reads Backlog, so this is safe in one batch. `docs/BUILD_STATUS.md` lists the stories
   the first build already covers — close or trim those by hand.
4. **Secrets (H):** `CLAUDE_CODE_OAUTH_TOKEN` (run `claude setup-token` on a machine logged in to Claude
   Code) and `TODOIST_API_TOKEN` (Todoist → Settings → Integrations → Developer, from the account that owns
   the `MMA Master` project). Add both under Settings → Secrets and variables → Actions. From the next
   run on, the pipeline is live.
5. **Variable (optional):** `TODOIST_PROJECT_NAME`. The workflow already falls back to `MMA Master`; set
   the variable only if the project is ever renamed.
6. **Smoke test, in this order** (handoff doc §10, steps 15–19):
   - `gh workflow run daily-feature-agents.yml`, then `gh run watch`. With an empty board, `setup` finds
     the project and six sections, Dana logs "0 unhandled blocker(s)", "0 task(s) awaiting PR review",
     "0 untagged Ready To Work task(s)", and each worker logs "0 task(s) waiting".
   - Put one small task in Ready To Work with the `Claude` label and run again. Dana should label it and
     move it to To Do; that worker should push to `auto/agent-<Name>`, open "<Name>'s work queue", post
     `Pushed as <sha> to PR #<n>` on the task and move it to PR.
   - Run again: Dana should post a `**Dana:** (review)` comment on it.
   - Add a `BLOCKED: test` comment to a To Do task and run again: it should move to Hold/Blocked with a
     `**Dana:**` comment and stay there.
7. **Review skills.** Copy `docs/pipeline/skills/peer-review/` and `impediment-removal/` to
   `~/.claude/skills/` on the machine that does reviews. They already point at the `MMA Master` project.
8. **Know the costs.** The workflow is scheduled hourly. An idle run is short, but every task a worker
   takes is a Claude session of up to 30 turns. To pause it, disable the workflow in the Actions tab.

Things to expect that are by design, not bugs (handoff doc §6.4): Dana assigns every `Claude`-labelled task
in Ready To Work in one pass, so promote only what should start now; pushes by the pipeline's token do not
trigger CI, so an agent PR shows no `lint-test-build` until a person pushes to the branch; and `merge-gate`
is red on any PR until its Todoist tasks are complete and both reviews exist.

## 6. What to read next

- `docs/BUILD_STATUS.md` — what is built, what is a placeholder, what nobody has tested yet, and the
  decisions that were taken to get it built and are still open to change.
- `docs/MMA_MASTER_PLAN.md` — the design.
- `README.md` — structure, controls, commands.
