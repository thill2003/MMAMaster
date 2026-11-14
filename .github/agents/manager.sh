#!/usr/bin/env bash
# The manager agent. She never touches code: three sweeps over the Todoist board, each decision made by
# one single-turn, tool-less Claude call and checked by this script before anything is written.
#
#   1. Escalation  — To Do / In Progress tasks with a BLOCKED: comment newer than her last word.
#   2. PR review   — PR tasks whose latest "Pushed as <sha>" is newer than her last (review).
#   3. Assignment  — Ready To Work tasks: tagged ones go to To Do; untagged ones are routed.
#
# Governance (handoff doc §6.3), enforced here in bash, not left to a prompt:
#   - a decision is acted on only if its task id is in the real candidate set, its decision is in the
#     fixed enum, and its agent is in the fixed list;
#   - she never moves a task out of Hold/Blocked and never touches the master label;
#   - she never does nothing silently: every candidate gets a comment, except "no fit", which keeps one
#     comment with a count bumped in place.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
. "$HERE/config.sh"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

: "${PROJECT_ID:?}" "${SEC_TASK_REVIEW:?}" "${SEC_READY:?}" "${SEC_TODO:?}" "${SEC_IN_PROGRESS:?}" "${SEC_PR:?}" "${SEC_HOLD:?}"
REPO="${GITHUB_REPOSITORY:?}"

RULES="Reply with JSON only — no prose, no code fence."

# ---------------------------------------------------------------- 1. escalation

sweep_escalation() {
  local todo doing tasks task id title comments blocked reply json decision comment n=0
  todo=$(td_tasks "$SEC_TODO") || return
  doing=$(td_tasks "$SEC_IN_PROGRESS") || return
  tasks=$(jq -c -n --argjson a "$todo" --argjson b "$doing" '$a + $b')
  while read -r task; do
    [ -n "$task" ] || continue
    id=$(jq -r '.id' <<<"$task")
    title=$(jq -r '.content' <<<"$task")
    comments=$(td_comments "$id") || continue
    # The newest BLOCKED: comment, if it is newer than anything she has already said on this task.
    blocked=$(jq -r --arg p "$MANAGER_PREFIX" '
      ([.[] | select(.content | startswith($p)) | .posted_at] | max // "") as $last
      | [.[] | select((.content | startswith("BLOCKED:")) and (.posted_at > $last))] | last | .content // empty' <<<"$comments")
    [ -n "$blocked" ] || continue
    n=$((n + 1))

    reply=$(ask_manager "SWEEP: escalation
You are $MANAGER_NAME, the manager of a team of coding agents. A worker has raised a blocker on its task.
Decide what happens next.

Task: $title
Description:
$(jq -r '.description // ""' <<<"$task")

The worker's blocker:
$blocked

Earlier thread:
$(jq -r '.[] | "- " + .content' <<<"$comments")

Choose one:
- \"block\": a person has to decide or act. The task moves to Hold/Blocked.
- \"task-review\": the blocker is really a separate piece of work. A new task is created for the Product
  Architect to review; this task stays where it is.
- \"acknowledge\": the worker can carry on; answer the question in your comment.

$RULES
{\"decision\": \"block\" | \"task-review\" | \"acknowledge\", \"comment\": \"what you are telling the team, two or three sentences\", \"title\": \"title of the new task, only for task-review\", \"description\": \"its description, only for task-review\"}") || continue

    json=$(extract_json <<<"$reply") || { fail "Escalation for task $id: the reply was not JSON"; continue; }
    decision=$(jq -r '.decision // empty' <<<"$json")
    comment=$(jq -r '.comment // empty' <<<"$json")
    [ -n "$comment" ] || { fail "Escalation for task $id: no comment in the reply"; continue; }
    case "$decision" in
      block)
        td_comment "$id" "$MANAGER_PREFIX $comment" && td_move "$id" "$SEC_HOLD" && log "task $id → Hold/Blocked"
        ;;
      task-review)
        local new_title new_desc new_id
        new_title=$(jq -r '.title // empty' <<<"$json")
        new_desc=$(jq -r '.description // ""' <<<"$json")
        [ -n "$new_title" ] || { fail "Escalation for task $id: task-review without a title"; continue; }
        new_id=$(td_add_task "$SEC_TASK_REVIEW" "$new_title" "$new_desc

Raised from task $id (\"$title\")." "$(jq -nc --arg m "$MASTER_LABEL" '[$m]')") || continue
        td_comment "$id" "$MANAGER_PREFIX $comment

Follow-up for review: https://app.todoist.com/app/task/$new_id" && log "task $id → follow-up $new_id in Task Review"
        ;;
      acknowledge)
        td_comment "$id" "$MANAGER_PREFIX $comment" && log "task $id acknowledged"
        ;;
      *)
        fail "Escalation for task $id: decision \"$decision\" is not one of block, task-review, acknowledge"
        ;;
    esac
  done < <(jq -c '.[]' <<<"$tasks")
  log "$n unhandled blocker(s)"
}

# ---------------------------------------------------------------- 2. PR review

sweep_pr_review() {
  local tasks task id title comments pushed sha pr diff reply json decision review n=0
  tasks=$(td_tasks "$SEC_PR") || return
  while read -r task; do
    [ -n "$task" ] || continue
    id=$(jq -r '.id' <<<"$task")
    title=$(jq -r '.content' <<<"$task")
    comments=$(td_comments "$id") || continue
    # The newest push, if she has not reviewed it yet.
    pushed=$(jq -r --arg p "$MANAGER_PREFIX (review)" '
      ([.[] | select(.content | startswith($p)) | .posted_at] | max // "") as $last
      | [.[] | select((.content | startswith("Pushed as ")) and (.posted_at > $last))] | last | .content // empty' <<<"$comments")
    [ -n "$pushed" ] || continue
    sha=$(sed -nE 's/^Pushed as ([0-9a-f]{7,40}) to PR #([0-9]+).*/\1/p' <<<"$pushed" | head -1)
    pr=$(sed -nE 's/^Pushed as ([0-9a-f]{7,40}) to PR #([0-9]+).*/\2/p' <<<"$pushed" | head -1)
    if [ -z "$sha" ]; then
      fail "PR review for task $id: could not read a SHA from \"$pushed\""
      continue
    fi
    n=$((n + 1))
    if ! diff=$(gh api "repos/$REPO/commits/$sha" -H "Accept: application/vnd.github.v3.diff"); then
      fail "PR review for task $id: could not fetch the diff of $sha"
      continue
    fi
    if [ "${#diff}" -gt "$REVIEW_DIFF_LIMIT" ]; then
      diff="${diff:0:$REVIEW_DIFF_LIMIT}
[diff cut at $REVIEW_DIFF_LIMIT characters]"
    fi

    reply=$(ask_manager "SWEEP: review
You are $MANAGER_NAME, the manager of a team of coding agents. Review one commit a worker pushed for a task.
You are the only automated check before a person reviews it. Judge it against the task: is it correct,
complete, tested, and inside the task's scope? The project's rules are in CLAUDE.md — layers may only
import downward, core/ stays pure, tuning is data in src/content.

Task: $title
Description:
$(jq -r '.description // ""' <<<"$task")

Thread so far:
$(jq -r '.[] | "- " + .content' <<<"$comments")

Commit $sha (PR #$pr):
$diff

Choose one:
- \"ok\": fit for a person to review.
- \"hold\": something must be fixed or decided first. The task moves to Hold/Blocked.

$RULES
{\"decision\": \"ok\" | \"hold\", \"review\": \"your review: what the commit does, what you checked, and any finding with its file and line\"}") || continue

    json=$(extract_json <<<"$reply") || { fail "PR review for task $id: the reply was not JSON"; continue; }
    decision=$(jq -r '.decision // empty' <<<"$json")
    review=$(jq -r '.review // empty' <<<"$json")
    [ -n "$review" ] || { fail "PR review for task $id: no review text in the reply"; continue; }
    case "$decision" in
      ok)
        td_comment "$id" "$MANAGER_PREFIX (review) $sha — OK. $review" && log "task $id reviewed: ok"
        ;;
      hold)
        td_comment "$id" "$MANAGER_PREFIX (review) $sha — HOLD. $review" && td_move "$id" "$SEC_HOLD" && log "task $id reviewed: hold"
        ;;
      *)
        fail "PR review for task $id: decision \"$decision\" is not one of ok, hold"
        ;;
    esac
  done < <(jq -c '.[]' <<<"$tasks")
  log "$n task(s) awaiting PR review"
}

# ---------------------------------------------------------------- 3. assignment

sweep_assignment() {
  local tasks task id labels agent untagged="[]" count prs reply json item decision reason note
  tasks=$(td_tasks "$SEC_READY") || return

  # Already tagged with a worker: straight to To Do.
  while read -r task; do
    [ -n "$task" ] || continue
    id=$(jq -r '.id' <<<"$task")
    agent=""
    for a in $ALL_AGENTS; do
      if jq -e --arg a "$a" '(.labels // []) | index($a)' <<<"$task" >/dev/null; then
        agent="$a"
        break
      fi
    done
    if [ -n "$agent" ]; then
      td_comment "$id" "$MANAGER_PREFIX already tagged for $agent; moved to To Do." && td_move "$id" "$SEC_TODO" && log "task $id → To Do ($agent, pre-tagged)"
    else
      untagged=$(jq -c --argjson t "$task" '. + [$t]' <<<"$untagged")
    fi
  done < <(jq -c '.[]' <<<"$tasks")

  count=$(jq 'length' <<<"$untagged")
  log "$count untagged Ready To Work task(s)"
  [ "$count" -gt 0 ] || return 0

  # One call for the whole batch, with what each worker already has open as context.
  prs=$(gh pr list --repo "$REPO" --state open --limit 50 --json number,title,headRefName,body \
    --jq '[.[] | select(.headRefName | startswith("auto/agent-")) | {number, branch: .headRefName, body}]') || prs="[]"

  reply=$(ask_manager "SWEEP: assignment
You are $MANAGER_NAME, the manager of a team of coding agents: $ALL_AGENTS. Each works alone on its own
branch and takes tasks in order. Route every task below.

Spread the work so no one agent queues up while others sit idle, and give tasks that touch the same code
to the same agent so their branches don't collide.

Tasks to route:
$(jq -c '[.[] | {id, title: .content, description: (.description // "")}]' <<<"$untagged")

What each agent already has open:
$prs

For each task choose one:
- \"assign\": give it to one agent.
- \"hold\": it is not ready to build — unclear, contradictory, or needs a decision from a person. It moves to
  Hold/Blocked.
- \"no-fit\": it is clear, but should not start yet (it depends on work that is not merged). It stays where
  it is and is looked at again next time.

$RULES
[{\"id\": \"<task id>\", \"decision\": \"assign\" | \"hold\" | \"no-fit\", \"agent\": \"<one of: $ALL_AGENTS>\", \"reason\": \"one sentence\"}]") || return

  json=$(extract_json <<<"$reply") || { fail "Assignment: the reply was not JSON"; return; }
  if [ "$(jq -r 'type' <<<"$json")" != "array" ]; then
    fail "Assignment: the reply was not a JSON array"
    return
  fi

  while read -r task; do
    id=$(jq -r '.id' <<<"$task")
    # Only a decision about a task that is really in the candidate set is ever acted on.
    item=$(jq -c --arg id "$id" '[.[] | select((.id | tostring) == $id)][0] // empty' <<<"$json")
    if [ -z "$item" ]; then
      fail "Assignment: no decision came back for task $id"
      continue
    fi
    decision=$(jq -r '.decision // empty' <<<"$item")
    agent=$(jq -r '.agent // empty' <<<"$item")
    reason=$(jq -r '.reason // "no reason given"' <<<"$item")
    case "$decision" in
      assign)
        if ! is_agent "$agent"; then
          fail "Assignment for task $id: \"$agent\" is not one of the agents ($ALL_AGENTS)"
          continue
        fi
        # Additive: the agent's label joins whatever the task already carries.
        labels=$(jq -c --arg a "$agent" '((.labels // []) + [$a]) | unique' <<<"$task")
        td_set_labels "$id" "$labels" && td_comment "$id" "$MANAGER_PREFIX assigned to $agent. $reason" && td_move "$id" "$SEC_TODO" && log "task $id → To Do ($agent)"
        ;;
      hold)
        td_comment "$id" "$MANAGER_PREFIX held: $reason" && td_move "$id" "$SEC_HOLD" && log "task $id → Hold/Blocked"
        ;;
      no-fit)
        # One comment per task, with its count bumped in place each sweep the task stays unmatched.
        note=$(td_comments "$id" | jq -c --arg p "$MANAGER_PREFIX (no fit):" '[.[] | select(.content | startswith($p))] | last // empty')
        if [ -n "$note" ]; then
          local prev
          prev=$(jq -r '.content' <<<"$note" | sed -nE 's/.*\[count: ([0-9]+)\].*/\1/p' | tail -1)
          td_comment_update "$(jq -r '.id' <<<"$note")" "$MANAGER_PREFIX (no fit): $reason [count: $((${prev:-1} + 1))]" && log "task $id: no fit, count $((${prev:-1} + 1))"
        else
          td_comment "$id" "$MANAGER_PREFIX (no fit): $reason [count: 1]" && log "task $id: no fit, count 1"
        fi
        ;;
      *)
        fail "Assignment for task $id: decision \"$decision\" is not one of assign, hold, no-fit"
        ;;
    esac
  done < <(jq -c '.[]' <<<"$untagged")

  # A decision about a task that was never offered is a sign the model went off the rails.
  local strays
  strays=$(jq -r --argjson c "$untagged" '[.[] | (.id | tostring)] - [$c[] | (.id | tostring)] | join(", ")' <<<"$json")
  [ -z "$strays" ] || fail "Assignment: ignored decisions for tasks that were not candidates: $strays"
}

sweep_escalation
sweep_pr_review
sweep_assignment

if [ "$(hard_fail_count)" -gt 0 ]; then
  echo "::error::$MANAGER_NAME finished with $(hard_fail_count) hard failure(s)." >&2
  exit 1
fi
log "$MANAGER_NAME finished cleanly."
