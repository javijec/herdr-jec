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

test("TODO rows use Machine-style chevrons and per-item disclosure reveals notes", () => {
  const start = source.indexOf("function todoDetails(");
  const end = source.indexOf("function jobItems(", start);
  const todoDetails = source.slice(start, end);
  assert.match(todoDetails, /expandedItems\.has\(todoKey\)/);
  assert.match(todoDetails, /onToggleTodo\(todoKey\)/);
  assert.match(todoDetails, /todoDisclosureIcon\(itemExpanded, t\)/);
  assert.match(todoDetails, /\.when\(itemExpanded && Boolean\(note\)/);
  assert.doesNotMatch(todoDetails, /itemExpanded \? "⌄" : ">"/);
});

test("TODO status indicators omit text labels and color in-progress as working", () => {
  const start = source.indexOf("function todoDetails(");
  const end = source.indexOf("function jobItems(", start);
  const todoDetails = source.slice(start, end);
  assert.doesNotMatch(todoDetails, /state\.replace\("_", " "\)/);
  assert.match(todoDetails, /todoStatusColor\(t, state\)/);
  assert.match(source, /function todoStatusColor\(t, state\) \{\s*return state === "in_progress" \? t\.working : statusColor\(t, state\);/);
  assert.match(source, /state === "blocked" \|\| state === "failed" \|\| state === "timed_out"\) return t\.blocked/);
  assert.match(source, /state === "done" \|\| state === "completed"\) return t\.done/);
});

test("sidebar omits Status whether a bridge snapshot is present or unavailable", () => {
  assert.doesNotMatch(source, /section\(\"Status\"/);
});
