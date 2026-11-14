#!/usr/bin/env bash
# Looks up the Todoist project and its six working sections by exact name and writes their ids to
# $GITHUB_OUTPUT. Fails loudly, with the raw list, if anything is missing. Backlog is never looked up:
# no automation reads or writes it.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
. "$HERE/config.sh"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

OUT="${GITHUB_OUTPUT:-/dev/stdout}"

projects=$(td_get "/projects?limit=200") || exit 1
PROJECT_ID=$(jq -r --arg n "$TODOIST_PROJECT_NAME" '[.[] | select(.name == $n)][0].id // empty' <<<"$projects")
if [ -z "$PROJECT_ID" ]; then
  echo "::error::Could not find a Todoist project named \"$TODOIST_PROJECT_NAME\". Set the repo variable TODOIST_PROJECT_NAME." >&2
  jq -r '.[].name' <<<"$projects" >&2
  exit 1
fi
echo "project_id=$PROJECT_ID" >>"$OUT"

sections=$(td_get "/sections?project_id=$PROJECT_ID&limit=200") || exit 1
missing=0
emit() { # <output key> <section name>
  local id
  id=$(jq -r --arg n "$2" '[.[] | select(.name == $n)][0].id // empty' <<<"$sections")
  if [ -z "$id" ]; then
    echo "::error::Section \"$2\" not found in project \"$TODOIST_PROJECT_NAME\"." >&2
    missing=1
  else
    echo "$1=$id" >>"$OUT"
  fi
}
emit sec_task_review "$SECTION_TASK_REVIEW"
emit sec_ready "$SECTION_READY"
emit sec_todo "$SECTION_TODO"
emit sec_in_progress "$SECTION_IN_PROGRESS"
emit sec_pr "$SECTION_PR"
emit sec_hold "$SECTION_HOLD"
if [ "$missing" -ne 0 ]; then
  echo "Sections found:" >&2
  jq -r '.[].name' <<<"$sections" >&2
  exit 1
fi
log "Project \"$TODOIST_PROJECT_NAME\" and all six sections found."
