#!/usr/bin/env bash
# shellcheck shell=bash
# shellcheck disable=SC2034  # sourced by the other scripts
# Knobs for the agent pipeline (handoff doc §11). Change names here, in the workflow's matrix,
# and in the Todoist labels — nowhere else.

# The manager. Every comment she writes starts with MANAGER_PREFIX; nothing else may.
MANAGER_NAME="${MANAGER_NAME:-Dana}"
MANAGER_PREFIX="${MANAGER_PREFIX:-**${MANAGER_NAME}:**}"

# The workers. Each has a Todoist label of the same name and a branch auto/agent-<Name>.
ALL_AGENTS="${ALL_AGENTS:-John Brock Silva Matt Jose}"

# Todoist. The project is found by exact name; sections by exact name inside it.
TODOIST_PROJECT_NAME="${TODOIST_PROJECT_NAME:-MMA Master}"
TODOIST_API_BASE="${TODOIST_API_BASE:-https://api.todoist.com/api/v1}"
MASTER_LABEL="Claude"
SECTION_TASK_REVIEW="Task Review"
SECTION_READY="Ready To Work"
SECTION_TODO="To Do"
SECTION_IN_PROGRESS="In Progress"
SECTION_PR="PR"
SECTION_HOLD="Hold/Blocked"

# Claude Code.
CLAUDE_MODEL="${CLAUDE_MODEL:-opus}"
WORKER_ALLOWED_TOOLS="${WORKER_ALLOWED_TOOLS:-Edit,Read,Write,Bash(git *),Bash(pnpm *)}"
WORKER_MAX_TURNS="${WORKER_MAX_TURNS:-30}"
MAX_TASKS="${MAX_TASKS:-10}"

STALL_ISSUE_TITLE="${STALL_ISSUE_TITLE:-Daily Feature Agents: Stall Log}"
BASE_BRANCH="${BASE_BRANCH:-main}"
# Longest diff, in characters, handed to the manager for one review.
REVIEW_DIFF_LIMIT="${REVIEW_DIFF_LIMIT:-80000}"
