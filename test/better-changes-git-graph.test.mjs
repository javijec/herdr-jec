import assert from "node:assert/strict";
import test from "node:test";
import { graphFocusHandle, graphLocation, graphOverlay, graphOverlayMode, graphViewForTab } from "../mods/better-changes/git-graph/host.js";
import { resizedDetailsHeight } from "../mods/better-changes/git-graph/details.js";

test("the existing Commits tab routes to the embedded graph, not the old list", () => {
  assert.equal(graphViewForTab("commit"), "git-graph");
  assert.equal(graphViewForTab("changes"), "changes");
});

test("graph menu and dialog overlays are hosted by Better Changes", () => {
  const menu = graphOverlay("menu", { target: { kind: "branch" }, ctx: { root: "/repo" } }, { at: "pointer", width: 268 });
  const dialog = graphOverlay("dialog", { action: { type: "deleteBranch" }, ctx: { root: "/repo" } }, { width: 420, height: 200 });
  assert.deepEqual(menu, {
    mod: "better-changes",
    kind: "popup",
    at: "pointer",
    width: 268,
    props: { target: { kind: "branch" }, ctx: { root: "/repo" }, role: "git-graph-menu" },
  });
  assert.deepEqual(dialog, {
    mod: "better-changes",
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
