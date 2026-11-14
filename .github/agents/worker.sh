#!/usr/bin/env bash
# One worker agent. Takes its tasks from Todoist in board order, implements each on its own long-lived
# branch (auto/agent-<Name>) with one Claude Code session and one commit per task, pushes, keeps one
# open PR, and hands the task to the PR section.
#
#   worker.sh --peek   prints has_work=true|false (to $GITHUB_OUTPUT) and exits; nothing is changed
#   worker.sh          works the queue, up to MAX_TASKS tasks
#
# A worker's only Todoist writes are moving its own current task between To Do, In Progress and PR, and
# commenting on it. It never creates, labels or clones tasks (handoff doc §6.3).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
. "$HERE/config.sh"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

: "${AGENT:?}" "${PROJECT_ID:?}" "${SEC_TODO:?}" "${SEC_IN_PROGRESS:?}" "${SEC_PR:?}"
REPO="${GITHUB_REPOSITORY:?}"
BRANCH="auto/agent-$AGENT"
RED=0

is_agent "$AGENT" || { echo "::error::\"$AGENT\" is not one of the agents ($ALL_AGENTS)" >&2; exit 1; }

# Tasks in a section that carry both the master label and this agent's label, in board order.
my_tasks() {
  td_tasks "$1" | jq -c --arg a "$AGENT" '[.[] | select((.labels // []) | index($a))]'
}

if [ "${1:-}" = "--peek" ]; then
  doing=$(my_tasks "$SEC_IN_PROGRESS") || exit 1
  todo=$(my_tasks "$SEC_TODO") || exit 1
  n=$(jq -n --argjson a "$doing" --argjson b "$todo" '($a | length) + ($b | length)')
  log "$AGENT: $n task(s) waiting"
  if [ "$n" -gt 0 ]; then echo "has_work=true"; else echo "has_work=false"; fi >>"${GITHUB_OUTPUT:-/dev/stdout}"
  exit 0
fi

# ---------------------------------------------------------------- helpers

# An identical blocker is never posted twice.
post_blocked_once() { # <task id> <text starting with BLOCKED:>
  local existing
  existing=$(td_comments "$1" | jq -r --arg c "$2" '[.[] | select(.content == $c)] | length')
  if [ "${existing:-0}" = "0" ]; then td_comment "$1" "$2"; fi
}

retry3() {
  local i
  for i in 1 2 3; do
    "$@" && return 0
    log "attempt $i failed: $*"
    sleep $((i * 5))
  done
  return 1
}

open_pr() { # prints {number, body} for this agent's open PR, or nothing
  gh pr list --repo "$REPO" --head "$BRANCH" --state open --json number,body --jq '.[0] // empty'
}

# Check out this agent's branch. If it is ahead of main it carries unmerged work: reuse it and bring main
# in. Otherwise start fresh from main. Returns 1 on a merge conflict.
prepare_branch() {
  git fetch -q --prune origin "+refs/heads/$BASE_BRANCH:refs/remotes/origin/$BASE_BRANCH" \
    "+refs/heads/auto/*:refs/remotes/origin/auto/*" || { fail "git fetch failed"; return 2; }
  git reset -q --hard
  git clean -fdq
  if git rev-parse -q --verify "refs/remotes/origin/$BRANCH" >/dev/null &&
    [ "$(git rev-list --count "origin/$BASE_BRANCH..origin/$BRANCH")" -gt 0 ]; then
    git checkout -q -B "$BRANCH" "origin/$BRANCH" || return 2
    if ! git merge -q --no-edit "origin/$BASE_BRANCH" >/dev/null 2>&1; then
      git merge --abort >/dev/null 2>&1
      return 1
    fi
  else
    git checkout -q -B "$BRANCH" "origin/$BASE_BRANCH" || return 2
  fi
}

# The standing GitHub issue where stalled runs are logged.
stall_log() { # <text>
  local n
  n=$(gh issue list --repo "$REPO" --state open --limit 100 --json number,title \
    --jq ".[] | select(.title == \"$STALL_ISSUE_TITLE\") | .number" | head -1)
  if [ -n "$n" ]; then
    gh issue comment "$n" --repo "$REPO" --body "$1" >/dev/null
  else
    gh issue create --repo "$REPO" --title "$STALL_ISSUE_TITLE" --body "$1" >/dev/null
  fi
}

build_prompt() { # <task json> <comments json>
  cat <<PROMPT
SWEEP: worker
You are $AGENT, one of a team of coding agents working on this repository. Implement the task below on
the branch that is already checked out ($BRANCH).

Rules:
- Read CLAUDE.md first and follow it. It says where code goes and what each layer may import.
- Make the change, then run: pnpm lint && pnpm test && pnpm build. All three must pass.
- Commit your work yourself, as exactly one commit, with an imperative subject that starts with the
  story id when the task has one. Do not push; the pipeline pushes.
- Never edit anything under .github/. If the task needs that, stop and report it as blocked.
- Stay inside the task. If you find an unrelated problem, mention it in your final message; don't fix it.
- If you cannot finish — the task is unclear, contradicts the code, or needs a decision — make no commit
  and end your final message with a line starting "BLOCKED:" that says exactly what you need.

Task: $(jq -r '.content' <<<"$1")

Description:
$(jq -r '.description // ""' <<<"$1")

Thread on the task (earlier review feedback counts as requirements):
$(jq -r '.[] | "- " + .content' <<<"$2")
PROMPT
}

git config user.name "$AGENT (Claude Agent)"
git config user.email "agent-$(tr '[:upper:]' '[:lower:]' <<<"$AGENT")@users.noreply.github.com"

# ---------------------------------------------------------------- the queue

SEEN=" "
for ((round = 1; round <= MAX_TASKS; round++)); do
  # A task left In Progress by a run that died is resumed before anything new is claimed.
  resumed=0
  task=$(my_tasks "$SEC_IN_PROGRESS" | jq -c '.[0] // empty') || break
  if [ -n "$task" ]; then
    resumed=1
  else
    task=$(my_tasks "$SEC_TODO" | jq -c '.[0] // empty') || break
  fi
  if [ -z "$task" ]; then
    log "$AGENT: queue empty"
    break
  fi
  id=$(jq -r '.id' <<<"$task")
  title=$(jq -r '.content' <<<"$task")

  # The queue is in dependency order: meeting the same task twice means it can't progress, and skipping
  # past it would be wrong. End the run.
  if [[ "$SEEN" == *" $id "* ]]; then
    log "$AGENT: task $id came round again; ending the run"
    break
  fi
  SEEN="$SEEN$id "
  log "$AGENT: task $id — $title$([ "$resumed" = 1 ] && echo ' (resumed)')"

  if [ "$resumed" = 0 ]; then td_move "$id" "$SEC_IN_PROGRESS" || break; fi

  prepare_branch
  rc=$?
  if [ "$rc" = 1 ]; then
    td_move "$id" "$SEC_TODO"
    post_blocked_once "$id" "BLOCKED: $BRANCH no longer merges cleanly with $BASE_BRANCH. Resolve the conflict on the branch (or merge or close its PR) before $AGENT can continue."
    break
  elif [ "$rc" != 0 ]; then
    td_move "$id" "$SEC_TODO"
    RED=1
    break
  fi

  pr=$(open_pr)
  # Crash recovery: the work was pushed and listed on the PR, but the task never left In Progress.
  if [ "$resumed" = 1 ] && [ -n "$pr" ] && jq -r '.body // ""' <<<"$pr" | grep -qF -- "- [x] ${title}"; then
    log "$AGENT: task $id is already on PR #$(jq -r '.number' <<<"$pr"); moving it to PR"
    td_move "$id" "$SEC_PR"
    continue
  fi

  if ! pnpm install --frozen-lockfile >/dev/null 2>&1; then
    td_move "$id" "$SEC_TODO"
    post_blocked_once "$id" "BLOCKED: pnpm install --frozen-lockfile fails on $BRANCH; the lockfile and package.json disagree."
    break
  fi

  comments=$(td_comments "$id") || break
  before=$(git rev-parse HEAD)
  out_file=$(mktemp)
  claude -p "$(build_prompt "$task" "$comments")" --model "$CLAUDE_MODEL" \
    --allowedTools "$WORKER_ALLOWED_TOOLS" --max-turns "$WORKER_MAX_TURNS" --output-format json >"$out_file"
  claude_rc=$?
  result=$(jq -r '.result // empty' <"$out_file" 2>/dev/null || true)
  after=$(git rev-parse HEAD)

  if [ "$before" = "$after" ]; then
    # No commit: whatever is in the working tree is abandoned and the task goes back to the queue.
    git reset -q --hard
    git clean -fdq
    td_move "$id" "$SEC_TODO"
    if [ "$claude_rc" -ne 0 ]; then
      post_blocked_once "$id" "BLOCKED: $AGENT's run failed before it could commit (claude exited $claude_rc). See the run log and the \"$STALL_ISSUE_TITLE\" issue."
      stall_log "**$AGENT** stalled on task $id (\"$title\"): claude exited $claude_rc with no commit. Run: ${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:-unknown}"
      echo "::error::$AGENT: claude exited $claude_rc on task $id" >&2
      RED=1
      break
    fi
    blocked=$(awk '/^BLOCKED:/ {found = 1; text = ""} found {text = text $0 "\n"} END {printf "%s", text}' <<<"$result")
    if [ -n "$blocked" ]; then post_blocked_once "$id" "$blocked"; fi
    continue
  fi

  # Agents may not change the pipeline. The token can't push workflow edits anyway; catching it here
  # keeps the rest of the branch pushable.
  if git diff --name-only "$before" HEAD | grep -qE '^\.github/'; then
    git reset -q --hard "$before"
    git clean -fdq
    td_move "$id" "$SEC_TODO"
    post_blocked_once "$id" "BLOCKED: the change edited files under .github/, which agents may not touch. A person has to make that part of the change."
    continue
  fi

  # One commit per task: if the session made several, fold them into the first one's message.
  if [ "$(git rev-list --count "$before..HEAD")" -gt 1 ]; then
    first_msg=$(git log --reverse --format=%B "$before..HEAD" | head -1)
    git reset -q --soft "$before" && git commit -q -m "$first_msg"
  fi
  sha=$(git rev-parse HEAD)
  subject=$(git log -1 --format=%s)

  if ! retry3 git push -q origin "HEAD:refs/heads/$BRANCH"; then
    td_comment "$id" "BLOCKED: $AGENT committed $sha but could not push $BRANCH. The task stays In Progress and the next run resumes it."
    echo "::error::$AGENT: push of $BRANCH failed" >&2
    RED=1
    break
  fi

  # One PR per agent branch; each task adds a checklist line carrying its Todoist id for the merge gate.
  line="- [x] ${title} (todoist:${id})"
  pr=$(open_pr)
  if [ -n "$pr" ]; then
    pr_number=$(jq -r '.number' <<<"$pr")
    retry3 gh pr edit "$pr_number" --repo "$REPO" --body "$(jq -r '.body // ""' <<<"$pr")
$line" >/dev/null || pr_number=""
  else
    retry3 gh pr create --repo "$REPO" --base "$BASE_BRANCH" --head "$BRANCH" --title "$AGENT's work queue" \
      --body "Work pushed by $AGENT, one commit per task. Only the Product Architect merges, and only after the task is complete in Todoist.

$line" >/dev/null
    pr_number=$(open_pr | jq -r '.number // empty')
  fi
  if [ -z "$pr_number" ]; then
    td_comment "$id" "BLOCKED: $AGENT pushed $sha to $BRANCH but could not open or update the PR. The task stays In Progress and the next run resumes it."
    echo "::error::$AGENT: PR create/update failed for $BRANCH" >&2
    RED=1
    break
  fi

  td_comment "$id" "Pushed as $sha to PR #$pr_number: $subject" && td_move "$id" "$SEC_PR"
  log "$AGENT: task $id pushed as ${sha:0:9} to PR #$pr_number"
done

if [ "$RED" -ne 0 ] || [ "$(hard_fail_count)" -gt 0 ]; then
  echo "::error::$AGENT finished with a failure." >&2
  exit 1
fi
log "$AGENT finished cleanly."
