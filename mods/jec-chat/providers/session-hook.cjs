"use strict";
// Codex hook: report the active root thread to the *same* Herdr terminal.
// Only the identifier and transcript path are stored, never the prompt.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const LABEL = "jec.chat.codex";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hc(args) {
  const r = spawnSync("hc", args, { encoding: "utf8", timeout: 1100, windowsHide: true, maxBuffer: 1024*1024 });
  return r.status === 0 ? r.stdout : null;
}
function apply(input, env = process.env, call = hc) {
  const terminal = env.HC_TERMINAL_ID;
  if (!terminal || !/^t[0-9a-z]+$/i.test(terminal) || !UUID.test(input?.session_id ?? "") || input.agent_id) return false;
  const event = input.hook_event_name;
  const id = input.session_id.toLowerCase();
  if (event === "SessionEnd") {
    // Don't clear a new thread's registration when the previous thread ends.
    const raw = call(["get", terminal, "--json"]);
    if (!raw) return false;
    const response = JSON.parse(raw);
    const record = response.terminal ?? response.record ?? response;
    let current;
    try { current = JSON.parse(record.labels?.[LABEL] ?? "null"); } catch { return false; }
    if (current?.id !== id) return false;
    return call(["label", terminal, LABEL + "="]) !== null;
  }
  if (!["SessionStart", "UserPromptSubmit", "Stop"].includes(event)) return false;
  if (typeof input.cwd !== "string" || !path.isAbsolute(input.cwd)) return false;
  const file = typeof input.transcript_path === "string" && path.isAbsolute(input.transcript_path)
    ? input.transcript_path : null;
  // A null path is valid before Codex creates its first rollout. Subsequent
  // prompt hooks will publish the actual path.
  const value = JSON.stringify({ id, file, cwd: input.cwd });
  return call(["label", terminal, LABEL + "=" + value]) !== null;
}
if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", part => { if (raw.length < 1024*1024) raw += part; });
  process.stdin.on("end", () => {
    try { apply(JSON.parse(raw)); } catch { /* Fail open; never block Codex. */ }
  });
}
module.exports = { apply, LABEL };
