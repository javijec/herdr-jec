"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const result = find(child, id);
    if (result) return result;
  }
  return null;
}
test("layout JEC conserva el Herdr original y cambia solo la vista central", () => {
  const data = JSON.parse(read("layouts/jec-chat.json"));
  assert.equal(find(data, "tabs").content.mod, "tabs");
  assert.equal(find(data, "agents").content.mod, "agents");
  assert.equal(find(data, "spaces").content.mod, "spaces");
  assert.equal(find(data, "panel-body").active, "files");
  const stage = find(data, "jec-view");
  assert.equal(stage.type, "stack");
  assert.equal(stage.active, "main");
  assert.equal(stage.children.length, 2);
  assert.equal(find(data, "main").content.tab, "active");
  assert.equal(find(data, "main").content.pane.header.content.mod, "jec-pane");
  assert.equal(find(data, "jec-chat-view").content.mod, "jec-chat");
  assert.equal(find(data, "jec-chat-view").content.props.embedded, true);
});
test("mods JEC no se acoplan al nombre de la terminal ni anulan el layout base", () => {
  for (const name of ["jec-chat", "jec-pane"]) {
    const mod = JSON.parse(read(`mods/${name}/mod.json`));
    assert.equal(mod.place, "none");
  }
  const pane = read("mods/jec-pane/main.js");
  assert.match(pane, /setShared\("jec\.chat\.target"/);
  assert.match(pane, /localCodex\(p\)/);
  assert.match(pane, /stack: "jec-view", child: "jec-chat-view"/);
  const chat = read("mods/jec-chat/main.js");
  assert.match(chat, /stack: "jec-view", child: "main"/);
  assert.match(chat, /candidate\.terminal === wanted\.terminal/);
});
