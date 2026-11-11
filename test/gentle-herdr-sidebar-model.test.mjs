import assert from "node:assert/strict";
import test from "node:test";
import { agentProgressNotice, selectSnapshot, sameDirectory, normalizeHerdrAgents } from "../mods/gentle-herdr-sidebar/model.js";

test("snapshot selection rejects malformed, stale, future and wrong-folder data", () => {
  const now = Date.parse("2026-11-08T12:00:00.000Z");
  const snapshot = (sessionId, cwd, updatedAt, status = {}) => ({ schema: "gentle-herdr-bridge/v1", sessionId, cwd, updatedAt, status });
  assert.equal(selectSnapshot([
    snapshot("bad", "C:/repo", "2026-11-08T11:59:00Z", null),
    snapshot("stale", "C:/repo", "2026-11-08T11:58:59Z"),
    snapshot("future", "C:/repo", "2026-11-08T12:00:01Z"),
    snapshot("other", "C:/elsewhere", "2026-11-08T11:59:59Z"),
    snapshot("good", "c:\\repo\\", "2026-11-08T11:59:59Z"),
  ], "C:/repo", now)?.sessionId, "good");
  assert.equal(selectSnapshot([], "C:/repo", now), null);
});

test("agent projection is tab-scoped and clearly disclaims live Gentle Agents progress", () => {
  assert.deepEqual(normalizeHerdrAgents([
    { space: "s", tab: "t", status: "working", program: { name: "Pi" } },
    { space: "s", tab: "other", status: "working", program: { name: "Other" } },
  ], { space: "s", tab: "t" }), [{ name: "Pi", status: "working" }]);
  assert.equal(agentProgressNotice(), "The live Gentle Agents task progress is unavailable.");
});

test("directory identity preserves POSIX case and normalizes Windows paths", () => {
  assert.equal(sameDirectory("C:\\Repo\\", "c:/repo"), true);
  assert.equal(sameDirectory("/home/Repo", "/home/repo"), false);
});
