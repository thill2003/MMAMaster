---
name: peer-review
description: Manual-only skill for the Product Architect to peer-review Todoist PR-section tasks change by change (inline before/after code with explanations), then open the dual merge gate (Todoist complete + Claude review comment + human GitHub approval) before any merge to main. Only run when the user explicitly asks to "run Peer Review" or similar — never auto-trigger.
---

# Peer Review

Human-in-the-loop review of every commit a worker agent (or a person) has
pushed for a Todoist PR-section task. Replaces PO Reviews. Governance: only
the Product Architect marks a PR-section task complete; nothing merges to
main until the dual gate (Todoist complete AND Claude review AND human GitHub
approval, all for the current head SHA) is satisfied. Never act past a
decision point without AskUserQuestion. Never free-text "type yes".

## 0. Session setup
Ask once (AskUserQuestion): display style **Inline diff** (default) or
**Side by side**. Remember it for the session.

## 1. Find eligible items
Todoist project named `MMA Master` (find its id with `find-projects`).
Section **PR** → `find-tasks` with
labels=["Claude"]. For each task, `find-comments` (paginate until `hasMore`
is false) and take the newest `Pushed as <sha> to PR #<n>: <subject>`
comment. No such comment → report it and ask how to proceed; never guess a
SHA.

## 2. Claude's independent review (before the walkthrough)
- Fetch the diff: `gh api repos/<owner>/<repo>/commits/<sha> -H "Accept: application/vnd.github.v3.diff"`.
- Fetch the PR: `gh pr view <n> --json number,headRefOid,body,reviews,comments,author`.
- Read the task title, description, and whole comment thread (prior Dana or
  Product Architect feedback counts as requirements).
- Review the diff yourself, in the foreground, against the requirements:
  correctness, safety (import boundaries, `core/` purity, secrets), completeness, tests. Do
  not use Dana's `(review)` comment as input; compare to it afterwards.
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
State Claude's verdict and how it compares with Dana's comment. Then
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
