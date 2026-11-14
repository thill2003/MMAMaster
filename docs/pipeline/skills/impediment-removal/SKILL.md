---
name: impediment-removal
description: Manual-only skill for the Product Architect to triage and resolve items in the Todoist "MMA Master" project's Hold/Blocked section — escalated either by Dana (the manager agent) or by the Product Architect's own Peer Review skill. Only run when the user explicitly asks to "run Impediment Removal" or similar — never auto-trigger.
---

# Impediment Removal

Human-in-the-loop workflow for clearing the Todoist Hold/Blocked queue. Items land there from two sources: Dana's escalation/PR-review sweeps (comments prefixed `**Dana:**`), and the [[peer-review]] skill rejecting a PR-section task on the Product Architect's own behalf (comments prefixed `**Product Architect:**`). Governance rule: only the Product Architect (the user) may move a task out of Hold/Blocked — this skill is that human checkpoint. Never act autonomously past a decision point; always use the AskUserQuestion tool for approvals, not free-text prompts.

## Steps

### 1. Find eligible items
Search the Todoist "MMA Master" project's **Hold/Blocked** section for tasks that carry the `Claude` label only. Use `find-projects` (searchText "MMA Master") → `find-sections` (searchText "Hold") → `find-tasks` (sectionId + labels=["Claude"]).

### 2. Gather context and present options
For each eligible task:
- Fetch its full comment thread (`find-comments`, paginate with `cursor` until `hasMore` is false).
- Identify the relevant worker agent (from the task's agent-name label) and the hold reason, which may come from either source — a `**Dana:**` comment (her escalation or PR-review sweep) or a `**Product Architect:**` comment (a Peer Review send-back). Treat both as equally authoritative explanations of why the task is held; a task can in principle carry history from both.
- If the hold traces back to a Peer Review send-back, it will have an earlier `Pushed as <sha> to PR #<n>: <message>` comment identifying the exact commit/PR the rejection was about — use that to scope your own context-gathering to the same diff, the same way you would for a Dana hold.
- Gather any additional context needed to evaluate the claim — read the actual code/diff/migration/PR referenced, don't just trust the comment text. Verify claims against the real repo state (e.g. read the diff via `gh api .../commits/<sha>`, run `pnpm lint && pnpm test`) before trusting them.
- Determine 2-4 concrete resolution options.
- Summarize in chat: what happened, the finding (verified) and who raised it, the options as a table, and a clear recommendation with reasoning.
- **Use the AskUserQuestion tool** to let the user pick an option (or reject) — do not ask them to type a decision.

### 3. Draft the resolution update
Once an option is approved:
- Draft the additive update — new content appended to the task's **description** — describing the resolution and the concrete task needed to complete it. Never overwrite existing description content.
- Show the user the exact draft text before posting anything.
- **Use the AskUserQuestion tool** with a Yes/No choice to confirm posting the update.
- Only after Yes: apply the update via Todoist tools (update-tasks for description, or note_add-equivalent for a comment, matching Dana's existing conventions — additive, never destructive).

### 4. Release back to the queue
- **Use the AskUserQuestion tool** with a Yes/No choice to confirm moving the task.
- Only after Yes: move the task from Hold/Blocked to **Ready to Work** (Dana's intake section) in the "MMA Master" project.
- Confirm the final state back to the user (section, label, description) once done.

## Rules
- This skill is manual-trigger only — never run it proactively.
- Every decision point uses AskUserQuestion (selectable options), never a free-text "type yes/no" prompt.
- Never skip a checkpoint even if the resolution seems obvious.
- Never touch tasks outside Hold/Blocked, never remove/add labels other than what's explicitly approved, never touch the `Claude` label (Architect-only per governance).
- If a Hold/Blocked task has neither a `**Dana:**` nor a `**Product Architect:**` comment explaining the hold, say so explicitly and ask the user how to proceed rather than guessing at a resolution.
