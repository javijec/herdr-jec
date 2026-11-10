import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isTabbedView, listsViewOf } from "../mods/my-better-sidebar/views/lists-model.js";

test("lists view stays stacked by default and switches only for the tabs setting", () => {
  assert.equal(isTabbedView({}), false);
  assert.equal(isTabbedView({ lists_view: "stacked" }), false);
  assert.equal(isTabbedView({ lists_view: "tabs" }), true);
});

test("a visible layout choice overrides the configured default and invalid choices fall back", () => {
  assert.equal(listsViewOf("tabs", { lists_view: "stacked" }), "tabs");
  assert.equal(listsViewOf("stacked", { lists_view: "tabs" }), "stacked");
  assert.equal(listsViewOf("invalid", { lists_view: "tabs" }), "tabs");
  assert.equal(listsViewOf(undefined, {}), "stacked");
});

test("the layout mounts one switchable lists block and the setting exposes both choices", async () => {
  const layout = JSON.parse(await readFile(new URL("../layouts/javijec.json", import.meta.url), "utf8"));
  const schema = JSON.parse(await readFile(new URL("../mods/my-better-sidebar/mod.schema.json", import.meta.url), "utf8"));
  const lists = layout.children[0].children.find((child) => child.id === "sidebar-lists");
  assert.equal(lists.type, "block");
  assert.equal(lists.content.props.view, "lists");
  assert.deepEqual(schema.properties.settings.properties.lists_view.enum, ["stacked", "tabs"]);
});

test("sidebar views without an init hook can still be mounted", async () => {
  const source = await readFile(new URL("../mods/my-better-sidebar/main.js", import.meta.url), "utf8");
  assert.match(source, /this\.part\.init\?\.\(given, cx\)/);
});
