import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildSnapshot, publishSnapshot, removePresence, snapshotFileName, presenceFileName } from "../bridge/snapshot.mjs";
import { extractTodos, parseJobsEvent, readAgentHistory } from "../bridge/session-data.mjs";

test("snapshot publication writes a complete snapshot and removable presence heartbeat", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gentle-herdr-test-")); t.after(() => rm(dir, { recursive: true, force: true }));
  const value = buildSnapshot({ sessionId: "session/one", cwd: "/repo", updatedAt: "2026-11-08T12:00:00.000Z", status: { context: { pct: 0 } } });
  const files = await publishSnapshot(dir, value, { pid: 42 });
  assert.deepEqual(JSON.parse(await readFile(files.snapshotPath, "utf8")), value);
  assert.deepEqual(JSON.parse(await readFile(files.presencePath, "utf8")), { sessionId: "session/one", cwd: "/repo", pid: 42, updatedAt: value.updatedAt });
  assert.equal(path.basename(files.snapshotPath), snapshotFileName("session/one"));
  await removePresence(dir, "session/one");
  assert.deepEqual((await readdir(dir)), [path.basename(files.snapshotPath)]);
  assert.equal(path.basename(files.presencePath), presenceFileName("session/one"));
});

test("todo parsing validates entries and job events are scoped to their session", () => {
  const entries = [{ type: "message", message: { role: "toolResult", toolName: "todo", details: { gentleTodo: { tasks: [{ id: 1, title: "Verify", status: "in_progress" }], updatedTurn: 2 } } } }];
  assert.deepEqual(extractTodos(entries, 4), { items: [{ id: 1, text: "Verify", state: "in_progress" }], staleTurns: 2 });
  assert.equal(extractTodos([{ type: "message", message: { role: "toolResult", toolName: "todo", details: { gentleTodo: { tasks: [{ id: -1, title: "bad", status: "pending" }] } } } }], 1), undefined);
  assert.deepEqual(parseJobsEvent({ sessionId: "s", snapshot: { jobs: [{ id: "j", label: "Build", startedAt: 1 }] } }, "s"), [{ id: "j", label: "Build", startedAt: 1 }]);
  assert.equal(parseJobsEvent({ sessionId: "other", snapshot: { jobs: [] } }, "s"), undefined);
});

test("missing Agent history is reported unavailable, never as live progress", async () => {
  const result = await readAgentHistory(path.join(os.tmpdir(), `missing-gentle-agent-history-${process.pid}-${Date.now()}`), "session");
  assert.deepEqual(result, { items: [], liveAvailable: false, historyAvailable: false });
});

test("finished Agent tasks remain visible for five minutes, then expire", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gentle-agent-history-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const now = 1_000_000;
  await writeFile(path.join(dir, "task-1.json"), JSON.stringify({ task: {
    id: "task-1", parentSessionId: "session", status: "completed", agent: "worker", label: "Inspect sidebar",
    startedAt: now - 130_000, endedAt: now - 120_000, createdAt: now - 130_000, tokens: 10, cost: 0.01,
  } }));
  assert.equal((await readAgentHistory(dir, "session", now)).items[0]?.id, "task-1");
  assert.deepEqual((await readAgentHistory(dir, "session", now + 181_000)).items, []);
});
