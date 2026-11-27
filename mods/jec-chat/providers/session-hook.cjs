"use strict";
// Codex hook: report the active root thread to the *same* Herdr terminal.
// Only the identifier and transcript path are stored, never the prompt.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const LABEL = "jec.chat.codex";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hc(args, report = {}) {
  const r = spawnSync("hc", args, { encoding: "utf8", timeout: 1200, windowsHide: true, maxBuffer: 1024*1024 });
  report.hcCommand = args[0];
  report.hcExitCode = r.status;
  if (r.error) report.hcError = r.error.code || "spawn_failed";
  if (r.status !== 0 && !r.error) report.hcError = "nonzero_exit";
  return r.status === 0 ? r.stdout : null;
}
function apply(input, env = process.env, call = hc, report = {}) {
  const terminal = env.HC_TERMINAL_ID;
  report.event = input?.hook_event_name ?? null;
  report.terminal = typeof terminal === "string" && /^t[0-9a-z]+$/i.test(terminal) ? terminal : null;
  report.hasTerminalEnv = Boolean(terminal);
  if (!terminal) { report.reason = "missing_HC_TERMINAL_ID"; return false; }
  if (!report.terminal) { report.reason = "invalid_terminal_id"; return false; }
  if (!UUID.test(input?.session_id ?? "")) { report.reason = "invalid_session_id"; return false; }
  if (input.agent_id) { report.reason = "subagent_ignored"; return false; }
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
  if (!["SessionStart", "UserPromptSubmit", "Stop"].includes(event)) { report.reason = "unsupported_event"; return false; }
  if (typeof input.cwd !== "string" || !path.isAbsolute(input.cwd)) { report.reason = "invalid_cwd"; return false; }
  const file = typeof input.transcript_path === "string" && path.isAbsolute(input.transcript_path)
    ? input.transcript_path : null;
  // A null path is valid before Codex creates its first rollout. Subsequent
  // prompt hooks will publish the actual path.
  const value = JSON.stringify({ id, file, cwd: input.cwd });
  const ok = call(["label", terminal, LABEL + "=" + value]) !== null;
  report.hasTranscriptPath = Boolean(file);
  report.reason = ok ? "registered" : "hc_label_failed";
  return ok;
}
if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", part => { if (raw.length < 1024*1024) raw += part; });
  process.stdin.on("end", () => {
    const report = { at: new Date().toISOString(), ok: false };
    try {
      report.ok = apply(JSON.parse(raw), process.env, args => hc(args, report), report);
    } catch { report.reason = "hook_exception"; }
    // Diagnostics are local and deliberately exclude prompts, paths, argv,
    // raw stdin, credentials and hc output. No stdout injected into Codex.
    try {
      const home = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
      const target = path.join(home, "jec-hook-status.json");
      fs.writeFileSync(target, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    } catch { /* Fail open; never block Codex. */ }
  });
}
module.exports = { apply, LABEL };
