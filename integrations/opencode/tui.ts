// JEC Chat — OpenCode v2 TUI plugin. Reads ONLY this client's active route.
// No network listener, no database scan, no prompts sent by the plugin.
// The snapshot is bounded, local, replaced atomically and expires quickly.
import { mkdirSync, writeFileSync, renameSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

export const ID = /^ses_[a-zA-Z0-9_-]{1,120}$/;
export const TERMINAL = /^t[0-9a-z]+$/i;
const MAX_ROWS = 80, MAX_TEXT = 12000, MAX_BYTES = 500000;
export function normalizeMessages(raw) {
  const rows = [];
  let clipped = false;
  const push = (role, value, message, phase) => {
    if (typeof value !== "string" || !value.trim()) return;
    if (value.length > MAX_TEXT) clipped = true;
    const time = typeof message?.time?.created === "number" ? message.time.created : null;
    rows.push({ role, text: value.slice(0, MAX_TEXT), time, ...(phase ? {phase} : {}) });
  };
  for (const m of Array.isArray(raw) ? raw : []) {
    if (m?.type === "user") push("user", m.text, m);
    if (m?.type === "assistant") {
      // Do not export internal reasoning, tool inputs/outputs, native replay data,
      // attachments, metadata, system/synthetic instructions or subagent history.
      for (const part of Array.isArray(m.content) ? m.content : []) {
        if (part?.type === "text") push("assistant", part.text, m, m.time?.completed ? "final_answer" : "commentary");
        if (part?.type === "tool" && typeof part.name === "string") {
          const state = ["streaming","running","completed","error"].includes(part.state?.status) ? part.state.status : "";
          push("tool", part.name.slice(0,160) + (state ? " · " + state : ""), m);
        }
      }
    }
  }
  const total = rows.length;
  const messages = rows.slice(-MAX_ROWS);
  let bytes = Buffer.byteLength(JSON.stringify(messages), "utf8");
  while (bytes > MAX_BYTES && messages.length) {
    messages.shift();
    bytes = Buffer.byteLength(JSON.stringify(messages), "utf8");
  }
  return {messages, total, truncated: clipped || messages.length < total};
}
export function capture(context) {
  const route = context.ui.router.current();
  if (route?.type !== "session" || !ID.test(route.sessionID ?? "")) return { reason: "open_session" };
  const id = route.sessionID;
  const info = context.data.session.get(id);
  if (!info || info.id !== id) return {reason: "session_loading"};
  if (info.parentID) return {reason:"root_required"};
  const cwd = info.location?.directory;
  if (typeof cwd !== "string" || !cwd) return {reason:"location_missing"};
  const messages = context.data.session.message.list(id);
  if (!Array.isArray(messages)) return {reason:"history_loading"};
  // The TUI's own active session is the source of identity. Never infer by cwd.
  const running = context.data.session.status(id);
  const permissions = context.data.session.permission.list(id);
  const forms = context.data.session.form.list(id);
  const blocked = (Array.isArray(permissions) && permissions.length > 0)
    || (Array.isArray(forms) && forms.length > 0);
  return {
    id, cwd,
    status: blocked ? "blocked" : running === "running" ? "working" : running === "idle" ? "idle" : null,
    data: normalizeMessages(messages)
  };
}
export default {
  id: "jec-chat-opencode",
  setup(context) {
    const terminal = process.env.HC_TERMINAL_ID;
    if (!TERMINAL.test(terminal ?? "")) return;
    const directory = join(process.env.HERDR_APP_HOME || join(homedir(), ".config", "herdr-app"), "data", "jec-chat-opencode");
    const generation = randomUUID();
    const file = join(directory, terminal + ".json");
    const temp = join(directory, terminal + "." + generation + ".tmp");
    let disposed = false;
    try { mkdirSync(directory, { recursive:true, mode:0o700 }); } catch { return; }
    function publish() {
      if (disposed) return;
      let payload;
      try { payload = capture(context); } catch { payload = { reason:"tui_api_unavailable" }; }
      const record = {version:1, provider:"opencode", terminal, generation, at:Date.now(), ...payload};
      try {
        writeFileSync(temp, JSON.stringify(record), {encoding:"utf8",mode:0o600});
        renameSync(temp, file);
      } catch { /* A stale snapshot cannot authorize delivery; retry next tick. */ }
    }
    publish();
    const timer = setInterval(publish, 1000);
    // Do not hold the TUI alive after exit.
    timer.unref?.();
    return () => {
      disposed = true;
      clearInterval(timer);
      try { unlinkSync(temp); } catch {}
      try {
        if (JSON.parse(readFileSync(file,"utf8")).generation === generation) unlinkSync(file);
      } catch {}
    };
  },
};
