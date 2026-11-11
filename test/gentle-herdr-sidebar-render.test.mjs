import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(new URL("../mods/gentle-herdr-sidebar/main.js", import.meta.url), "utf8");

test("running jobs are grouped under Agents & Jobs, not a separate section", () => {
  assert.match(source, /const title = "Agents & Jobs"/);
  assert.match(source, /section\("Agents & Jobs"/);
  assert.match(source, /output\.push\(\.\.\.jobDetails\(snapshot, t, jobs\)\)/);
  assert.doesNotMatch(source, /section\("Jobs"/);
});

test("empty Agents & Jobs section shows a muted empty state", () => {
  assert.match(source, /text_color\(t\.dim\)\.child\("No active agents or jobs"\)/);
});

test("fill-available sections give their child container a constrained flex height", () => {
  const start = source.indexOf("function section(");
  const end = source.indexOf("function stateLabel(", start);
  const section = source.slice(start, end);
  assert.match(section, /if \(fillAvailable\) container\.flex_1\(\)\.min_h\(0\)/);
});

test("Status omits the Folder, Branch, State, Model / Effort, and Context rows", () => {
  const start = source.indexOf("function statusRows(");
  const end = source.indexOf("function agentItems(", start);
  const statusRows = source.slice(start, end);
  for (const label of ["Folder", "Branch", "State", "Model / Effort"]) {
    assert.doesNotMatch(statusRows, new RegExp(`row\\(\\"${label}\\"`));
  }
  assert.doesNotMatch(statusRows, /contextUsageRow/);
});
