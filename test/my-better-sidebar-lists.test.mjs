import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isTabbedView } from "../mods/my-better-sidebar/views/lists-model.js";

test("lists view stays stacked by default and switches only for the tabs setting", () => {
  assert.equal(isTabbedView({}), false);
  assert.equal(isTabbedView({ lists_view: "stacked" }), false);
  assert.equal(isTabbedView({ lists_view: "tabs" }), true);
});

test("the layout mounts one switchable lists block and the setting exposes both choices", async () => {
  const layout = JSON.parse(await readFile(new URL("../layouts/javijec.json", import.meta.url), "utf8"));
  const schema = JSON.parse(await readFile(new URL("../mods/my-better-sidebar/mod.schema.json", import.meta.url), "utf8"));
  const lists = layout.children[0].children.find((child) => child.id === "sidebar-lists");
  assert.equal(lists.type, "block");
  assert.equal(lists.content.props.view, "lists");
  assert.deepEqual(schema.properties.settings.properties.lists_view.enum, ["stacked", "tabs"]);
});
