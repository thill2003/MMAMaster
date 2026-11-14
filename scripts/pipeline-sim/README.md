# pipeline-sim

Offline tests for the agent pipeline in `.github/agents/`.

```bash
pnpm test:pipeline      # python3 scripts/pipeline-sim/run.py — needs python3, jq, git
```

`run.py` starts `mock_todoist.py` (an in-memory Todoist API v1), puts the stubs in `stubs/` ahead of the
real `claude`, `gh` and `pnpm` on `PATH`, makes a throwaway git remote, and runs the real `setup.sh`,
`manager.sh` and `worker.sh`. Each scenario then checks the board, the branch and the PR.

What the stub `claude` answers is set per scenario: manager replies through `SIM_ESCALATION`, `SIM_REVIEW`
and `SIM_ASSIGN`; worker behaviour through the task title (`BLOCKME`, `CRASH`, `NOCOMMIT`, `WORKFLOW`,
`TWOCOMMITS`).

This proves the scripts' logic and the governance rules. It does not prove that Todoist, GitHub or the
Claude CLI behave the way the mock and stubs assume — the smoke test in `docs/SETUP.md` does that.
