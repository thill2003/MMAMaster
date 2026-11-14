# Agent-driven CI/CD handoff — MMA Master

This file has two parts:

1. **This repo** — what applies to `thill2003/MMAMaster` today, and what is still to wire.
2. **The reference handoff** — the GamesCasino document, carried over so the pipeline's rules travel with the
   repo. It describes the reference implementation, not this one; where the two differ, part 1 wins.

Account-specific identifiers in the reference (Todoist project and section ids, Supabase project refs, a
device UDID, an Apple team id, a local path) were replaced with `<placeholders>` when it was copied in,
because none of them belong to this project. Nothing else in it was changed.

---

## Part 1 — This repo

### What is different here

| Topic | GamesCasino (reference) | MMA Master |
|---|---|---|
| Repo | `Sharper83/GamesCasino` | `thill2003/MMAMaster` |
| Manager | Depa Billaba, prefix `**Depa Billaba:**` | **Dana**, prefix `**Dana:**` |
| Workers | Tech, Hunter, Wrecker, Echo, Omega | **John, Brock, Silva, Matt, Jose** — Todoist labels and branches `auto/agent-<Name>` use these names |
| Todoist | Project under Scott's account | Project **`MMA Master` under Tyler Hill's account**. The `TODOIST_API_TOKEN` secret must be a token from that account; the repo variable `TODOIST_PROJECT_NAME` is `MMA Master` (also the built-in fallback). |
| Agent workflow | `daily-feature-agents.yml`, about 1,100 lines of inline bash | `.github/workflows/daily-feature-agents.yml` calling scripts in `.github/agents/`. **Written fresh from §6 of part 2** — the reference file itself was not available. Same jobs, sweeps, prefixes and governance rules; see "How the pipeline here was built" below. |
| Backend | Supabase (local, SIT, production) | None in v1 — the game ships offline (`src/services` is a stub). No `backend` job, no `deploy-sit`, no `deploy-production`, no `run-sit` skill until MM-133. |
| CI | `lint-test-build`, `backend`, `deploy-sit` | `lint-test-build` only: `.github/workflows/ci.yml`. It also runs the pipeline's own tests. |
| Merge gate | Option C: status check plus deploy backstop | `.github/workflows/merge-gate.yml` (Appendix D) is active as the status check. The deploy backstop has nothing to guard until there is a deploy job. One addition to Appendix D, marked in the file: a task that answers 404 is looked up among recently completed tasks before it is treated as not complete. |
| Review skills | `~/.claude/skills/` on Scott's Mac | Copies of Appendix A and B, renamed for this repo, are in `docs/pipeline/skills/`; copy them to `~/.claude/skills/` on the machine that reviews. |
| Code structure | GamesCasino's own rules | The contract below. |
| Conventions for agents | `CLAUDE.md` | [`CLAUDE.md`](../CLAUDE.md) at the repo root. |
| Run skill | `run` (Docker Supabase + Vite) | [`.claude/skills/run/SKILL.md`](../.claude/skills/run/SKILL.md): Vite only. |

Wherever part 2 says Depa Billaba, the Bad Batch, or one of the old worker names, read the names above.

### How the pipeline here was built

`daily-feature-agents.yml` follows §6 job for job: `setup` → `manager` (escalation, PR review, assignment)
→ `run-agent` (a matrix of five). The differences from the reference are deliberate and small:

- **The logic is in `.github/agents/*.sh`, not inline in the YAML**, so it can be run outside Actions.
  `config.sh` holds every knob in §11. Each job copies the scripts from the default branch before an
  agent branch is checked out, so a branch cannot change the pipeline that runs it.
- **`pnpm test:pipeline`** runs the real scripts against a mock Todoist API, a stub `claude` and a stub
  `gh` (`scripts/pipeline-sim/`): 8 scenarios, 63 checks, covering every sweep, every governance rule in
  §6.3, crash recovery, merge conflicts and a stalled run. It is part of CI.
- **Dormant until configured.** Without both secrets the workflow logs a notice and stops, instead of
  failing every hour.
- **Workers reject any commit that touches `.github/`**, not only `.github/workflows/`, and send the task
  back with a `BLOCKED:` comment. The reference relies on the push failing.
- **One commit per task is enforced**: if a session makes several, they are folded into one before the push.
- **PR checklist lines carry the Todoist id** (`- [x] <title> (todoist:<id>)`, §7.5.4) from the start.
- **Idle workers do no setup**: a worker with nothing in its queue stops before installing pnpm or Claude.

What has not been proven: the pipeline has never run on GitHub, against the real Todoist API or with the
real Claude CLI. The mock and the stubs encode what part 2 and Todoist's API reference say those services
do. Run the smoke test (§10, steps 15–19) before trusting it with real work. Part 2's first paragraph also
says the reference has since moved to three workflows with Grok and GPT reviewers; this repo implements
the single-workflow design part 2 describes, not that newer one.

### Code structure contract (enforced, not optional)

The import graph is policed by `eslint-plugin-boundaries` and `eslint-plugin-import` in `.eslintrc.cjs`, run by
`pnpm run lint` inside the `lint-test-build` CI job, which is a required status check on `main`. A PR that
breaks structure cannot merge.

Elements: `src/app`, `src/ui`, `src/engine`, `src/services`, `src/platform`, `src/content`,
`src/core/<module>`, `src/shared`. A source file outside these fails `boundaries/no-unknown-files`.

Allowed imports run low to high — shared → core → content → platform → services → engine → ui → app — per the
table in `MMA_MASTER_PLAN.md` §10 (also in the README). `engine/` never imports `ui/`.

Entry points: core modules, `engine/`, `services/`, `platform/` and `ui/` are imported only through their
`index.ts` (`boundaries/entry-point`). `content/` and `shared/` are open.

Packages: `core/`, `content/` and `shared/` import no `phaser`, `react`, `@capacitor/*` or `@supabase/*`;
only `platform/` touches Capacitor, only `services/` touches Supabase, only `engine/` touches Phaser
(`boundaries/external`). Also `import/no-cycle` (error) and `import/order` (warn).

Adding a layer: one entry in `boundaries/elements`, one row in `element-types`, same PR as the folder.

### Still to do — all of it needs a person

Step-by-step version: [SETUP.md](SETUP.md).

1. **Todoist (Tyler's account):** create the project `MMA Master` with the seven sections in §3.1 and the
   labels `Claude`, `John`, `Brock`, `Silva`, `Matt`, `Jose`, then load `docs/MMA_MASTER_BACKLOG.md` into
   **Backlog** with no `Claude` label.
2. **GitHub secrets (H):** `CLAUDE_CODE_OAUTH_TOKEN` and `TODOIST_API_TOKEN` (Tyler's Todoist). The
   pipeline switches itself on when both exist.
3. **Branch protection** on `main` requiring `lint-test-build`, if the plan allows it (§4.1).
4. **Smoke test** per §10 steps 15–19, reading Dana for Depa and `John's work queue` for the PR title.

---

## Part 2 — Reference handoff (GamesCasino)

### Agent-driven CI/CD handoff (Peer Review + dual merge gate variant)

> **Superseded in part (2026-11-09).** The single hourly `daily-feature-agents.yml` this document describes has been replaced by three workflows (`agents-assign.yml`, `agents-worker.yml`, `agents-pr-round.yml`) and a model-free gate script, per the Depa PR Review Flow plan. Depa's PR review sweep is gone; every push now gets a gate check, a Yoda review (Grok) and a Cal Kestis review (GPT), then lands in a new **PO Review** section. The Todoist model, labels, git conventions, secrets and run skills below still apply. See [DEPA_PR_REVIEW_FLOW.md](DEPA_PR_REVIEW_FLOW.md) for the current flow and formats.


**Purpose.** One file that explains, end to end, how this project's autonomous
agent pipeline works and how to stand up the same thing on a new repository.
This variant replaces the "PO Reviews" skill with a **Peer Review** skill
(every change explained inline with before/after code, inside Claude Code) and
adds a **dual merge gate**: a PR may reach `main` only when its Todoist task is
complete **and** both Claude and the person have signed off on the review. The
merge is what triggers the deploy pipeline, so gating the merge gates CI/CD.

**Reference implementation.** GitHub repo `Sharper83/GamesCasino` (local folder
`LiabilityRummy`). Sections 1 to 6 and 8 to 12 describe what is live there as of
2026-11-06. Section 7 (Peer Review) and section 7.5 (dual gate) are the
proposed replacement and are **not yet implemented** in the reference repo;
the chosen design is Option C (status check plus deploy backstop, section
7.5.3); the workflow in Appendix D and the skill in Appendix A are ready to
copy.

---

## 1. The one-paragraph version

A Todoist project is the shared "blackboard". A human (the **Product
Architect**) writes tasks and promotes them to a *Ready To Work* section. Every
hour a GitHub Actions workflow runs one **manager agent** (named *Depa Billaba*)
and five **worker agents** (the *Bad Batch*: Tech, Hunter, Wrecker, Echo,
Omega). Each agent is a stateless `claude -p` call. The manager routes tasks to
workers, reviews their commits, and escalates problems. Each worker claims its
tagged tasks, implements them on its own long-lived branch (`auto/agent-<Name>`),
pushes, and keeps one open PR per branch. Only the human merges to `main`, and
only after marking the Todoist task complete. A separate CI workflow lints,
tests, and type-checks every PR and, on merge to `main`, auto-deploys the
backend to a staging (SIT) environment. Production deploys are a manual
workflow dispatch that requires typing the production project ref.

No agent framework is used. State lives only in Todoist (sections, labels,
comments) and in git/GitHub (branches, PRs, issues). A crashed run just
re-reads the blackboard next hour.

---

## 2. Components and where each lives

| Piece | Where | Who maintains |
|---|---|---|
| Todoist project `SHarper Casino Games` (id `<todoist-project-id>`), 7 sections, agent labels | Todoist (Scott's account) | Product Architect |
| `.github/workflows/daily-feature-agents.yml` (manager + 5 workers, hourly) | repo | Product Architect only. Agents cannot edit `.github/workflows/`. |
| `.github/workflows/ci.yml` (lint/test/build, backend checks, auto-deploy to SIT) | repo | Product Architect |
| `.github/workflows/merge-gate.yml` (dual gate status check; Appendix D) plus the backstop step in `deploy-sit` and `deploy-production` | repo | Product Architect |
| `.github/workflows/deploy-production.yml` (manual, typed-confirmation) | repo | Product Architect |
| `DEPA_BILLABA_PLAN.md` (design write-up for the manager agent) | repo root | reference only |
| GitHub secrets `CLAUDE_CODE_OAUTH_TOKEN`, `TODOIST_API_TOKEN`, `SIT_SUPABASE_*` | repo settings | Product Architect (classifier blocks `gh secret set` from Claude) |
| Local Claude Code skills `peer-review`, `impediment-removal` | `~/.claude/skills/` on Scott's Mac (not in the repo). Full text in Appendix A and B. | Product Architect |
| Project skills `run` (local stack) and `run-sit` (SIT in browser or on the iPad) | `.claude/skills/` in the repo (proposed; Appendix E, F) | Product Architect |
| Claude Code project memory | `~/.claude/projects/<project-dir>/memory/` | Claude writes, Scott reviews |
| Supabase projects: Local (Docker), SIT `<sit-project-ref>`, production `<prod-project-ref>` | Supabase | Product Architect |

---

## 3. Todoist: the blackboard

### 3.1 Project and sections

One Todoist project. The workflow finds it **by exact name** (repo variable
`TODOIST_PROJECT_NAME`, falling back to `SHarper Casino Games`). Rename
the project in Todoist and every run fails until the variable is updated.

Sections, in order, with who may touch them. These descriptions are pasted
into the section descriptions in Todoist so the rules travel with the board.

| # | Section | Who reads/writes | Purpose |
|---|---|---|---|
| 1 | **Backlog** | Architect only. No automation reads or writes here. | Raw ideas, unrefined stories. |
| 2 | **Task Review** | Depa creates items here (write + read, no move). Architect moves them out by hand. | Tangential findings an agent flagged mid-task (unrelated bug, follow-up feature). |
| 3 | **Ready To Work** | Architect promotes here by hand. Depa's **sole intake**. | Refined, ready stories. Decoupled from Backlog so a manager bug can never reach the backlog. |
| 4 | **To Do** | Depa moves tasks in (after tagging an agent). Workers pull from here. | The per-agent work queue. Dependency order = position in section. |
| 5 | **In Progress** | Worker moves its own claimed task here. At most one per agent. | Claim signal. A task left here by a dead run is resumed, not re-queued. |
| 6 | **PR** | Worker moves its finished task here. **Only the Architect marks complete.** | Pushed work awaiting human review. Nothing merges to `main` before the task here is complete. |
| 7 | **Hold/Blocked** | Depa (and the Peer Review skill) move tasks **in**. **Only the Architect moves out.** | Needs human judgement. |

Current section ids (useful when a skill says "project App"):
PR `<section-id>`, Hold/Blocked `<section-id>`, Ready To Work
`<section-id>`, Task Review `<section-id>`, To Do `<section-id>`,
In Progress `<section-id>`, Backlog `<section-id>`.

### 3.2 Labels

| Label | Meaning |
|---|---|
| `Claude` | **Master gate.** A task is eligible for *any* automation only if it carries this label, whatever section it sits in. Only the Architect adds or removes it. Protects against an accidental drag in the Todoist UI. |
| `Tech`, `Hunter`, `Wrecker`, `Echo`, `Omega` | Agent-name labels. Only Depa applies them (additively, never touching `Claude`). A worker claims a task only if it carries **both** `Claude` and its own name. |

Other labels in the account (`ScottHarper`, `Grok`, `Otodus`, etc.) are unrelated
to this pipeline.

### 3.3 Comment conventions (authorship by prefix)

All automation shares one Todoist API token, so "who wrote this" is enforced
purely by content prefix. Nothing else may ever produce a comment starting with
these strings.

| Prefix | Author | Used for |
|---|---|---|
| `BLOCKED:` | A worker, on its own current task | The worker's only escalation act. Depa's sweep string-matches on it. Deduped: an identical blocker is not reposted. |
| `**Depa Billaba:**` | Depa | Any decision she makes. She never has a silent "do nothing". |
| `**Depa Billaba:** (review)` | Depa | A code review of one commit. The review sweep dedupes on this. |
| `**Depa Billaba:** (no fit):` | Depa | A single comment with `[count: N]` bumped in place each sweep a task stays unmatched. |
| `Pushed as <sha> to PR #<n>: <subject>` | A worker | Posted right before moving a task to PR. Depa and the Peer Review skill read the SHA from it to fetch exactly that diff. |
| `**Peer Review (Claude):** READY` | Claude, via the Peer Review skill | GitHub **commit comment** on the head SHA. Gate 2 evidence. |
| `/peer-approved <sha>` | The repo owner, as a PR comment | Human approval for a PR the owner authored (GitHub forbids self-approval). Gate 3 evidence. |
| `**Product Architect:**` | The human, via the Peer Review skill | Rejection reason when a PR-section task is sent to Hold/Blocked. |

### 3.4 Todoist API notes (learned the hard way)

- REST v2 is sunset (HTTP 410). Use the unified API v1: `GET /api/v1/projects`,
  `/sections?project_id=`, `/tasks?project_id=&section_id=&label=`,
  `/comments?task_id=&limit=200`, and `POST /api/v1/sync` for writes.
- List endpoints return either a bare array or `{"results": [...]}`. Always
  unwrap with `if type == "array" then . else .results end`.
- Sync "create" commands (`item_add`, `note_add`) need a `temp_id` **and** a
  `uuid`, or the API silently no-ops them. `item_move`, `item_update`,
  `note_update` need only `uuid`.
- Depa's sweeps leave traces in the Todoist activity log. When GitHub is
  unreachable, `find-activity` on the project shows when she last ran.

---

## 4. GitHub: repo, secrets, permissions

### 4.1 Repository

- `Sharper83/GamesCasino`, **private, Free plan**. Default branch `main`.
- Free-plan consequences: no branch protection, no rulesets, no GitHub
  Environments with required reviewers. Separation between staging and
  production is done by **secret naming** and by the production workflow being
  `workflow_dispatch`-only with a typed confirmation.

### 4.2 Secrets (Settings → Secrets and variables → Actions)

| Secret | Used by | How to get it |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | manager + workers | On a machine with Claude Code logged in, run `claude setup-token` and paste the result. Expires; an expired token shows up as `claude exited 1` with no commit and a red run. |
| `TODOIST_API_TOKEN` | setup, manager, workers | Todoist → Settings → Integrations → Developer → API token. |
| `SIT_SUPABASE_PROJECT_REF`, `SIT_SUPABASE_ACCESS_TOKEN`, `SIT_SUPABASE_DB_PASSWORD` | `deploy-sit` job in ci.yml | Supabase dashboard. Access token from account settings; DB password from the project. |
| `PROD_SUPABASE_PROJECT_REF`, `PROD_SUPABASE_ACCESS_TOKEN`, `PROD_SUPABASE_DB_PASSWORD` | deploy-production.yml | **Not set yet.** The production workflow refuses to run until they are. |
| `GITHUB_TOKEN` | automatic | Used by workers to push and open PRs. Pushes with it do **not** trigger ci.yml (GitHub's loop prevention), so agent PRs get no CI until a human pushes to the branch. |

Repository variable (optional): `TODOIST_PROJECT_NAME` overrides the project
name lookup.

Claude Code running in auto mode on Scott's Mac is blocked by the permission
classifier from `gh secret set`, `supabase projects api-keys`, and merging PRs.
Those are human actions.

### 4.3 Workflow permissions

Each job declares an explicit `permissions:` block (which resets unlisted
scopes to none):

- `manager`: `pull-requests: read`, `contents: read` (needed for
  `gh api repos/.../commits/<sha>` diffs).
- `run-agent`: `contents: write`, `pull-requests: write`, `issues: write`.
- Default `GITHUB_TOKEN` cannot modify `.github/workflows/`; a worker commit
  touching that path makes the **whole push** fail. The worker prompt forbids
  it and asks for a `BLOCKED:` instead.

### 4.4 Local `gh` and git auth

- `gh auth login --web` then `gh auth setup-git` so git uses gh's credential
  helper. The OAuth token in `~/.config/gh/hosts.yml` has expired before; the
  symptom is `gh`, `git fetch`, and `git push` all failing at once.

---

## 5. Git conventions

| Branch pattern | Owner | Notes |
|---|---|---|
| `main` | Architect | Only reached via merged PRs. CI runs on push and on PRs targeting it. |
| `auto/agent-<Name>` | One worker each (`auto/agent-Tech`, `-Hunter`, `-Wrecker`, `-Echo`, `-Omega`) | Long-lived. Reused across tasks until the PR is merged or closed; then the next task starts fresh from `main`. Worker merges `origin/main` in before each task; a conflict stops that agent with a `BLOCKED:`. |
| `feat/*`, `docs/*`, `chore/*`, `hotfix/*` | Human (Scott with Claude locally) | Ordinary PR branches. |

**Fetch refspec gotcha.** The local clone's fetch refspec is
`+refs/heads/main:refs/remotes/origin/main` only. A plain `git fetch origin`
never updates `origin/auto/*`. Before basing work on, test-merging, or pushing
to an agent branch, run:

```bash
git fetch origin 'refs/heads/auto/*:refs/remotes/origin/auto/*'
```

Otherwise the push is rejected as non-fast-forward.

**Commit identity for agents.** Each worker sets
`user.name "<Agent> (Claude Agent)"` and
`user.email agent-<agent>@users.noreply.github.com`, so `git log` shows who did
what.

**PR shape for agents.** One PR per agent branch titled `<Agent>'s work queue`,
body is a checklist with one `- [x] <task title>` line appended per task. One
commit per task. Agents commit themselves inside the `claude -p` call; the
workflow never commits for them.

---

## 6. The agent workflow: `daily-feature-agents.yml`

Copy this file verbatim from the reference repo. The header comment inside it
is the authoritative design note. What follows is the operational summary.

### 6.1 Trigger

`cron: "23 * * * *"` plus `workflow_dispatch`. Minute 23, not 0: GitHub's
scheduler drops or delays top-of-hour runs under load. Even so, measured
cadence is about 4 runs/day, so a `BLOCKED:` comment can wait 4 to 8 hours for
Depa's next sweep. Trigger by hand with:

```bash
gh workflow run daily-feature-agents.yml
gh run list --workflow=daily-feature-agents.yml --limit 5
```

### 6.2 Jobs

1. **`setup`** looks up the project id and all six working section ids by
   name. Fails loudly (raw response to stderr) if any is missing.
2. **`manager`** (Depa Billaba). `needs: setup`. Concurrency group
   `daily-manager`, never cancelled. Installs a **pinned** Claude Code CLI
   (`@anthropic-ai/claude-code@2.1.296`). No checkout, no git identity: she
   never touches code. Every `claude -p` call runs with `--model opus`,
   `--tools ""` and `--max-turns 1`, text in, JSON out. The step logs the
   resolved model from the JSON envelope's `modelUsage` so each run records
   what it ran on. Trusted bash validates every parsed
   decision (task id in the real candidate set, decision in a fixed enum,
   agent in the fixed list) before any Todoist write. Three sweeps, in this
   order:
   - **Escalation.** Tasks in To Do + In Progress with a `BLOCKED:` comment
     newer than her last comment. Decision per task: `block` (move to
     Hold/Blocked + comment), `task-review` (create a `Claude`-labelled task in
     Task Review + comment with link on the original), or `acknowledge`
     (comment only).
   - **PR Review.** Tasks in PR whose latest `Pushed as <sha>` comment is newer
     than her latest `(review)` comment. Fetches that one commit's diff via
     `gh api`, one call per task. Decision: `ok` (post review comment) or
     `hold` (review comment + move to Hold/Blocked + reason).
   - **Assignment.** Tasks in Ready To Work. Already tagged with an agent →
     straight to To Do. Untagged → one batched call with all open
     `auto/agent-*` PR summaries as context. Decision: `assign` (add agent
     label, move to To Do), `hold`, or `no-fit` (bump the single count
     comment, leave in place).
   Hard failures (Todoist 401/5xx, CLI error) are recorded and the job exits
   non-zero at the end, so a broken token is a red run, not a green no-op.
3. **`run-agent`** (matrix of five). `needs: [setup, manager]` so anything
   Depa just routed is visible in the same cycle. Concurrency group per agent
   (`daily-feature-agent-<Name>`), never cancelled. Staggered starts of 0, 4,
   8, 12, 16 seconds. 180-minute timeout. Full-depth checkout, pnpm + Node 22,
   same pinned CLI. Loop up to 10 tasks per run:
   - Resume any task already In Progress under this agent (crash recovery).
     If the PR body already has `- [x] <task>`, just move it to PR.
   - Else claim the top To Do task tagged `Claude` + agent name, move it to In
     Progress.
   - Branch logic: if `origin/auto/agent-X` is ahead of `main`, check it out
     and merge `main` in (conflict → back to To Do, `BLOCKED:`, stop agent);
     else start fresh from `origin/main`.
   - `pnpm install --frozen-lockfile` for this branch's lockfile.
   - Fetch the task description **and full comment thread** (prior review
     feedback) and include them in the prompt.
   - `claude -p "$PROMPT" --model opus --allowedTools "Edit,Read,Write,Bash(git *),Bash(pnpm *)" --max-turns 30`.
     Anything outside the allowlist is denied, not paused, so it cannot hang.
   - No new commit → back to To Do. If output ends with `BLOCKED:` post it
     once. If the CLI exited non-zero, post to the task and to the standing
     GitHub issue **"Daily Feature Agents: Stall Log"**, turn the run red,
     stop.
   - Commit exists → push (3 retries), create or update the PR (3 retries),
     post `Pushed as <sha> to PR #<n>: <subject>`, move to PR.
   - A task met twice in one run ends the run (queue is dependency-ordered;
     skipping past it would be wrong).

### 6.3 Governance invariants (do not relax these when copying)

1. Authorship is by comment prefix. See §3.3.
2. Validate before acting is a hard-coded gate in bash, not a prompt
   instruction.
3. Depa never has a silent "do nothing"; `no-fit` is the single tracked
   exception.
4. Only the Architect moves a task out of Hold/Blocked.
5. `Claude` label is the master gate; only the Architect touches it.
6. Workers never create, label, or clone tasks. Their only Todoist writes are
   moving their own current task between To Do / In Progress / PR and
   commenting on it.
7. Workers never edit `.github/workflows/`.

### 6.4 Known behaviours to plan around

- Depa assigns **every** untagged `Claude` task in Ready To Work in one pass,
  per task, ignoring "start after X" comments. Promote only stories that are
  ready to start now, in the order you want them worked.
- Agent pushes don't trigger CI. Before a PO review, a human should push to the
  branch (even an empty merge of `main`) or run lint/test/`db reset` locally.
- The CLI version is pinned in two places (manager and run-agent). Bump both
  deliberately.
- **Model.** All four `claude -p` calls (Depa's and the workers') pass
  `--model opus`. The alias resolves to the latest Opus the pinned CLI
  release knows about, so a new Opus is picked up when the CLI pin is
  bumped, not on release day. The manager and the workers run the same
  model on purpose: Depa's PR review is the only automated quality gate
  before the human, and her calls are single-turn and only happen when
  there is work, so there is no saving worth a weaker reviewer. Locally the
  Architect runs Fable (above Opus) for the skills via `~/.claude/settings.json`;
  the runners have no settings file, so `opus` means Opus there.
- Cost: hourly schedule means CI minutes and Claude usage even on idle cycles.
  Each worker runs a 30-turn Claude session per task.

---

---

## 7. Peer Review: the human-in-the-loop review skill

The PO Reviews skill in the original setup asked for a single Approve/Reject
after a summary. Peer Review replaces it with a walkthrough: every change in
the task's commit is shown in Claude Code as **before** and **after** code
with a plain-English explanation, the person accepts or challenges each one,
and only then does the merge gate open. The skill lives at
`~/.claude/skills/peer-review/SKILL.md` (full text in Appendix A). It is
manual-only: say "run Peer Review".

### 7.1 What the person sees, per change

For each hunk in the diff Claude prints one block like this in the chat:

```
### Change 3 of 7: supabase/functions/_shared/handler.ts:41-58

What it does: adds an ALLOWED_ORIGINS allowlist so the CORS header echoes
the request origin only when listed. Unset keeps the old wildcard.

Why it is here: task ADS-5 asks the ad-reward callback to reject browser
origins other than the app shell.

Risk: low. Behaviour is unchanged when the secret is unset. One concern:
the comparison is case-sensitive; Origin headers are lower-cased by
browsers, so this is fine for Capacitor but a hand-typed uppercase entry
in the secret would never match.
```

followed by the comparison. Two forms are available and the person picks one
at the start of the session:

- **Inline diff** (default): a fenced ` ```diff ` block of that hunk only,
  with a few lines of context, so removed and added lines sit together.
- **Side by side**: two fenced blocks, `Before` and `After`, holding the full
  function or block as it was and as it is now. Used when a hunk rewrites a
  block and the line-level diff is hard to read.

In VS Code the skill can also open the real editor diff for the file
(`code --diff <before-tmp> <after-tmp>`) when asked, but the chat walkthrough
is the record.

After each change Claude asks one selectable question: **Accept**, **Question**
(the person types a concern and Claude answers from the code before moving
on), or **Reject** (the whole task will be sent back; the reason is captured
now). Every answer is kept in a running review log.

### 7.2 Flow of a Peer Review session

1. **Find eligible tasks.** `Claude`-labelled tasks in the Todoist **PR**
   section, same as before. Read the comment thread, take the SHA from the
   `Pushed as <sha> to PR #<n>` comment, fetch the diff with
   `gh api repos/<owner>/<repo>/commits/<sha> -H "Accept: application/vnd.github.v3.diff"`.
2. **Claude's own review first.** Before walking the person through anything,
   Claude reads the whole diff against the task's requirements and writes a
   verdict: `READY`, `READY WITH NOTES`, or `NOT READY`, with findings. This is
   Claude's half of the review and is posted later as evidence (see 7.5). Depa's
   `(review)` comment is context only.
3. **Walkthrough.** Changes are ordered by file, then by line. Claude explains
   and shows each one as in 7.1 and records the person's response.
4. **Summary and decision.** A table of every change with the person's
   response, Claude's verdict, and any open questions. Then one selectable
   question: **Approve**, **Approve with follow-up task**, or **Send back**.
5. **Send back** mirrors the old rejection path: draft a
   `**Product Architect:**` comment that quotes the rejected changes by file
   and line and the reasons given, confirm, post it, move the task to
   Hold/Blocked. Impediment Removal (Appendix B) picks it up from there.
6. **Approve** opens the dual gate, described next. The skill never merges
   until both halves of the gate are verifiably satisfied.

### 7.3 Evidence the gate checks

The gate needs machine-checkable proof of three things, all tied to the exact
head SHA so a later push cannot ride on an earlier approval:

| Evidence | Who produces it | Where it lives | How it is checked |
|---|---|---|---|
| Todoist task complete | The person, via the skill (after Yes) | Todoist | `GET /api/v1/tasks/<id>` returns `checked: true` (or the task is in `completed` listings). The task id is taken from the PR body checklist line `- [x] <title> (todoist:<id>)`. |
| Claude's review verdict | The skill, after the walkthrough | A **commit comment** on `<sha>` starting `**Peer Review (Claude):** READY` or `READY WITH NOTES`, containing the findings and the change-by-change table | `gh api repos/.../commits/<sha>/comments` has such a comment for the current head SHA. |
| The person's approval | The person, in GitHub | A PR review with state `APPROVED` whose `commit_id` equals the head SHA. For a PR the person authored themselves (GitHub forbids self-approval), a PR comment `/peer-approved <sha>` from the repo owner | `gh pr view --json reviews,comments` |

The skill posts Claude's comment and completes the Todoist task only after the
person says Yes to each (your standing rule in 7.6 applies). It never
submits the person's GitHub approval for them; that click is the human gate.
The skill then **waits**: it polls the PR until the approval appears, or the
person says they have done it, and re-checks.

### 7.4 The merge itself

When all three pieces of evidence exist for the head SHA, the skill asks one
last selectable question: **Merge now** (`gh pr merge <n> --merge`) or
**Leave it for me to merge in GitHub**. Either way the merge is the event
that pushes to `main` and starts the `deploy-sit` job in `ci.yml`. Nothing
else in the pipeline is triggered by review activity.

If the PR bundles several tasks (one agent branch, one PR, many commits), the
skill reviews one task at a time and offers the merge only when **every**
task tied to that PR is complete, exactly as PO Reviews did. The gate workflow
in 7.5 enforces the same rule.

---

## 7.5 Dual gate: Todoist complete AND peer-reviewed before `main`

### 7.5.1 The constraint

The reference repo is **private on the GitHub Free plan**. That plan has no
branch protection, no rulesets, and no required reviewers on private repos.
So there are two layers of enforcement available, and the choice between them
is the only real decision:

| Layer | What it gives | Cost |
|---|---|---|
| **Visible, not enforced** (Free plan, private) | A status check named `merge-gate` on every PR that is red until both gates pass. The Merge button still works. The skill is the only thing that should press it, and the deploy job double-checks after the fact. | $0, process discipline |
| **Enforced by GitHub** (Pro plan, or public repo) | Branch protection on `main`: require the `merge-gate` status check, require 1 approving review, dismiss stale approvals on new pushes, require approval of the most recent push, include administrators. GitHub refuses the merge otherwise. | GitHub Pro, about $4/month per user, or make the repo public |

Everything below works on both. The upgrade only adds the refusal.

### 7.5.2 Options for the dual gate, from lightest to strictest

**Option A: Skill-only gate.** The Peer Review skill verifies the three
pieces of evidence (7.3) and is the only path that runs `gh pr merge`. No new
workflow. Simplest, but nothing stops a merge from the GitHub UI.
*Use when:* one maintainer, trusts their own habit.

**Option B: Status check gate (recommended on Free).** A new workflow
`merge-gate.yml` (Appendix D) runs on `pull_request` (`opened`, `synchronize`,
`reopened`) and on `issue_comment` / `pull_request_review` events. It reads the
task ids from the PR body, asks Todoist whether each is complete, looks for
Claude's `**Peer Review (Claude):**` commit comment on the head SHA, and looks
for a human `APPROVED` review (or `/peer-approved <sha>` comment) at the head
SHA. It passes only when all three hold for **every** task in the PR. The
check is visible on the PR as `merge-gate`. On Free it is advisory; on Pro it
is required.
*Use when:* you want the state visible in GitHub without touching the deploy
job.

**Option C: Option B plus a deploy backstop.** `deploy-sit` in `ci.yml` gains a
first step that finds the PR merged into this `main` commit
(`gh pr list --search "<sha>" --state merged`), re-runs the same three checks,
and fails the job if any is missing. A merge that bypassed the gate therefore
lands on `main` but **does not deploy**, and the red run plus an auto-filed
issue make it visible. This is the strongest gate available on Free, because
the thing being protected (the deploy) is what refuses.
*Use when:* you want CI/CD itself to be the hard stop, on any plan.
**This is the chosen design for this project.** See 7.5.3.

**Option D: GitHub-enforced.** Upgrade to Pro or go public. Add branch
protection on `main`: required status checks `lint-test-build`, `backend`,
`merge-gate`; require 1 approval; dismiss stale reviews on push; require
review of the latest push; apply to administrators. Keep Option B's workflow
as the check and Option C's backstop for defence in depth. Optionally add a
`CODEOWNERS` file naming the maintainer so the approval must come from them.
*Use when:* you want GitHub to refuse the merge button itself. Listed as an
option; not the chosen design here, on any plan.

**Option E: Merge by automation only.** Grant merge rights to a bot (a GitHub
App or a fine-grained PAT) and remove direct push and merge from humans; the
Peer Review skill asks the bot to merge after the gate passes. Overkill for a
solo project and the Free plan cannot restrict the owner anyway. Listed for
completeness.

**Decision.** This project uses **Option C**: the `merge-gate` status check
on every PR, plus the same three checks run again at the top of `deploy-sit`.
The deploy refusing is the enforcement, so the design does not depend on the
GitHub plan and does not change if the plan changes.

### 7.5.3 Chosen design: Option C in detail

Three pieces, all in the repo, all maintained by the Product Architect.

1. **`merge-gate.yml`** (Appendix D). Runs on PR open, push, edit, review
   submitted or dismissed, and PR comment. Reads the task ids from the PR
   body, asks Todoist whether each is complete, looks for Claude's
   `**Peer Review (Claude):** READY` commit comment on the head SHA, and looks
   for a human approval at the head SHA. Reports one status, `merge-gate`,
   on the PR. Read-only; needs `TODOIST_API_TOKEN` and the default
   `GITHUB_TOKEN`.
2. **Backstop step in `deploy-sit`** (`ci.yml`). First step of the job:
   resolve the merged PR from `GITHUB_SHA`, run the identical three checks,
   and `exit 1` on any miss. The job already refuses to run without the SIT
   secrets; this adds "refuses to run without the gate". The production
   workflow gets the same step, keyed on the `main` commit being promoted.
3. **The Peer Review skill** (Appendix A) is the only path that merges, and it
   checks `gh pr checks <n>` shows `merge-gate` passing before offering the
   merge.

What happens on a bypass: someone presses Merge in the GitHub UI with the
check red. The commit lands on `main`. `lint-test-build` and `backend` run
as usual. `deploy-sit` fails at its first step with a message naming the
missing gate. Nothing reaches SIT or production. The fix is to satisfy the
gate on the merged commit (complete the task, post the review comment, add
the approval on the merged PR) and re-run the job, or revert the merge.

What this does not cover: a direct push to `main` with no PR. The backstop
fails with "No merged PR found" and does not deploy, which is the intended
result, but the commit is still on `main`. Only GitHub branch protection
(Option D) can refuse that push; on this plan it is accepted as a known gap.

### 7.5.4 Linking a PR to its Todoist tasks

The gate must know which tasks a PR carries. Today the worker appends
`- [x] <task title>` to the PR body. Change that line in
`daily-feature-agents.yml` to include the id:

```bash
# in the gh pr create / gh pr edit bodies
printf -- '- [x] %s (todoist:%s)' "$TASK_CONTENT" "$TASK_ID"
```

and update the resume check (`grep -qF -- "- [x] ${TASK_CONTENT}"`) to still
match (it does, since it matches a prefix). For human branches, add the same
`(todoist:<id>)` line to the PR body by hand, or the gate treats the PR as
having no tasks and fails with "no todoist ids in PR body".

### 7.5.5 What "complete" means to Todoist

A completed task is removed from the live `tasks` listing. The gate therefore
fetches the task by id: `GET /api/v1/tasks/<id>` returns `checked: true` (API
v1) for a completed task. If the id returns 404, the gate treats it as
**not complete** and says so, rather than passing by accident. The Peer
Review skill completes the task only after the person confirms, and the
original rule stands: only the Product Architect completes a PR-section task.

### 7.5.6 Self-approval on a solo repo

GitHub does not let a PR author approve their own PR. Agent PRs are authored
by `github-actions[bot]`, so the maintainer can approve them normally. For
the maintainer's own branches the gate accepts a PR comment
`/peer-approved <full-sha>` from the repository owner as the human approval.
The SHA in the comment must equal the head SHA, which gives the same
"stale on new push" property as a dismissed review.

### 7.6 Standing rule for Claude working locally

Scott only grants permission for outward-facing or state-changing actions
(merging PRs, completing Todoist tasks, deploying to a hosted Supabase project,
writing secrets, posting the Claude review comment) when the **current message
names that action**. Prepare the branch, commit, PR, and verification without
asking, then stop. Authorization does not carry from one PR or task to the
next.

### 7.7 Run skills: `run` and `run-sit`

Two project skills let Claude launch the app to see a change working instead
of only reading tests. Claude Code's built-in `run` skill looks for a project
skill first, so these take precedence. Both are manual: say "run the app" or
"run on SIT". Full text in Appendix E and F. Put them in
`.claude/skills/run/SKILL.md` and `.claude/skills/run-sit/SKILL.md` inside the
repo so they travel with it.

| Skill | Backend | Where it runs | Needs |
|---|---|---|---|
| `run` | **Local** Supabase in Docker (API `127.0.0.1:54321`, Studio `:54323`), migrations reset, seed applied ($10,000 signup grant) | Vite dev server on `http://localhost:5173` in the browser | Docker running, `.env.local` pointing at the local stack |
| `run-sit` | **SIT** hosted project `<sit-project-ref>` | Either the Vite dev server with `--mode sit`, or a Debug build installed on the iPad over USB | `.env.sit.local` (untracked), Xcode with a valid signing identity, the iPad plugged in |

Neither skill ever touches production. `run-sit` reads only `.env.sit.local`
and never runs `db push`, `functions deploy`, or `secrets set`; deploying to
SIT is the `deploy-sit` CI job's work, or a named request to the Architect.


---

## 8. Project CI/CD: `ci.yml` and `deploy-production.yml`

These are specific to a pnpm + Vite + Supabase project but the shape is
reusable.

### 8.1 `ci.yml` (push to `main`, PRs to `main`)

Job `lint-test-build` (ubuntu-24.04): pnpm (set up **before** setup-node so the
cache resolves), Node 22, `pnpm install --frozen-lockfile`, `pnpm run lint`,
regenerate the server rules engine and `git diff --exit-code` it (a stale
generated file cannot merge), `pnpm run test`, `pnpm run build`.

Job `backend`: Supabase CLI (`supabase/setup-cli@v3`), `supabase db start`,
`supabase db reset` (migrations reproducible from scratch), run every
`supabase/checks/*.sql` invariant script with `psql -v ON_ERROR_STOP=1`, Deno
`deno check` on every Edge Function found by glob.

Job `deploy-sit`: only on push to `main`, `needs` both jobs above, concurrency
group `deploy-sit` with `cancel-in-progress: false` (serialise, never
interrupt a migration). GitHub keeps only one *pending* run per group and a
newer queued run replaces it, so three fast merges can drop the middle run
and let an older commit deploy last. The job therefore checks out
`ref: main` (the current tip) instead of the run's own SHA and logs both,
so whichever run executes last deploys the newest code and a dropped run
loses nothing. Reads **only** `SIT_SUPABASE_*` secrets and refuses to
run if any is empty. `supabase db push --project-ref "$SIT_REF" --yes` then
`supabase functions deploy <list> --project-ref "$SIT_REF" --yes`. The `--yes`
is required by CLI v3 for non-interactive writes. Auth config
(`supabase config push`) is deliberately **not** automated; it needs SMTP and
Apple values exported from the untracked `.env.sit.local`.

### 8.2 `deploy-production.yml` (manual only)

`workflow_dispatch` with a required `confirm` input. Runs only on `main`.
Reads only `PROD_SUPABASE_*` secrets, refuses if any is missing, refuses unless
`confirm` equals the production project ref exactly (the human checkpoint,
typed rather than clicked; also prevents promoting from a stale tab). Then
`migration list`, `db push`, `functions deploy`. The input is passed via env,
never interpolated into the script.

### 8.3 Promotion path

Local (`db reset` + `pnpm test`) → PR + CI → merge to `main` → `deploy-sit`
automatic → test on a real device → human confirms on the Todoist task or PR
→ dispatch production with the same `main` commit. Migrations are forward-only;
run `supabase migration list` against SIT and production before a production
push and confirm every shipping migration is already on SIT.

### 8.4 Local tooling notes

- Supabase CLI is a devDependency: `pnpm exec supabase ...`. Always pass
  `--project-ref` explicitly; never trust the implicit linked project.
- No local `psql`. Query the local stack with
  `docker exec -i supabase_db_GamesCasino psql -U postgres -d postgres`.
- Before reviewing a migration-bearing agent PR, run `supabase db reset` on
  that branch in a worktree.

---

## 9. Claude Code project memory

Claude keeps per-project memory in
`~/.claude/projects/<project-dir>/memory/`.
`MEMORY.md` is an index of one-line pointers; each memory is its own file with
frontmatter (`name`, `description`, `type: user|feedback|project|reference`).
Current entries: explicit-permission rule, SIT provisioning state, agent-branch
and CI facts, money-rules decisions, iOS signing, Todoist project rename and
local DB access, App Store and AdMob account ids. A new person on a new machine
starts with an empty memory; this document is the seed.

---

## 10. Setup checklist for a new repository

Do these in order. Items marked (H) must be done by a human; Claude's
permission classifier blocks them.

**Todoist**
1. Create a project. Note the exact name.
2. Create sections in this order: Backlog, Task Review, Ready To Work, To Do,
   In Progress, PR, Hold/Blocked. Paste the §3.1 descriptions.
3. Create labels: `Claude`, `Tech`, `Hunter`, `Wrecker`, `Echo`, `Omega` (or
   rename the agents; see §11).
4. (H) Copy the API token from Todoist settings.

**Claude**
5. (H) On a machine logged into Claude Code, run `claude setup-token`; copy it.
6. Copy `~/.claude/skills/peer-review/SKILL.md` and
   `~/.claude/skills/impediment-removal/SKILL.md` (Appendix A, B) to the new
   machine. Edit the project name they search for.

**GitHub**
7. Create the repo. Default branch `main`.
8. (H) Add secrets `CLAUDE_CODE_OAUTH_TOKEN` and `TODOIST_API_TOKEN`.
9. Add repo variable `TODOIST_PROJECT_NAME` = the project name from step 1.
10. Copy `.github/workflows/daily-feature-agents.yml` unchanged except for
    the §11 knobs. Commit to `main` (workflows must be on the default branch
    to be scheduled).
11. Copy `.github/workflows/ci.yml` and adapt the lint/test/build steps to
    the new stack. Keep the `--frozen-lockfile` and generated-file diff
    patterns if they apply.
12. Optional: copy `deploy-production.yml` and the `deploy-sit` job; add the
    `SIT_*` and `PROD_*` secrets (H).
12a. Copy `.github/workflows/merge-gate.yml` (Appendix D). Add the backstop
    step to `deploy-sit` and `deploy-production`, with `pull-requests: read`
    and `issues: read` on those jobs.
12b. In `daily-feature-agents.yml`, change the PR checklist line to
    `- [x] <title> (todoist:<id>)` (section 7.5.4).
12c. Copy `.claude/skills/run/SKILL.md` and `.claude/skills/run-sit/SKILL.md`
    (Appendix E, F); edit ports, device UDID, bundle id and env file names.
13. Add a `CLAUDE.md` at the repo root describing conventions; the worker
    prompt tells agents to follow it.
14. (H) `gh auth login --web` and `gh auth setup-git` locally.

**Smoke test**
15. `gh workflow run daily-feature-agents.yml`; confirm the `setup` job finds
    all sections and the `manager` job logs "0 unhandled blocker(s)", "0
    task(s) awaiting PR review", "0 untagged Ready To Work task(s)".
16. Add one small task to Ready To Work with the `Claude` label and no agent
    label. Run again. Confirm Depa labels and moves it to To Do, a worker
    claims it, pushes to `auto/agent-<Name>`, opens a PR, posts
    `Pushed as <sha>`, and moves it to PR.
17. On the next run confirm Depa posts a `(review)` comment.
18. Add a `BLOCKED: test` comment on a To Do task; confirm the next run moves
    it to Hold/Blocked with a Depa comment and does not move it back.
19. Run `peer-review` locally against the PR-section task, approve in GitHub, confirm `merge-gate` goes green, merge.

---

## 11. Knobs to change when copying the workflow

| Knob | Where in `daily-feature-agents.yml` | Default |
|---|---|---|
| Todoist project name | `TODOIST_PROJECT_NAME` env fallback in `setup` | `SHarper Casino Games` |
| Section names | the six `select(.name == "...")` lookups in `setup` | as §3.1 |
| Agent names | `ALL_AGENTS` in `manager`, the `matrix.include` list in `run-agent`, the assignment prompt text, Todoist labels | Tech, Hunter, Wrecker, Echo, Omega |
| Manager name and prefixes | `DEPA_PREFIX`, prompts | `**Depa Billaba:**` |
| Schedule | `on.schedule.cron` | `23 * * * *` |
| Claude CLI version | two `npm install -g @anthropic-ai/claude-code@...` lines | `2.1.296` |
| Model | `--model` on the four `claude -p` calls (`ask_depa` in `manager`, the worker call in `run-agent`) | `opus` (family alias: latest Opus for the pinned CLI). Use a full id such as `claude-opus-5-5` only to freeze it. |
| Worker tool allowlist | `--allowedTools` on the worker `claude -p` | `Edit,Read,Write,Bash(git *),Bash(pnpm *)` (swap `pnpm` for the project's package manager) |
| Turn and task limits | `--max-turns 30`, `MAX_TASKS=10`, `timeout-minutes: 180` | |
| Package manager setup | the pnpm/Node steps in `run-agent` | pnpm + Node 22 |
| Stall issue title | `STALL_ISSUE_TITLE` | `Daily Feature Agents: Stall Log` |

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `setup` fails "Could not find a project named" | Todoist project renamed | Set repo variable `TODOIST_PROJECT_NAME`. |
| Worker logs `claude exited 1`, no commit, run red | `CLAUDE_CODE_OAUTH_TOKEN` expired | (H) `claude setup-token`, update the secret. |
| Manager red with "Todoist GET ... failed: 401" | `TODOIST_API_TOKEN` revoked | (H) regenerate and update. |
| Task stuck In Progress | Run died mid-task | Next run resumes it on the same branch automatically. Check the Stall Log issue. |
| Push rejected non-fast-forward when a human pushes to `auto/agent-X` | Stale local tracking ref | `git fetch origin 'refs/heads/auto/*:refs/remotes/origin/auto/*'` first. |
| Worker's whole push fails | Commit touched `.github/workflows/` | Revert that file from the commit; make the workflow change by hand. |
| Agent PR shows no CI checks | Pushes by `GITHUB_TOKEN` don't trigger workflows | Human pushes to the branch, or test locally. |
| Workflow runs only a few times a day | GitHub scheduler load | Expected. Use `gh workflow run` when you need a sweep now. |
| Same `BLOCKED:` text repeated | Pre-dedupe behaviour | Fixed; `post_blocked_once` skips identical text. |
| Depa assigned everything at once | By design | Promote to Ready To Work only what should start now. |
| `merge-gate` red: "No (todoist:<id>) markers" | PR body lacks task ids | Add `(todoist:<id>)` to each checklist line; agents do this once 7.5.4 is applied. |
| `merge-gate` red after a new push | Evidence is tied to the head SHA | Re-run Peer Review on the new commit; re-approve. |
| `deploy-sit` fails at "gate" step after a UI merge | Merge bypassed the gate | Satisfy the gate on the merged PR and re-run the job, or revert. |
| `gh` and `git push` both fail locally | gh OAuth token expired | (H) `gh auth login --web`, then `gh auth setup-git`. |

---

---

## Appendix A: `~/.claude/skills/peer-review/SKILL.md`

```markdown
---
name: peer-review
description: Manual-only skill for the Product Architect to peer-review Todoist PR-section tasks change by change (inline before/after code with explanations), then open the dual merge gate (Todoist complete + Claude review comment + human GitHub approval) before any merge to main. Only run when the user explicitly asks to "run Peer Review" or similar — never auto-trigger.
---

# Peer Review

Human-in-the-loop review of every commit a Bad Batch agent (or a person) has
pushed for a Todoist PR-section task. Replaces PO Reviews. Governance: only
the Product Architect marks a PR-section task complete; nothing merges to
main until the dual gate (Todoist complete AND Claude review AND human GitHub
approval, all for the current head SHA) is satisfied. Never act past a
decision point without AskUserQuestion. Never free-text "type yes".

## 0. Session setup
Ask once (AskUserQuestion): display style **Inline diff** (default) or
**Side by side**. Remember it for the session.

## 1. Find eligible items
Todoist project id `<todoist-project-id>` (named "SHarper Casino Games";
the skill text may say "App"). Section **PR** → `find-tasks` with
labels=["Claude"]. For each task, `find-comments` (paginate until `hasMore`
is false) and take the newest `Pushed as <sha> to PR #<n>: <subject>`
comment. No such comment → report it and ask how to proceed; never guess a
SHA.

## 2. Claude's independent review (before the walkthrough)
- Fetch the diff: `gh api repos/<owner>/<repo>/commits/<sha> -H "Accept: application/vnd.github.v3.diff"`.
- Fetch the PR: `gh pr view <n> --json number,headRefOid,body,reviews,comments,author`.
- Read the task title, description, and whole comment thread (prior Depa or
  Product Architect feedback counts as requirements).
- Review the diff yourself, in the foreground, against the requirements:
  correctness, safety (money rules, RLS, secrets), completeness, tests. Do
  not use Depa's `(review)` comment as input; compare to it afterwards.
- Produce a verdict: `READY`, `READY WITH NOTES`, or `NOT READY`, with a
  numbered findings list (file:line, what, why it matters). Hold it; it is
  posted in step 6.

## 3. Walkthrough, one change at a time
Split the diff into hunks, ordered by file then line. For each hunk print:

1. A heading `### Change i of N: <file>:<start>-<end>`.
2. Three short paragraphs: **What it does**, **Why it is here** (tie to the
   task), **Risk** (none / low / medium / high, with the one thing to check).
3. The comparison, per the chosen style:
   - Inline: a fenced `diff` block of this hunk with 3 lines of context.
   - Side by side: fenced `Before` and `After` blocks containing the whole
     enclosing function or block (`git show <sha>^:<file>` and
     `git show <sha>:<file>`, cut to the block).
   - If the person asks, open the editor diff: write both versions to the
     scratchpad and run `code --diff <before> <after>`.
4. AskUserQuestion: **Accept** / **Question** / **Reject**.
   - Question: answer from the code, then re-ask.
   - Reject: record the reason now; continue the walkthrough so the send-back
     comment is complete.

Keep a running log: change, file:line, response, reason.

## 4. Summary and decision
Print a table: change, file, person's response, Claude finding (if any).
State Claude's verdict and how it compares with Depa's comment. Then
AskUserQuestion: **Approve**, **Approve with follow-up task**, **Send back**.

## 5. Send back
Draft a comment prefixed `**Product Architect:**` listing each rejected
change by file:line with the reason given, plus any NOT READY findings. Show
the exact text. AskUserQuestion Yes/No to post it and move the task to
Hold/Blocked. Only after Yes: `add-comments`, then move the task. Impediment
Removal takes it from there. Stop.

## 6. Open the dual gate (only after Approve)
Each item is its own Yes/No AskUserQuestion, in this order:
1. **Post Claude's review** as a commit comment on `<sha>`:
   `gh api repos/<owner>/<repo>/commits/<sha>/comments -f body='**Peer Review (Claude):** READY ...'`
   Body = verdict line, findings, the change table. Never a PR-level review.
2. **Complete the Todoist task** (`complete-tasks`). If "Approve with
   follow-up", first create the follow-up in **Task Review** with the `Claude`
   label and link it in a comment on the original.
3. **Human approval.** Tell the person exactly what to do:
   - PR authored by the bot: open the PR, Review changes → Approve.
   - PR authored by the person: post the PR comment `/peer-approved <head-sha>`.
   Then poll `gh pr view <n> --json reviews,comments,headRefOid` every 30 s
   for up to 10 minutes, or re-check when the person says done. Pass only if
   an APPROVED review's `commit_id`, or the comment's SHA, equals the current
   `headRefOid`.
4. **Check the merge-gate status** if the workflow exists:
   `gh pr checks <n>`; `merge-gate` must be passing. If it is red, show its
   log and stop.

## 7. Last task on the PR?
Find every `Claude` task whose thread references `PR #<n>`. If any is
incomplete, report and stop; the PR stays open. If all are complete,
AskUserQuestion: **Merge now** (`gh pr merge <n> --merge`) or **Leave for me
to merge in GitHub**. Report the final state.

## Rules
- Manual trigger only. Every decision is an AskUserQuestion. No skipped
  checkpoints.
- Never submit a GitHub PR review as the person and never approve a PR
  yourself; Claude's evidence is the commit comment, the person's is their
  own click or comment.
- All evidence is tied to the head SHA. A new push invalidates the review;
  start again at step 2 for the new commit.
- Never touch the `Claude` label.
- Never merge unless the three pieces of evidence exist for the head SHA and
  every task on the PR is complete.
```

## Appendix B: `~/.claude/skills/impediment-removal/SKILL.md`

```markdown
---
name: impediment-removal
description: Manual-only skill for the Product Architect to triage and resolve items in the Todoist "App" project's Hold/Blocked section — escalated either by Depa Billaba (the manager agent) or by the Product Architect's own Peer Review skill. Only run when the user explicitly asks to "run Impediment Removal" or similar — never auto-trigger.
---

# Impediment Removal

Human-in-the-loop workflow for clearing the Todoist Hold/Blocked queue. Items land there from two sources: Depa Billaba's escalation/PR-review sweeps (comments prefixed `**Depa Billaba:**`), and the [[peer-review]] skill rejecting a PR-section task on the Product Architect's own behalf (comments prefixed `**Product Architect:**`). Governance rule: only the Product Architect (the user) may move a task out of Hold/Blocked — this skill is that human checkpoint. Never act autonomously past a decision point; always use the AskUserQuestion tool for approvals, not free-text prompts.

## Steps

### 1. Find eligible items
Search the Todoist "App" project's **Hold/Blocked** section for tasks that carry the `Claude` label only. Use `find-projects` (searchText "App") → `find-sections` (searchText "Hold") → `find-tasks` (sectionId + labels=["Claude"]).

### 2. Gather context and present options
For each eligible task:
- Fetch its full comment thread (`find-comments`, paginate with `cursor` until `hasMore` is false).
- Identify the relevant Bad Batch agent (from the task's agent-name label) and the hold reason, which may come from either source — a `**Depa Billaba:**` comment (her escalation or PR-review sweep) or a `**Product Architect:**` comment (a Peer Review send-back). Treat both as equally authoritative explanations of why the task is held; a task can in principle carry history from both.
- If the hold traces back to a Peer Review send-back, it will have an earlier `Pushed as <sha> to PR #<n>: <message>` comment identifying the exact commit/PR the rejection was about — use that to scope your own context-gathering to the same diff, the same way you would for a Depa hold.
- Gather any additional context needed to evaluate the claim — read the actual code/diff/migration/PR referenced, don't just trust the comment text. Verify claims against the real repo state (e.g. check migration status via Supabase tools, read the diff via `gh api .../commits/<sha>`) before trusting them.
- Determine 2-4 concrete resolution options.
- Summarize in chat: what happened, the finding (verified) and who raised it, the options as a table, and a clear recommendation with reasoning.
- **Use the AskUserQuestion tool** to let the user pick an option (or reject) — do not ask them to type a decision.

### 3. Draft the resolution update
Once an option is approved:
- Draft the additive update — new content appended to the task's **description** — describing the resolution and the concrete task needed to complete it. Never overwrite existing description content.
- Show the user the exact draft text before posting anything.
- **Use the AskUserQuestion tool** with a Yes/No choice to confirm posting the update.
- Only after Yes: apply the update via Todoist tools (update-tasks for description, or note_add-equivalent for a comment, matching Depa's existing conventions — additive, never destructive).

### 4. Release back to the queue
- **Use the AskUserQuestion tool** with a Yes/No choice to confirm moving the task.
- Only after Yes: move the task from Hold/Blocked to **Ready to Work** (Depa Billaba's intake section) in the "App" project.
- Confirm the final state back to the user (section, label, description) once done.

## Rules
- This skill is manual-trigger only — never run it proactively.
- Every decision point uses AskUserQuestion (selectable options), never a free-text "type yes/no" prompt.
- Never skip a checkpoint even if the resolution seems obvious.
- Never touch tasks outside Hold/Blocked, never remove/add labels other than what's explicitly approved, never touch the `Claude` label (Architect-only per governance).
- If a Hold/Blocked task has neither a `**Depa Billaba:**` nor a `**Product Architect:**` comment explaining the hold, say so explicitly and ask the user how to proceed rather than guessing at a resolution.
```

## Appendix C: files to copy from the reference repo

- `.github/workflows/daily-feature-agents.yml` (the agent pipeline, ~1100 lines, heavily commented)
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-production.yml`
- `DEPA_BILLABA_PLAN.md` (design rationale, pattern references, verification plan)
- `.env.example` (shows the client-safe vs secret split for Supabase)
- `.gitignore` (env files, generated native projects, Supabase CLI state)

## Appendix D: `.github/workflows/merge-gate.yml` (Option B / C check)

`TODOIST_API_TOKEN` is already a repo secret. `GITHUB_TOKEN` is enough
for the GitHub reads. The job is read-only.

```yaml
name: Merge gate

# Dual gate for main: every Todoist task listed in the PR body must be
# complete, Claude's peer-review commit comment must exist on the head SHA,
# and a human approval (PR review APPROVED at the head SHA, or a
# "/peer-approved <sha>" comment from the repo owner) must exist. On the
# Free plan this check is advisory; with branch protection it is required.
on:
  pull_request:
    types: [opened, synchronize, reopened, edited]
    branches: [main]
  pull_request_review:
    types: [submitted, dismissed]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: read
  issues: read

jobs:
  merge-gate:
    # issue_comment fires for issues too; only continue for PR comments.
    if: github.event_name != 'issue_comment' || github.event.issue.pull_request
    runs-on: ubuntu-24.04
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      TODOIST_API_TOKEN: ${{ secrets.TODOIST_API_TOKEN }}
      PR_NUMBER: ${{ github.event.pull_request.number || github.event.issue.number }}
      OWNER_LOGIN: ${{ github.repository_owner }}
    steps:
      - name: Evaluate the gate
        run: |
          set -uo pipefail
          FAIL=0
          say() { echo "::notice::$*"; }
          bad() { echo "::error::$*"; FAIL=1; }

          PR=$(gh pr view "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" \
                --json headRefOid,body,author,reviews,comments)
          HEAD=$(echo "$PR" | jq -r .headRefOid)
          BODY=$(echo "$PR" | jq -r .body)
          AUTHOR=$(echo "$PR" | jq -r .author.login)
          say "Head SHA: $HEAD (author: $AUTHOR)"

          # --- Gate 1: every Todoist task in the PR body is complete ---
          IDS=$(echo "$BODY" | grep -oE '\(todoist:[A-Za-z0-9]+\)' | sed -E 's/\(todoist:([A-Za-z0-9]+)\)/\1/' | sort -u)
          if [ -z "$IDS" ]; then
            bad "No (todoist:<id>) markers in the PR body; cannot verify task completion."
          fi
          for ID in $IDS; do
            RESP=$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $TODOIST_API_TOKEN" \
                     "https://api.todoist.com/api/v1/tasks/$ID")
            CODE=$(echo "$RESP" | tail -1); JSON=$(echo "$RESP" | sed '$d')
            if [ "$CODE" != "200" ]; then
              bad "Todoist task $ID: HTTP $CODE (treated as not complete)."; continue
            fi
            DONE=$(echo "$JSON" | jq -r '.checked // .is_completed // false')
            if [ "$DONE" = "true" ]; then say "Todoist task $ID is complete."
            else bad "Todoist task $ID is not complete."; fi
          done

          # --- Gate 2: Claude's peer-review comment on the head commit ---
          CC=$(gh api "repos/$GITHUB_REPOSITORY/commits/$HEAD/comments" \
               --jq '[.[] | select(.body | startswith("**Peer Review (Claude):** READY"))] | length')
          if [ "${CC:-0}" -ge 1 ]; then say "Claude peer-review comment found on $HEAD."
          else bad "No '**Peer Review (Claude):** READY...' commit comment on $HEAD."; fi

          # --- Gate 3: human approval at the head SHA ---
          APPROVED=$(echo "$PR" | jq -r --arg h "$HEAD" \
            '[.reviews[] | select(.state == "APPROVED" and .commit.oid == $h and .author.login != "github-actions")] | length')
          CMD=$(echo "$PR" | jq -r --arg h "$HEAD" --arg o "$OWNER_LOGIN" \
            '[.comments[] | select(.author.login == $o and (.body | test("^/peer-approved " + $h)))] | length')
          if [ "${APPROVED:-0}" -ge 1 ]; then say "Human APPROVED review at $HEAD."
          elif [ "${CMD:-0}" -ge 1 ]; then say "Owner /peer-approved comment for $HEAD."
          else bad "No human approval at $HEAD (APPROVED review, or '/peer-approved $HEAD' comment from $OWNER_LOGIN)."; fi

          [ "$FAIL" -eq 0 ] && say "merge-gate: all three gates satisfied." || exit 1
```

**Backstop (part of the chosen Option C).** Copy the step above into
`ci.yml`'s `deploy-sit` job as its first step, and into
`deploy-production.yml` after the confirmation check, with the PR number
resolved from the commit being deployed:

```bash
PR_NUMBER=$(gh pr list --repo "$GITHUB_REPOSITORY" --state merged \
  --search "$GITHUB_SHA" --json number --jq '.[0].number')
[ -n "$PR_NUMBER" ] || { echo "::error::No merged PR found for $GITHUB_SHA"; exit 1; }
```

and give those jobs `pull-requests: read` and `issues: read` permissions. A
merge that bypassed the gate then fails the deploy instead of deploying.

For reference only, Option D's GitHub settings would be: Settings → Branches
→ Add rule for `main`: require status checks `lint-test-build`, `backend`,
`merge-gate`; require 1 approving review; dismiss stale approvals; require
approval of the most recent push; include administrators. Not part of the
chosen design.

## Appendix E: `.claude/skills/run/SKILL.md` (local stack)

```markdown
---
name: run
description: Launch Games Casino locally against the Docker Supabase stack so a change can be seen working in the browser. Use when asked to run, start, preview, or screenshot the app locally, or to confirm a change works in the real app rather than only in tests. Never touches SIT or production.
---

# Run (local)

Starts the local Supabase stack, resets the database to the committed
migrations plus seed, serves the Edge Functions, and starts the Vite dev
server. Everything stays on 127.0.0.1.

## Preconditions
- Docker Desktop is running (`docker info` succeeds). If not, stop and say so.
- `.env.local` exists with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the
  local anon key printed by `supabase start`. If missing, create it from
  `.env.example` after `supabase start` prints the values.
- Dependencies installed: `pnpm install --frozen-lockfile`.

## Steps
1. `pnpm exec supabase start` (first run pulls images; takes minutes).
   Output includes the API URL, anon key, and Studio URL.
2. `pnpm exec supabase db reset` to apply `supabase/migrations/*` and
   `supabase/seed.sql`. Do this whenever the branch has new migrations.
3. If the change touched an Edge Function, run
   `pnpm exec supabase functions serve` in the background (hot reload on
   `:54321/functions/v1/<name>`). Secrets for local functions come from
   `supabase/functions/.env` (untracked); copy the names from `.env.example`.
4. If the change touched `src/games/liability-rummy/logic/*`, run
   `pnpm run build:engine` first so the server's engine matches.
5. `pnpm dev` in the background. The app is at `http://localhost:5173`.
6. Open the URL in the built-in browser or Chrome tools if available,
   exercise the change, and screenshot it. Otherwise report the URL and the
   exact steps for the person to try.
7. For a quick sanity check without the browser: `pnpm lint`, `pnpm test`,
   `pnpm build`.

## Querying the local database
`psql` is not installed. Use
`docker exec -i supabase_db_GamesCasino psql -U postgres -d postgres -c "<sql>"`.
Useful views: `app.wallet_balances`, `app.replay_validation_report`,
`app.log_storage_report`.

## Stopping
`pnpm exec supabase stop` tears the stack down. Leave it running between
sessions if iterating; `db reset` is the thing to repeat.

## Rules
- Local only. Never pass `--project-ref`. Never run `db push`,
  `functions deploy`, `secrets set`, or `config push` from this skill.
- Reset back to `main`'s migrations (`git checkout main && supabase db reset`)
  after reviewing a branch with migrations, or say that it was left on the
  branch state.
```

## Appendix F: `.claude/skills/run-sit/SKILL.md` (staging on a real device)

```markdown
---
name: run-sit
description: Build Games Casino against the SIT (staging) Supabase project and run it either in the browser with --mode sit or as a Debug build on the Product Architect's iPad, so device-only flows (magic link, StoreKit sandbox, AdMob test ads) can be exercised. Read-only against SIT; never deploys backend changes and never touches production.
---

# Run on SIT

SIT is the hosted staging project (`<sit-project-ref>`, us-east-2). The
client is pointed at it with Vite's `--mode sit`, which reads the untracked
`.env.sit.local` (only `VITE_*` values reach the bundle). The backend on SIT
is whatever the `deploy-sit` CI job last pushed from `main`; this skill does
not change it.

## Preconditions
- `.env.sit.local` exists with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (a publishable key) and `VITE_FEATURE_APPLE_SIGNIN`. If missing, stop and
  ask; never copy values from production.
- If the change needs a migration or Edge Function that is not yet on SIT,
  say so: the client will hit the old backend until the PR merges and
  `deploy-sit` runs. Do not deploy from here.

## Mode 1: browser against SIT
1. `pnpm dev --mode sit`. App at `http://localhost:5173`, talking to SIT.
   The Vite dev origin is in SIT's `ALLOWED_ORIGINS`, so Edge Function calls
   work from the browser.
2. Magic-link sign-in is PKCE and same-device: request the link in this
   browser and open it in this browser. Apple Sign-In is off on SIT.
3. Report what was exercised and the `request_id` from any failing call.

## Mode 2: iPad over USB (verified path)
Device: Scott's iPad, UDID `<device-udid>`, team `<apple-team-id>`,
bundle id `com.GamesCasino.app`. Run signing steps with the sandbox disabled
(keychain access).

1. Build the web bundle for SIT and sync native:
   `pnpm exec tsc -b && pnpm exec vite build --mode sit && pnpm cap:sync`
   (`cap:sync` also applies entitlements, orientation, and the app icon).
2. If `ios/` does not exist: `npx cap add ios` first, then repeat step 1.
3. Build for the device:
   `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -destination 'id=<device-udid>' -allowProvisioningUpdates build`
4. Install and launch:
   `xcrun devicectl device install app --device <device-udid> <path to App.app from the build log>`
   `xcrun devicectl device process launch --device <device-udid> com.GamesCasino.app`
5. Tell the person what to try on the device (StoreKit sandbox purchase,
   magic link opened on the iPad itself, rewarded ad with Google test ids).

### Signing failure `errSecInternalComponent`
The Mac is missing the Apple WWDR **G3** intermediate, not a bad developer
cert. Check with
`security find-certificate -a -c "Apple Worldwide Developer Relations" -Z`;
fix with `curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer`
and `security import AppleWWDRCAG3.cer -k ~/Library/Keychains/login.keychain-db`.
Never delete keychain identities; that is the Architect's call.

## Rules
- SIT only, client only. Never run `db push`, `functions deploy`,
  `secrets set`, or `config push` from this skill; those are named requests
  to the Architect or the `deploy-sit` job.
- Never build with `.env.local` for a device: 127.0.0.1 is unreachable from
  the iPad and the app silently falls back to local play.
- Never point `--mode` at a production env file.
```
