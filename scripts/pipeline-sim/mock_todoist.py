#!/usr/bin/env python3
"""A small in-memory stand-in for the Todoist API v1, for testing the agent pipeline offline.

It implements only what .github/agents uses: paged list reads, single-task reads, and the /sync write
commands — including two behaviours the real API is documented to have and the pipeline must survive:
list endpoints are paged (page size 2 here, to force cursor handling), and "create" commands without a
temp_id are silently ignored.

  mock_todoist.py <port> <seed.json>     serve
  GET  /__state                          dump the whole state as JSON
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

TOKEN = "test-token"
PAGE = 2
state = {}
clock = [0]


def stamp():
    clock[0] += 1
    return "2026-11-14T12:%02d:%02d.000000Z" % (clock[0] // 60, clock[0] % 60)


def next_id(prefix):
    state["seq"] = state.get("seq", 1000) + 1
    return "%s%d" % (prefix, state["seq"])


def page(items, query, key="results"):
    start = int(query.get("cursor", ["0"])[0])
    chunk = items[start : start + PAGE]
    more = start + PAGE < len(items)
    return {key: chunk, "next_cursor": str(start + PAGE) if more else None}


def apply(cmd, mapping):
    kind, args = cmd.get("type"), cmd.get("args", {})
    tasks, comments = state["tasks"], state["comments"]
    if kind in ("item_add", "note_add") and not cmd.get("temp_id"):
        return "ok"  # the real API accepts these and does nothing
    if kind == "item_move":
        tasks[args["id"]]["section_id"] = args["section_id"]
    elif kind == "item_update":
        tasks[args["id"]].update({k: v for k, v in args.items() if k != "id"})
    elif kind == "item_complete":
        tasks[args["id"]]["checked"] = True
    elif kind == "item_add":
        new = next_id("t")
        tasks[new] = {
            "id": new,
            "project_id": args["project_id"],
            "section_id": args.get("section_id"),
            "content": args["content"],
            "description": args.get("description", ""),
            "labels": args.get("labels", []),
            "child_order": len(tasks) + 1,
            "checked": False,
        }
        mapping[cmd["temp_id"]] = new
    elif kind == "note_add":
        new = next_id("c")
        comments.append({"id": new, "item_id": args["item_id"], "content": args["content"], "posted_at": stamp(), "is_deleted": False})
        mapping[cmd["temp_id"]] = new
    elif kind == "note_update":
        for c in comments:
            if c["id"] == args["id"]:
                c["content"] = args["content"]
    else:
        return {"error": "unknown command", "error_code": 1}
    return "ok"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authed(self):
        if self.headers.get("Authorization") == "Bearer " + TOKEN:
            return True
        self.send(401, {"error": "Unauthorized"})
        return False

    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/__state":
            return self.send(200, state)
        if not self.authed():
            return
        path = url.path.replace("/api/v1", "", 1)
        tasks = [t for t in state["tasks"].values()]
        if path == "/projects":
            return self.send(200, page(state["projects"], q))
        if path == "/sections":
            return self.send(200, page([s for s in state["sections"] if s["project_id"] == q["project_id"][0]], q))
        if path == "/tasks":
            out = [t for t in tasks if not t["checked"]]
            for key in ("project_id", "section_id"):
                if key in q:
                    out = [t for t in out if t.get(key) == q[key][0]]
            if "label" in q:
                out = [t for t in out if q["label"][0] in t["labels"]]
            return self.send(200, page(sorted(out, key=lambda t: t["child_order"]), q))
        if path == "/tasks/completed/by_completion_date":
            return self.send(200, page([t for t in tasks if t["checked"]], q, "items"))
        if path.startswith("/tasks/"):
            t = state["tasks"].get(path.split("/")[2])
            if t and not t["checked"]:
                return self.send(200, t)
            return self.send(404, {"error": "Task not found"})
        if path == "/comments":
            return self.send(200, page([c for c in state["comments"] if c["item_id"] == q["task_id"][0]], q))
        self.send(404, {"error": "no such endpoint", "path": path})

    def do_POST(self):
        if not self.authed():
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", "0"))).decode()
        if urlparse(self.path).path != "/api/v1/sync":
            return self.send(404, {"error": "no such endpoint"})
        commands = json.loads(parse_qs(body)["commands"][0])
        status, mapping = {}, {}
        for cmd in commands:
            try:
                status[cmd["uuid"]] = apply(cmd, mapping)
            except KeyError as e:
                status[cmd["uuid"]] = {"error": "bad argument %s" % e, "error_code": 2}
        self.send(200, {"sync_status": status, "temp_id_mapping": mapping, "full_sync": False})


if __name__ == "__main__":
    port, seed = int(sys.argv[1]), sys.argv[2]
    with open(seed) as f:
        state.update(json.load(f))
    for c in state["comments"]:
        c.setdefault("posted_at", stamp())
        c.setdefault("is_deleted", False)
    time.sleep(0)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
