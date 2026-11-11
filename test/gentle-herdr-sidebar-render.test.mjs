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
