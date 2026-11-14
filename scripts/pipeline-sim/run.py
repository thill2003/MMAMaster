#!/usr/bin/env python3
"""Offline tests for the agent pipeline (.github/agents).

Runs the real setup, manager and worker scripts against a mock Todoist API, a stub `claude`, a stub `gh`
and a throwaway git remote, and checks what ends up on the board, on the branch and on the PR.

  python3 scripts/pipeline-sim/run.py        (or: pnpm test:pipeline)

This proves the scripts' logic and their governance rules. It does not prove that Todoist, GitHub or the
Claude CLI behave the way the mock and the stubs assume.
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
AGENTS = os.path.join(ROOT, ".github", "agents")

SECTIONS = ["Backlog", "Task Review", "Ready To Work", "To Do", "In Progress", "PR", "Hold/Blocked"]
SEC = {name: "s%d" % i for i, name in enumerate(SECTIONS)}
checks = [0]


def check(cond, what):
    checks[0] += 1
    if not cond:
        raise AssertionError(what)


def task(tid, section, labels, title=None, order=None):
    return {"id": tid, "project_id": "p1", "section_id": SEC[section], "content": title or tid, "description": "",
            "labels": labels, "child_order": order or 0, "checked": False}


def note(tid, text):
    return {"id": "seed-" + str(abs(hash((tid, text))) % 10**8), "item_id": tid, "content": text}


class Sim:
    """One scenario: its own Todoist state, GitHub state and git remote."""

    def __init__(self, tasks, comments=(), sections=SECTIONS):
        self.dir = tempfile.mkdtemp(prefix="pipeline-sim-")
        seed = {
            "projects": [{"id": "p0", "name": "Some Other Project"}, {"id": "p9", "name": "MMA Master Archive"}, {"id": "p1", "name": "MMA Master"}],
            "sections": [{"id": SEC[n], "project_id": "p1", "name": n} for n in sections],
            "tasks": {},
            "comments": list(comments),
        }
        for i, t in enumerate(tasks):
            t["child_order"] = t["child_order"] or i + 1
            seed["tasks"][t["id"]] = t
        with open(os.path.join(self.dir, "seed.json"), "w") as f:
            json.dump(seed, f)
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        self.port = s.getsockname()[1]
        s.close()
        self.server = subprocess.Popen([sys.executable, os.path.join(HERE, "mock_todoist.py"), str(self.port), os.path.join(self.dir, "seed.json")])
        for _ in range(100):
            try:
                self.state()
                break
            except OSError:
                time.sleep(0.05)
        # a bare "origin" with one commit on main, and a working clone
        self.origin = os.path.join(self.dir, "origin.git")
        self.work = os.path.join(self.dir, "work")
        self.git(self.dir, "init", "-q", "--bare", "-b", "main", self.origin)
        self.git(self.dir, "clone", "-q", self.origin, self.work)
        self.git(self.work, "config", "user.name", "Seed")
        self.git(self.work, "config", "user.email", "seed@example.com")
        self.write("README.md", "seed\n")
        self.write("shared.txt", "line\n")
        self.git(self.work, "add", "-A")
        self.git(self.work, "commit", "-q", "-m", "Seed")
        self.git(self.work, "push", "-q", "origin", "HEAD:refs/heads/main")
        self.env = dict(
            os.environ,
            PATH=os.path.join(HERE, "stubs") + os.pathsep + os.environ["PATH"],
            TODOIST_API_BASE="http://127.0.0.1:%d/api/v1" % self.port,
            TODOIST_API_TOKEN="test-token",
            GITHUB_REPOSITORY="sim/repo",
            SIM_GH=os.path.join(self.dir, "gh.json"),
            SIM_LOG=os.path.join(self.dir, "claude.log"),
            GITHUB_OUTPUT=os.path.join(self.dir, "output.txt"),
            PROJECT_ID="p1",
            SEC_TASK_REVIEW=SEC["Task Review"], SEC_READY=SEC["Ready To Work"], SEC_TODO=SEC["To Do"],
            SEC_IN_PROGRESS=SEC["In Progress"], SEC_PR=SEC["PR"], SEC_HOLD=SEC["Hold/Blocked"],
        )
        self.env.pop("FAIL_FILE", None)

    def git(self, cwd, *args):
        return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()

    def write(self, name, text):
        with open(os.path.join(self.work, name), "w") as f:
            f.write(text)

    def state(self):
        with urllib.request.urlopen("http://127.0.0.1:%d/__state" % self.port) as r:
            return json.load(r)

    def section(self, tid):
        sid = self.state()["tasks"][tid]["section_id"]
        return next(n for n, s in SEC.items() if s == sid)

    def notes(self, tid):
        return [c["content"] for c in self.state()["comments"] if c["item_id"] == tid]

    def gh(self):
        p = self.env["SIM_GH"]
        return json.load(open(p)) if os.path.exists(p) else {"prs": [], "issues": []}

    def calls(self):
        p = self.env["SIM_LOG"]
        return [json.loads(line) for line in open(p)] if os.path.exists(p) else []

    def run(self, script, *args, **extra):
        env = dict(self.env, **extra)
        r = subprocess.run(["bash", os.path.join(AGENTS, script), *args], cwd=self.work, env=env, capture_output=True, text=True)
        self.last = r.stderr
        return r.returncode

    def close(self):
        self.server.terminate()
        self.server.wait()
        shutil.rmtree(self.dir, ignore_errors=True)


# ---------------------------------------------------------------- scenarios


def test_setup():
    s = Sim([])
    try:
        check(s.run("setup.sh") == 0, "setup finds the project and sections: " + s.last)
        out = dict(line.strip().split("=", 1) for line in open(s.env["GITHUB_OUTPUT"]))
        check(out["project_id"] == "p1", "picks the project by exact name, across pages")
        check(out["sec_ready"] == SEC["Ready To Work"] and out["sec_hold"] == SEC["Hold/Blocked"] and len(out) == 7, "all six section ids")
        check("backlog" not in " ".join(out).lower(), "Backlog is never looked up")
        check(s.run("setup.sh", TODOIST_API_TOKEN="wrong") == 1, "a bad token is a red run")
        check(s.run("setup.sh", TODOIST_PROJECT_NAME="Nope") == 1, "an unknown project is a red run")
    finally:
        s.close()
    s = Sim([], sections=[n for n in SECTIONS if n != "PR"])
    try:
        check(s.run("setup.sh") == 1 and 'Section "PR" not found' in s.last, "a missing section is a red run that names it")
    finally:
        s.close()


def board():
    return Sim(
        [
            task("b0", "Backlog", ["Claude"]),
            task("r1", "Ready To Work", ["Claude"], "MM-900 Add a thing"),
            task("r2", "Ready To Work", ["Claude", "Brock"]),
            task("r3", "Ready To Work", []),
            task("d1", "To Do", ["Claude", "Silva"]),
            task("d2", "In Progress", ["Claude", "Matt"]),
            task("q1", "PR", ["Claude", "Jose"]),
            task("h1", "Hold/Blocked", ["Claude", "John"]),
        ],
        [
            note("d1", "BLOCKED: which screen does this go on?"),
            note("d2", "BLOCKED: old question"),
            note("d2", "**Dana:** Use the map screen."),
            note("q1", "Pushed as abc1234 to PR #3: Do the thing"),
            note("h1", "BLOCKED: waiting on a person"),
        ],
    )


def test_manager():
    s = board()
    try:
        check(s.run("manager.sh") == 0, "manager runs clean: " + s.last)
        t = s.state()["tasks"]
        check(s.section("r1") == "To Do" and sorted(t["r1"]["labels"]) == ["Claude", "John"], "untagged task is labelled additively and moved to To Do")
        check(any(n.startswith("**Dana:** assigned to John") for n in s.notes("r1")), "assignment is announced")
        check(s.section("r2") == "To Do" and s.notes("r2") == ["**Dana:** already tagged for Brock; moved to To Do."], "pre-tagged task goes straight to To Do")
        check(s.section("r3") == "Ready To Work" and s.notes("r3") == [], "a task without the master label is never touched")
        check(s.section("b0") == "Backlog" and s.notes("b0") == [], "Backlog is never touched")
        check(s.section("d1") == "Hold/Blocked" and s.notes("d1")[-1].startswith("**Dana:** "), "a new blocker is escalated")
        check(s.section("d2") == "In Progress" and len(s.notes("d2")) == 2, "a blocker she already answered is left alone")
        check(s.notes("q1")[-1].startswith("**Dana:** (review) abc1234 — OK."), "a new push is reviewed")
        check(s.section("h1") == "Hold/Blocked" and len(s.notes("h1")) == 1, "she never moves a task out of Hold/Blocked")
        calls = s.calls()
        check([c["sweep"] for c in calls] == ["escalation", "review", "assignment"], "sweeps run in order, one batched assignment call")
        for c in calls:
            a = c["args"]
            check(a[a.index("--tools") + 1] == "" and a[a.index("--max-turns") + 1] == "1" and a[a.index("--model") + 1] == "opus", "manager calls are tool-less, single-turn, on opus")
        before = len(s.state()["comments"])
        check(s.run("manager.sh") == 0 and len(s.state()["comments"]) == before and len(s.calls()) == 3, "a second sweep with nothing new does nothing")
    finally:
        s.close()


def test_manager_validation():
    s = board()
    try:
        bad = json.dumps([{"id": "r1", "decision": "assign", "agent": "Mallory"}, {"id": "h1", "decision": "assign", "agent": "John"}])
        check(s.run("manager.sh", SIM_ASSIGN=bad, SIM_ESCALATION='{"decision": "delete", "comment": "x"}', SIM_REVIEW="not json at all") == 1, "bad decisions make the run red")
        t = s.state()["tasks"]
        check(s.section("r1") == "Ready To Work" and t["r1"]["labels"] == ["Claude"] and s.notes("r1") == [], "an unknown agent is never applied")
        check(s.section("h1") == "Hold/Blocked" and t["h1"]["labels"] == ["Claude", "John"], "a decision about a task that was not offered is ignored")
        check(s.section("d1") == "To Do" and len(s.notes("d1")) == 1, "an unknown escalation decision writes nothing")
        check(len(s.notes("q1")) == 1, "a review that is not JSON writes nothing")
    finally:
        s.close()


def test_manager_variants():
    s = board()
    try:
        nofit = json.dumps([{"id": "r1", "decision": "no-fit", "reason": "Depends on MM-800."}])
        review = '{"decision": "hold", "review": "Breaks the import boundary in src/core."}'
        esc = '{"decision": "task-review", "comment": "Separate work.", "title": "Decide the screen", "description": "From d1."}'
        check(s.run("manager.sh", SIM_ASSIGN=nofit, SIM_REVIEW=review, SIM_ESCALATION=esc) == 0, "variants run clean: " + s.last)
        check(s.run("manager.sh", SIM_ASSIGN=nofit) == 0, "second sweep")
        check(s.section("r1") == "Ready To Work" and s.notes("r1") == ["**Dana:** (no fit): Depends on MM-800. [count: 2]"], "no-fit keeps one comment and bumps its count")
        check(s.section("q1") == "Hold/Blocked" and "HOLD" in s.notes("q1")[-1], "a held review moves the task to Hold/Blocked")
        new = [t for t in s.state()["tasks"].values() if t["content"] == "Decide the screen"]
        check(len(new) == 1 and new[0]["section_id"] == SEC["Task Review"] and new[0]["labels"] == ["Claude"], "task-review creates a labelled task in Task Review")
        check(s.section("d1") == "To Do" and new[0]["id"] in s.notes("d1")[-1], "the original stays put with a link to the follow-up")
    finally:
        s.close()


def test_worker():
    s = Sim([
        task("w1", "To Do", ["Claude", "John"], "MM-900 Add a thing"),
        task("w2", "To Do", ["Claude", "John"], "BLOCKME unclear"),
        task("w3", "To Do", ["Claude", "John"], "MM-901 After"),
        task("x1", "To Do", ["Claude", "Brock"], "Brock's task"),
        task("x2", "To Do", ["John"], "No master label"),
    ])
    try:
        check(s.run("worker.sh", "--peek", AGENT="John") == 0 and "has_work=true" in open(s.env["GITHUB_OUTPUT"]).read(), "peek sees John's queue")
        check(s.run("worker.sh", "--peek", AGENT="Jose", GITHUB_OUTPUT=os.path.join(s.dir, "o2")) == 0 and "has_work=false" in open(os.path.join(s.dir, "o2")).read(), "peek sees Jose has nothing")
        check(s.run("worker.sh", AGENT="Mallory") == 1, "an unknown agent name is refused")
        check(s.run("worker.sh", AGENT="John") == 0, "worker runs clean: " + s.last)
        head = s.git(s.origin, "rev-parse", "refs/heads/auto/agent-John")
        check(s.git(s.origin, "rev-list", "--count", "main..auto/agent-John") == "1", "one commit pushed to the agent branch")
        check(s.git(s.origin, "log", "-1", "--format=%an <%ae>", "auto/agent-John") == "John (Claude Agent) <agent-john@users.noreply.github.com>", "commit carries the agent identity")
        prs = s.gh()["prs"]
        check(len(prs) == 1 and prs[0]["title"] == "John's work queue" and "- [x] MM-900 Add a thing (todoist:w1)" in prs[0]["body"], "one PR with the task line and its Todoist id")
        check(s.section("w1") == "PR" and s.notes("w1") == ["Pushed as %s to PR #1: Do MM-900 Add a thing" % head], "task handed to PR with the pushed SHA")
        check(s.section("w2") == "To Do" and s.notes("w2") == ["BLOCKED: the task does not say which screen the button goes on."], "a blocked task goes back with the worker's reason")
        check(s.section("w3") == "To Do" and s.notes("w3") == [], "the queue is not skipped past a stuck task")
        check(s.section("x1") == "To Do" and s.section("x2") == "To Do", "other agents' and unlabelled tasks are never touched")
        w = [c for c in s.calls() if c["sweep"] == "worker"][0]["args"]
        check(w[w.index("--allowedTools") + 1] == "Edit,Read,Write,Bash(git *),Bash(pnpm *)" and w[w.index("--max-turns") + 1] == "30", "worker runs with the tool allowlist and turn cap")
        check(s.run("worker.sh", AGENT="John") == 0 and len(s.notes("w2")) == 1, "an identical blocker is not posted twice")
        check(s.run("manager.sh") == 0 and s.notes("w1")[-1].startswith("**Dana:** (review) " + head), "the manager then reviews exactly that commit")
    finally:
        s.close()


def test_worker_reuse_and_squash():
    s = Sim([task("a", "To Do", ["Claude", "Silva"], "First"), task("b", "To Do", ["Claude", "Silva"], "TWOCOMMITS second")])
    try:
        check(s.run("worker.sh", AGENT="Silva") == 0, "worker runs clean: " + s.last)
        check(s.git(s.origin, "rev-list", "--count", "main..auto/agent-Silva") == "2", "two tasks, two commits — a session's extra commit is folded in")
        prs = s.gh()["prs"]
        check(len(prs) == 1 and prs[0]["body"].count("- [x] ") == 2 and "(todoist:b)" in prs[0]["body"], "the one PR gains a line per task")
        check(s.section("a") == "PR" and s.section("b") == "PR", "both tasks handed over")
    finally:
        s.close()


def test_worker_failures():
    s = Sim([task("c", "To Do", ["Claude", "Matt"], "CRASH it"), task("n", "To Do", ["Claude", "Jose"], "WORKFLOW hack"), task("z", "To Do", ["Claude", "Brock"], "NOCOMMIT nothing")])
    try:
        check(s.run("worker.sh", AGENT="Matt") == 1, "a CLI crash is a red run")
        check(s.section("c") == "To Do" and len(s.notes("c")) == 1 and s.notes("c")[0].startswith("BLOCKED: Matt's run failed"), "the task goes back with a blocker")
        check(s.run("worker.sh", AGENT="Matt") == 1 and len(s.notes("c")) == 1, "the same blocker is not repeated")
        issues = s.gh()["issues"]
        check(len(issues) == 1 and issues[0]["title"] == "Daily Feature Agents: Stall Log" and len(issues[0]["comments"]) == 2, "stalls are logged to one standing issue")
        check(s.run("worker.sh", AGENT="Jose") == 0, "workflow edit handled: " + s.last)
        check(s.section("n") == "To Do" and ".github/" in s.notes("n")[0], "a commit touching .github/ is rejected with a blocker")
        check(subprocess.run(["git", "rev-parse", "-q", "--verify", "refs/heads/auto/agent-Jose"], cwd=s.origin, capture_output=True).returncode != 0, "and nothing is pushed")
        check(s.run("worker.sh", AGENT="Brock") == 0 and s.section("z") == "To Do" and s.notes("z") == [], "no commit and no reason: back to To Do, run ends")
    finally:
        s.close()


def test_worker_resume_and_conflict():
    s = Sim([task("r", "In Progress", ["Claude", "John"], "Resume me"), task("k", "To Do", ["Claude", "Brock"], "Conflicted")])
    try:
        # John's work is already pushed and listed on his PR; only the Todoist move was lost.
        s.git(s.work, "checkout", "-q", "-b", "auto/agent-John")
        s.write("done.txt", "x\n")
        s.git(s.work, "add", "-A")
        s.git(s.work, "commit", "-q", "-m", "Do Resume me")
        s.git(s.work, "push", "-q", "origin", "HEAD:refs/heads/auto/agent-John")
        json.dump({"prs": [{"number": 7, "state": "open", "headRefName": "auto/agent-John", "title": "John's work queue", "body": "- [x] Resume me (todoist:r)"}], "issues": []}, open(s.env["SIM_GH"], "w"))
        check(s.run("worker.sh", AGENT="John") == 0, "resume runs clean: " + s.last)
        check(s.section("r") == "PR" and [c for c in s.calls() if c["sweep"] == "worker"] == [], "a task already on the PR is moved without redoing the work")

        # Brock's branch and main have both changed the same line.
        s.git(s.work, "checkout", "-q", "-B", "auto/agent-Brock", "origin/main")
        s.write("shared.txt", "brock\n")
        s.git(s.work, "commit", "-q", "-am", "Brock's change")
        s.git(s.work, "push", "-q", "origin", "HEAD:refs/heads/auto/agent-Brock")
        s.git(s.work, "checkout", "-q", "-B", "tmp-main", "origin/main")
        s.write("shared.txt", "main\n")
        s.git(s.work, "commit", "-q", "-am", "Main's change")
        s.git(s.work, "push", "-q", "origin", "HEAD:refs/heads/main")
        check(s.run("worker.sh", AGENT="Brock") == 0, "conflict handled: " + s.last)
        check(s.section("k") == "To Do" and "no longer merges cleanly" in s.notes("k")[0], "a merge conflict stops the agent with a blocker")
    finally:
        s.close()


TESTS = [test_setup, test_manager, test_manager_validation, test_manager_variants, test_worker, test_worker_reuse_and_squash, test_worker_failures, test_worker_resume_and_conflict]

if __name__ == "__main__":
    # Unzipping on some systems drops the executable bit the stubs need.
    for name in os.listdir(os.path.join(HERE, "stubs")):
        os.chmod(os.path.join(HERE, "stubs", name), 0o755)
    failed = 0
    for t in TESTS:
        try:
            t()
            print("ok    " + t.__name__)
        except Exception as e:  # an assertion, or a crash while looking for what should be there
            failed += 1
            print("FAIL  " + t.__name__ + ": " + (str(e) or type(e).__name__))
    print("%d scenario(s), %d check(s), %d failed" % (len(TESTS), checks[0], failed))
    sys.exit(1 if failed else 0)
