#!/usr/bin/env bash
# shellcheck shell=bash
# Shared helpers: logging, the Todoist API v1 (reads over REST, writes over /sync), and Claude calls.
# State lives only in Todoist and in git/GitHub; nothing here keeps any between runs.

# Hard failures are recorded in a file, not a variable: most helpers run inside $(...) subshells, where
# a counter would be lost and a broken token would end as a green no-op.
FAIL_FILE="${FAIL_FILE:-$(mktemp)}"
export FAIL_FILE

log() { echo "[$(date -u +%H:%M:%S)] $*" >&2; }

# A hard failure: logged as an error and recorded, so the job ends red.
fail() {
  echo "::error::$*" >&2
  echo "$*" >>"$FAIL_FILE"
}

hard_fail_count() { wc -l <"$FAIL_FILE" | tr -d ' '; }

new_uuid() {
  if [ -r /proc/sys/kernel/random/uuid ]; then cat /proc/sys/kernel/random/uuid; else uuidgen | tr '[:upper:]' '[:lower:]'; fi
}

# td_get <path?query> — every page of a list endpoint as one JSON array.
# List endpoints answer with a bare array or {"results": [...], "next_cursor": ...}; both are handled.
td_get() {
  local path="$1" cursor="" out="[]" resp code body
  while :; do
    if [ -n "$cursor" ]; then
      resp=$(curl -sS -G -w '\n%{http_code}' -H "Authorization: Bearer $TODOIST_API_TOKEN" \
        --data-urlencode "cursor=$cursor" "$TODOIST_API_BASE$path") || { fail "Todoist GET $path failed: curl error"; return 1; }
    else
      resp=$(curl -sS -w '\n%{http_code}' -H "Authorization: Bearer $TODOIST_API_TOKEN" \
        "$TODOIST_API_BASE$path") || { fail "Todoist GET $path failed: curl error"; return 1; }
    fi
    code=${resp##*$'\n'}
    body=${resp%$'\n'*}
    if [ "$code" != "200" ]; then
      fail "Todoist GET $path failed: $code"
      echo "$body" >&2
      return 1
    fi
    out=$(jq -c --argjson acc "$out" '$acc + (if type == "array" then . else (.results // []) end)' <<<"$body") || {
      fail "Todoist GET $path returned something that is not JSON"
      return 1
    }
    cursor=$(jq -r 'if type == "object" then (.next_cursor // "") else "" end' <<<"$body")
    [ -n "$cursor" ] || break
  done
  echo "$out"
}

# td_sync <commands-json-array> — run write commands; fails unless every command reports "ok".
td_sync() {
  local commands="$1" resp code body bad
  resp=$(curl -sS -w '\n%{http_code}' -X POST -H "Authorization: Bearer $TODOIST_API_TOKEN" \
    --data-urlencode "commands=$commands" "$TODOIST_API_BASE/sync") || { fail "Todoist sync failed: curl error"; return 1; }
  code=${resp##*$'\n'}
  body=${resp%$'\n'*}
  if [ "$code" != "200" ]; then
    fail "Todoist sync failed: $code"
    echo "$body" >&2
    return 1
  fi
  bad=$(jq -r '[(.sync_status // {}) | to_entries[] | select(.value != "ok")] | length' <<<"$body")
  if [ "$bad" != "0" ]; then
    fail "Todoist sync rejected a command: $(jq -c '.sync_status' <<<"$body")"
    return 1
  fi
  echo "$body"
}

td_move() { # <task id> <section id>
  td_sync "$(jq -nc --arg u "$(new_uuid)" --arg id "$1" --arg s "$2" \
    '[{type: "item_move", uuid: $u, args: {id: $id, section_id: $s}}]')" >/dev/null
}

# "Create" commands need a temp_id as well as a uuid, or the API silently does nothing.
td_comment() { # <task id> <text>
  td_sync "$(jq -nc --arg u "$(new_uuid)" --arg t "$(new_uuid)" --arg id "$1" --arg c "$2" \
    '[{type: "note_add", uuid: $u, temp_id: $t, args: {item_id: $id, content: $c}}]')" >/dev/null
}

td_comment_update() { # <comment id> <text>
  td_sync "$(jq -nc --arg u "$(new_uuid)" --arg id "$1" --arg c "$2" \
    '[{type: "note_update", uuid: $u, args: {id: $id, content: $c}}]')" >/dev/null
}

td_set_labels() { # <task id> <labels json array>
  td_sync "$(jq -nc --arg u "$(new_uuid)" --arg id "$1" --argjson l "$2" \
    '[{type: "item_update", uuid: $u, args: {id: $id, labels: $l}}]')" >/dev/null
}

td_add_task() { # <section id> <title> <description> <labels json array> — prints the new task id
  local temp body
  temp=$(new_uuid)
  body=$(td_sync "$(jq -nc --arg u "$(new_uuid)" --arg t "$temp" --arg p "$PROJECT_ID" --arg s "$1" \
    --arg c "$2" --arg d "$3" --argjson l "$4" \
    '[{type: "item_add", uuid: $u, temp_id: $t, args: {project_id: $p, section_id: $s, content: $c, description: $d, labels: $l}}]')") || return 1
  jq -r --arg t "$temp" '.temp_id_mapping[$t] // empty' <<<"$body"
}

# td_tasks <section id> — tasks in a section that carry the master label, in board order.
# The master label is checked here as well as in the query: it is the gate for all automation.
td_tasks() {
  local raw
  raw=$(td_get "/tasks?project_id=$PROJECT_ID&section_id=$1&label=$MASTER_LABEL&limit=200") || return 1
  jq -c --arg m "$MASTER_LABEL" \
    '[.[] | select((.labels // []) | index($m))] | sort_by(.child_order // .order // 0)' <<<"$raw"
}

# td_comments <task id> — the whole thread, oldest first.
td_comments() {
  local raw
  raw=$(td_get "/comments?task_id=$1&limit=200") || return 1
  jq -c '[.[] | select((.is_deleted // false) | not)] | sort_by(.posted_at // "")' <<<"$raw"
}

# Pull the first JSON object or array out of a model reply (it may be wrapped in a code fence or prose).
extract_json() {
  python3 -c '
import json, sys
text = sys.stdin.read()
dec = json.JSONDecoder()
for i, ch in enumerate(text):
    if ch in "{[":
        try:
            obj, _ = dec.raw_decode(text[i:])
        except ValueError:
            continue
        print(json.dumps(obj))
        sys.exit(0)
sys.exit(1)
'
}

# ask_manager <prompt> — one single-turn, tool-less call: text in, text out. Logs the model it ran on.
ask_manager() {
  local out rc
  out=$(claude -p "$1" --model "$CLAUDE_MODEL" --tools "" --max-turns 1 --output-format json)
  rc=$?
  if [ "$rc" -ne 0 ]; then
    fail "claude exited $rc on a manager call"
    return 1
  fi
  log "manager call ran on: $(jq -c '(.modelUsage // {}) | keys' <<<"$out" 2>/dev/null || echo unknown)"
  jq -r '.result // empty' <<<"$out"
}

# is_agent <name> — is this one of the configured workers?
is_agent() {
  local a
  for a in $ALL_AGENTS; do [ "$a" = "$1" ] && return 0; done
  return 1
}
