"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ID = "01a21c73-5584-4b01-99fb-91910bb771b6";
async function provider() {
  const source = fs.readFileSync(path.join(__dirname,"../mods/jec-chat/providers/codex.js"),"utf8")
    .replace('import { appHome, exec, hc } from "herdr";', 'let mocks; export const setMocks = m => { mocks = m; }; const appHome = () => "/app"; const exec = (...a) => mocks.exec(...a); const hc = (...a) => mocks.hc(...a);')
    .replace('import { resumedId, visibleMatch } from "./match.js";', 'const resumedId = () => null, visibleMatch = () => null;');
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(source));
}
test("registration reads only the registered rollout, never lists sessions or reads the terminal", async () => {
  const { setMocks, registeredSession } = await provider();
  const file = path.resolve("rollout-" + ID + ".jsonl");
  const cwd = path.resolve(".");
  const calls = [];
  let entry = { id: ID, cwd, file };
  setMocks({
    hc(args) {
      calls.push(args);
      return { code: 0, stdout: JSON.stringify({ state:"live", labels: { "jec.chat.codex": JSON.stringify(entry) } }) };
    },
    exec(cmd, args) {
      calls.push([cmd,...args]);
      return { code:0, stdout: JSON.stringify({ ok:true, id:ID, messages:[{role:"user",text:"hola"}],total:1}) };
    }
  });
  const result = await registeredSession(cwd,"t1q");
  assert.equal(result.session.id,ID);
  assert.equal(result.data.messages[0].text,"hola");
  assert.deepEqual(calls[0],["get","t1q","--json"]);
  assert.equal(calls[1][2],"read");
  assert.deepEqual(calls[1].slice(-2),["--id",ID]);
  assert.equal(calls.length,2);
  calls.length=0;
  entry={...entry,file:null};
  assert.deepEqual(await registeredSession(cwd,"t1q"),{pending:true,id:ID});
  assert.equal(calls.length,1);
  entry=null;
  assert.equal(await registeredSession(cwd,"t1q"),null);
});
