import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { completeGraphSync, graphFocusHandle, graphLocation, graphOverlay, graphOverlayMode, graphPollInterval, graphViewForTab, requestGraphSync } from "../mods/jec-changes/git-graph/host.js";
import { resizedDetailsHeight } from "../mods/jec-changes/git-graph/details.js";

test("the existing Commits tab routes to the embedded graph, not the old list", () => {
  assert.equal(graphViewForTab("commit"), "git-graph");
  assert.equal(graphViewForTab("changes"), "changes");
});

test("Sync fetches immediately when the graph context is ready", () => {
  const events = [];
  const graph = {
    ctx: { root: "/repo" },
    context: "/repo",
    key: () => "/repo",
    sourceLocation: () => ({ cwd: "/repo" }),
    refresh: () => events.push("refresh"),
    fetch: () => events.push("fetch"),
  };

  requestGraphSync(graph, {});
  assert.deepEqual(events, ["refresh", "fetch"]);
});

test("Sync queues one fetch until the initial graph load has built its context", () => {
  const events = [];
  const graph = {
    ctx: null,
    context: "/repo",
    loading: "/repo",
    again: null,
    key: () => "/repo",
    sourceLocation: () => ({ cwd: "/repo" }),
    refresh: () => events.push("refresh"),
    fetch: () => events.push("fetch"),
  };

  requestGraphSync(graph, {});
  requestGraphSync(graph, {});
  assert.equal(graph.fetchAfterContext, "/repo");
  assert.deepEqual(events, []);
  assert.equal(completeGraphSync(graph, {}), false);
  graph.loading = null;
  graph.ctx = { root: "/repo" };
  assert.equal(completeGraphSync(graph, {}), true);
  assert.equal(graph.fetchAfterContext, null);
  assert.deepEqual(events, ["fetch"]);
});

test("Sync drops its queued fetch when graph loading ends without a repository context", () => {
  const events = [];
  const graph = {
    ctx: null,
    context: "/repo",
    loading: null,
    again: null,
    fetchAfterContext: "/repo",
    fetch: () => events.push("fetch"),
  };

  assert.equal(completeGraphSync(graph, {}), false);
  assert.equal(graph.fetchAfterContext, null);
  assert.deepEqual(events, []);
});

test("Sync with no focused folder does not queue a fetch", () => {
  const events = [];
  const graph = {
    ctx: null,
    context: null,
    loading: null,
    key: () => null,
    sourceLocation: () => ({ cwd: null }),
    refresh: () => events.push("refresh"),
    fetch: () => events.push("fetch"),
  };

  requestGraphSync(graph, {});
  assert.equal(graph.fetchAfterContext, undefined);
  assert.deepEqual(events, ["refresh"]);
});

test("embedded Graph controls are hosted in the Changes header only", () => {
  const graph = readFileSync(fileURLToPath(new URL("../mods/jec-changes/git-graph/graph.js", import.meta.url)), "utf8");
  const sidebar = readFileSync(fileURLToPath(new URL("../mods/jec-changes/views/sidebar.js", import.meta.url)), "utf8");
  const main = readFileSync(fileURLToPath(new URL("../mods/jec-changes/main.js", import.meta.url)), "utf8");
  const graphRender = graph.slice(graph.lastIndexOf("  render(cx) {"));
  assert.match(sidebar, /this\.renderGraphToolbar\(cx\)/);
  assert.doesNotMatch(sidebar, /renderMore\(|id: "more-trigger"|MenuLabel\(/);
  assert.doesNotMatch(main, /this\.menuOpen|this\.menuFocus/);
  assert.match(sidebar, /this\.gitGraph\.controls\(t\)/);
  assert.match(sidebar, /id: "sync"[\s\S]*?label: "Sync"[\s\S]*?onClick: \(cx\) => this\.syncAll\(cx\)/);
  assert.match(sidebar, /syncAll\(cx\) \{[\s\S]*?this\.refresh\(cx\);[\s\S]*?this\.ensureGitGraph\(cx\);[\s\S]*?this\.gitGraph\.sync\(cx\)/);
  assert.match(main, /command === "refresh"\) this\.syncAll\(cx\)/);
  assert.match(graph, /sync\(cx\) \{ requestGraphSync\(this, cx\); \}/);
  assert.match(graph, /completeGraphSync\(this, cx\)/);
  assert.doesNotMatch(graph, /graph-fetch/);
  assert.match(graph, /graph-all/);
  assert.match(graph, /this\.all = true; this\.remotes = true/);
  assert.doesNotMatch(graph, /graph-remotes|setRemotes\(/);
  assert.doesNotMatch(graph, /\.child\(\"Git Graph\"\)|\.child\(this\.header\(t\)\)/);
  assert.doesNotMatch(graphRender, /\.child\(this\.controls\(t\)\)/);
  assert.doesNotMatch(graphRender, /\.rounded\(10\)\.overflow_hidden\(\)\.bg\(t\.background\)\.border_1\(\)/);
});

test("graph menu and dialog overlays are hosted by JEC Changes", () => {
  const menu = graphOverlay("menu", { target: { kind: "branch" }, ctx: { root: "/repo" } }, { at: "pointer", width: 268 });
  const dialog = graphOverlay("dialog", { action: { type: "deleteBranch" }, ctx: { root: "/repo" } }, { width: 420, height: 200 });
  assert.deepEqual(menu, {
    mod: "jec-changes",
    kind: "popup",
    at: "pointer",
    width: 268,
    props: { target: { kind: "branch" }, ctx: { root: "/repo" }, role: "git-graph-menu" },
  });
  assert.deepEqual(dialog, {
    mod: "jec-changes",
    kind: "dialog",
    width: 420,
    height: 200,
    props: { action: { type: "deleteBranch" }, ctx: { root: "/repo" }, role: "git-graph-dialog" },
  });
  assert.equal(graphOverlayMode(menu.props.role), "menu");
  assert.equal(graphOverlayMode(dialog.props.role), "dialog");
  assert.equal(graphOverlayMode("unrelated"), null);
});

test("embedded graph follows the Changes repository location dynamically", () => {
  let selected = { cwd: "C:/work/first", on: null };
  const provider = () => selected;
  assert.deepEqual(graphLocation(provider), { cwd: "C:/work/first", on: null });
  selected = { cwd: "/work/second", on: "server" };
  assert.deepEqual(graphLocation(provider), { cwd: "/work/second", on: "server" });
  assert.deepEqual(graphLocation(null), { cwd: null, on: null });
});

test("embedded graph reuses the focus handle created by its owning View", () => {
  const focusHandle = { kind: "FocusHandle" };
  let allocated = false;
  const cx = { focus_handle() { allocated = true; return "not-a-focus-handle"; } };

  assert.equal(graphFocusHandle(cx, focusHandle), focusHandle);
  assert.equal(allocated, false);
});

test("commit details resize upward and downward within the available graph height", () => {
  assert.equal(resizedDetailsHeight(320, -100, 800), 420);
  assert.equal(resizedDetailsHeight(320, 100, 800), 220);
  assert.equal(resizedDetailsHeight(320, -1000, 800), 700);
  assert.equal(resizedDetailsHeight(320, 1000, 800), 120);
});

test("embedded Git Graph uses the configured JEC Changes refresh interval", () => {
  assert.equal(graphPollInterval(true, 10000), 10000);
  assert.equal(graphPollInterval(true, 30000), 30000);
  assert.equal(graphPollInterval(true), 10000);
  assert.equal(graphPollInterval(false), 15000);
  assert.equal(graphPollInterval(true, 500), 1000);
});
