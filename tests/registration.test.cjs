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
  assert.deepEqual(await registeredSession(cwd,"t1q"),{pending:true,id:ID,status:null});
  assert.equal(calls.length,1);
  entry=null;
  assert.equal(await registeredSession(cwd,"t1q"),null);
});

test("send verifies the registered session and idle status, then sends the literal prompt exactly once", async () => {
  const { setMocks, sendPrompt } = await provider();
  const cwd = path.resolve(".");
  const file = path.resolve("rollout-" + ID + ".jsonl");
  const session = { id:ID, file, cwd };
  const target = { terminal:"t1q", isCodex:true, machine:null, cwd };
  let record = { state:"live", address:"t1q", status:"idle", labels:{ "jec.chat.codex": JSON.stringify(session) } };
  const calls = [];
  let sendResult = {code:0,stdout:JSON.stringify({turn:1,started:true,status:"working"})};
  setMocks({ hc(args) {
    calls.push(args);
    return args[0] === "get" ? {code:0,stdout:JSON.stringify(record)} : sendResult;
  } });
  const prompt = 'Hola, "Codex".\nSegunda línea';
  assert.equal((await sendPrompt(target,session,prompt)).started,true);
  assert.deepEqual(calls,[["get","t1q","--json"],["send","--if","idle","--json","--","t1q",prompt]]);
  calls.length = 0;
  record.status = "done";
  record.report = {state:"idle"};
  assert.equal((await sendPrompt(target,session,prompt)).started,true);
  assert.deepEqual(calls,[["get","t1q","--json"],["send","--json","--","t1q",prompt]]);
  delete record.report;
  for (const state of ["working","blocked","error",null]) {
    calls.length = 0;
    record.status = state;
    await assert.rejects(sendPrompt(target,session,prompt),/no está listo/);
    assert.equal(calls.length,1);
  }
  record.status = "idle";
  calls.length = 0;
  await assert.rejects(sendPrompt(target,session,prompt,()=>false),/panel activo/);
  assert.equal(calls.length,1);
  calls.length = 0;
  record.labels = {};
  await assert.rejects(sendPrompt(target,session,prompt),/sesión cambió/);
  assert.equal(calls.length,1);
  record.labels = {"jec.chat.codex":JSON.stringify(session)};
  calls.length = 0;
  sendResult = {code:1,stdout:"",stderr:"failed"};
  await assert.rejects(sendPrompt(target,session,prompt),/no confirmó/);
  assert.equal(calls.length,2);
});
test("send rejects manual history, remote targets, shell commands, and terminal control characters", async () => {
  const { setMocks, sendPrompt, validatePrompt } = await provider();
  setMocks({hc(){ throw Error("must not call Herdr"); }});
  const cwd = path.resolve("."), target = {terminal:"t1q",isCodex:true,cwd};
  const session = {id:ID,file:path.resolve("rollout.jsonl")};
  for (const prompt of ["", "  ", "/new", " !whoami", "x\x1by", "x".repeat(16001)])
    assert.throws(()=>validatePrompt(prompt));
  assert.equal(validatePrompt("Hola\r\nmundo"),"Hola\nmundo");
  await assert.rejects(sendPrompt({...target,machine:"server"},session,"hola"),/terminal local/);
  await assert.rejects(sendPrompt(target,null,"hola"),/terminal local/);
});

test("core status uses the explicit status before report fallback", async () => {
  const { terminalStatus } = await provider();
  assert.equal(terminalStatus({status:"done",report:{state:"idle"}}),"done");
  assert.equal(terminalStatus({report:{state:"idle"}}),"idle");
  assert.equal(terminalStatus({status:{state:"working"}}),"working");
  assert.equal(terminalStatus({status:"IDLE"}),"idle");
  assert.equal(terminalStatus({}),null);
});
