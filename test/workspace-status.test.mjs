import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

test("workspace status shares row width proportionally and truncates long labels", () => {
  const layout = JSON.parse(readFileSync(new URL("../layouts/javijec.json", import.meta.url), "utf8"));
  const statusRow = findNode(layout, "status-row");
  const statusBlock = statusRow?.children.find((item) => item.id === "status");
  assert.equal(statusBlock?.size?.weight, 2);
  assert.equal(statusBlock?.min, 170);

  const source = readFileSync(new URL("../mods/workspace-status/main.js", import.meta.url), "utf8");
  assert.match(source, /min_w\(0\)\.truncate\(\)/);
});
