"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { apply, LABEL } = require("../mods/jec-chat/providers/session-hook.cjs");
const { merge, install, commandFor } = require("../mods/jec-chat/providers/install-hooks.cjs");
const ID = "01a21c73-5584-4b01-99fb-91910bb771b6";
const OTHER = "01a1f521-b737-42e1-91f6-8dcc61759900";
const cwd = path.resolve(os.tmpdir(), "jec-project");
const file = path.join(cwd, "rollout-" + ID + ".jsonl");
const env = { HC_TERMINAL_ID: "t1q" };
function mockCore() {
  const labels = {};
  const calls = [];
  return { labels, calls, call(args) {
    calls.push(args);
    if (args[0] === "get") return JSON.stringify({ labels });
    if (args[0] === "label") {
      assert.equal(args[1], "t1q");
      const arg = args[2], ix = arg.indexOf("=");
      if (arg.slice(ix+1)) labels[arg.slice(0,ix)] = arg.slice(ix+1);
      else delete labels[arg.slice(0,ix)];
      return "";
    }
    throw Error("Unexpected hc command");
  } };
}
test("hooks bind the terminal to the session, update its file, and clear only its own registration", () => {
  const core = mockCore();
  const event = (name, id, transcript_path = file, extra = {}) => ({
    hook_event_name: name, session_id: id, transcript_path, cwd, ...extra
  });
  assert.equal(apply(event("SessionStart", ID, null), env, core.call), true);
  assert.deepEqual(JSON.parse(core.labels[LABEL]), { id: ID, file: null, cwd });
  assert.equal(apply(event("Stop", ID), env, core.call), true);
  assert.deepEqual(JSON.parse(core.labels[LABEL]), { id: ID, file, cwd });
  assert.equal(apply(event("UserPromptSubmit", OTHER, file, { agent_id: "child" }), env, core.call), false);
  assert.equal(apply(event("SessionStart", OTHER, null), env, core.call), true);
  assert.equal(apply(event("SessionEnd", ID), env, core.call), false);
  assert.equal(JSON.parse(core.labels[LABEL]).id, OTHER);
  assert.equal(apply(event("SessionEnd", OTHER), env, core.call), true);
  assert.equal(core.labels[LABEL], undefined);
});
test("hook never writes labels for missing Herdr env or invalid events", () => {
  const core = mockCore();
  const input = { hook_event_name: "SessionStart", session_id: ID, transcript_path: file, cwd };
  assert.equal(apply(input, {}, core.call), false);
  assert.equal(apply(input, { HC_TERMINAL_ID: "machine/t1q" }, core.call), false);
  assert.equal(apply({ ...input, session_id: "invalid" }, env, core.call), false);
  assert.equal(apply({ ...input, hook_event_name: "SubagentStart" }, env, core.call), false);
  assert.equal(core.calls.length, 0);
});
test("install preserves existing hooks and is idempotent", () => {
  const old = { description: "existing", hooks: { SessionStart: [{ matcher: "startup", hooks: [{ type:"command", command:"existing" }] }], PreToolUse: [] } };
  const snapshot = structuredClone(old.hooks.SessionStart[0]);
  assert.equal(merge(old, "node hook.cjs"), true);
  assert.deepEqual(old.hooks.SessionStart[0], snapshot);
  assert.deepEqual(old.hooks.PreToolUse, []);
  assert.equal(old.description, "existing");
  for (const name of ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"]) {
    const count = old.hooks[name].flatMap(g => g.hooks).filter(h => h.command === "node hook.cjs").length;
    assert.equal(count, 1);
  }
  assert.equal(merge(old, "node hook.cjs"), false);
  assert.equal(commandFor("C:\\Users\\Example Name\\hook.cjs", "win32", "C:\\Program Files\\nodejs\\node.exe"), "$OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::In.ReadToEnd() | & 'C:\\Program Files\\nodejs\\node.exe' 'C:\\Users\\Example Name\\hook.cjs'; exit $LASTEXITCODE");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "jec-hooks-"));
  try {
    const target = path.join(home, "hooks.json");
    const original = JSON.stringify({ hooks: { PreToolUse: [] } });
    fs.writeFileSync(target, original);
    assert.equal(install(home, path.join(home,"session-hook.cjs")), true);
    const backups = fs.readdirSync(home).filter(n => n.startsWith("hooks.json.jec-backup-"));
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(home, backups[0]), "utf8"), original);
    assert.equal(install(home, path.join(home,"session-hook.cjs")), false);
    fs.writeFileSync(target, "{broken");
    assert.throws(() => install(home, path.join(home,"session-hook.cjs")));
    assert.equal(fs.readFileSync(target,"utf8"), "{broken");
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("hook reports a missing terminal environment and failed label without storing prompts", () => {
  const input = { hook_event_name: "UserPromptSubmit", session_id: ID, cwd, transcript_path: file, prompt: "private text" };
  const missing = {};
  assert.equal(apply(input, {}, () => { throw Error("unexpected call"); }, missing), false);
  assert.equal(missing.reason, "missing_HC_TERMINAL_ID");
  const failed = {};
  assert.equal(apply(input, env, () => null, failed), false);
  assert.equal(failed.reason, "hc_label_failed");
  assert.equal(failed.terminal, "t1q");
  assert.equal(failed.hasTranscriptPath, true);
  assert.equal(JSON.stringify(failed).includes(input.prompt), false);
  const good = {};
  assert.equal(apply(input, env, () => "", good), true);
  assert.equal(good.reason, "registered");
});

test("migration replaces only the exact legacy JEC hook and does not duplicate it", () => {
  const oldCommand = 'node "C:/Example/hook.cjs"';
  const newCommand = '"C:\\Program Files\\nodejs\\node.exe" "C:\\Example\\hook.cjs"';
  const config = { hooks: { Stop: [{ hooks: [
    {type:"command",command:oldCommand,timeout:5},
    {type:"command",command:"unrelated"}
  ] }] } };
  assert.equal(merge(config,newCommand,oldCommand),true);
  assert.deepEqual(config.hooks.Stop[0].hooks.map(h=>h.command),[newCommand,"unrelated"]);
  assert.equal(config.hooks.Stop.length,1);
  assert.equal(merge(config,newCommand,oldCommand),false);
});

test("PowerShell launches the actual Windows hook and forwards the JSON on stdin", {skip: process.platform !== "win32"}, () => {
  const { spawnSync } = require("node:child_process");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "jec hook test "));
  try {
    const hook = path.join(home, "test-hook.cjs");
    fs.writeFileSync(hook, "const fs=require('node:fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(input.prompt);");
    const command = commandFor(hook);
    for (const shell of ["powershell.exe","pwsh.exe"]) {
      const result = spawnSync(shell,["-NoProfile","-NonInteractive","-Command",command],{
        input:JSON.stringify({prompt:"sesión"}),encoding:"utf8",timeout:15000,windowsHide:true
      });
      if (shell==="pwsh.exe" && result.error?.code==="ENOENT") continue;
      assert.equal(result.status,0,result.stderr || String(result.error));
      assert.equal(result.stdout,"sesión");
    }
  } finally { fs.rmSync(home,{recursive:true,force:true}); }
});
