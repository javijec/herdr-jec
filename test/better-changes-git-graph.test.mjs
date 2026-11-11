import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { graphFocusHandle, graphLocation, graphOverlay, graphOverlayMode, graphPollInterval, graphViewForTab } from "../mods/jec-changes/git-graph/host.js";
import { resizedDetailsHeight } from "../mods/jec-changes/git-graph/details.js";

test("the existing Commits tab routes to the embedded graph, not the old list", () => {
  assert.equal(graphViewForTab("commit"), "git-graph");
  assert.equal(graphViewForTab("changes"), "changes");
});

test("embedded Graph controls are hosted in the Changes header only", () => {
  const graph = readFileSync(fileURLToPath(new URL("../mods/jec-changes/git-graph/graph.js", import.meta.url)), "utf8");
  const sidebar = readFileSync(fileURLToPath(new URL("../mods/jec-changes/views/sidebar.js", import.meta.url)), "utf8");
  const graphRender = graph.slice(graph.lastIndexOf("  render(cx) {"));
  const graphHeader = graph.slice(graph.indexOf("  header(t) {"), graph.indexOf("  controls(t) {"));

  assert.match(sidebar, /this\.renderGraphToolbar\(cx\)/);
  assert.match(sidebar, /this\.gitGraph\.controls\(t\)/);
  assert.match(sidebar, /id: "refresh"[\s\S]*?onClick: \(cx\) => this\.refreshAll\(cx\)/);
  assert.match(sidebar, /graphViewForTab\(this\.tab\) !== "git-graph"[\s\S]*?id: "refresh"/);
  assert.match(graph, /graph-fetch/);
  assert.match(graph, /graph-all/);
  assert.match(graph, /this\.all = true; this\.remotes = true/);
  assert.doesNotMatch(graph, /graph-remotes|setRemotes\(/);
  assert.doesNotMatch(graphHeader, /\.child\(where\)/);
  assert.doesNotMatch(graphRender, /\.child\(this\.controls\(t\)\)/);
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
