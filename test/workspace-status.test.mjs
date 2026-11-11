import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const workspaceChromeSource = readFileSync(join(root, "mods/workspace-chrome/main.js"), "utf8");
const workspaceStatusSource = readFileSync(join(root, "mods/workspace-status/main.js"), "utf8");

function findNode(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

test("the command shortcut is rendered beside Settings in the footer", () => {
  const footerStart = workspaceChromeSource.indexOf("if (props()?.footer)");
  const footerEnd = workspaceChromeSource.indexOf("return h_flex().size_full()", footerStart);
  const footer = workspaceChromeSource.slice(footerStart, footerEnd);
  assert.match(footer, /id\("palette"\)/);
  assert.match(footer, /run\("app\.palette"\)/);
  assert.doesNotMatch(workspaceStatusSource, /id\("palette"\)/);
});

test("workspace status shares row width proportionally and truncates long labels", () => {
  const layout = JSON.parse(readFileSync(new URL("../layouts/javijec.json", import.meta.url), "utf8"));
  const statusRow = findNode(layout, "status-row");
  const statusBlock = statusRow?.children.find((item) => item.id === "status");
  assert.equal(statusBlock?.size?.weight, 2);
  assert.equal(statusBlock?.min, 170);

  const source = readFileSync(new URL("../mods/workspace-status/main.js", import.meta.url), "utf8");
  assert.match(source, /flex_1\(\)\.min_w\(0\)\.truncate\(\)/);
});
