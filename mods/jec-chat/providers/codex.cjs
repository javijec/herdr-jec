"use strict";
// Read-only Codex rollout reader. Node 20+, no third-party packages, no network.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const MAX_FILES = 4000;
const MAX_ROWS = 80;
const MAX_ROW_CHARS = 12000;
const MAX_JSON_BYTES = 700000;
const MAX_SESSION_BYTES = 100 * 1024 * 1024;

function samePath(a, b) {
  if (!a || !b) return false;
  const normalize = (v) => path.normalize(path.resolve(v)).replace(/[\\/]+$/, "");
  const x = normalize(a), y = normalize(b);
  return process.platform === "win32" ? x.toLowerCase() === y.toLowerCase() : x === y;
}
function store() {
  const base = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return path.resolve(base, "sessions");
}
function under(root, file) {
  const rel = path.relative(root, file);
  return rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
}
async function head(file) {
  const handle = await fsp.open(file, "r");
  try {
    const data = Buffer.alloc(65536);
    const { bytesRead } = await handle.read(data, 0, data.length, 0);
    for (const line of data.toString("utf8", 0, bytesRead).split(/\r?\n/).slice(0, 5)) {
      if (!line) continue;
      try {
        const x = JSON.parse(line);
        if (x.type === "session_meta" && typeof x.payload?.cwd === "string"
            && typeof x.payload?.id === "string") return x.payload;
      } catch { /* an incomplete final line is normal */ }
    }
    return null;
  } finally { await handle.close(); }
}
async function scan(root, cwd) {
  const found = [];
  const dirs = [root];
  let inspected = 0;
  while (dirs.length && inspected < MAX_FILES) {
    const dir = dirs.pop();
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
    catch (e) { if (e.code === "ENOENT") continue; throw e; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { dirs.push(full); continue; }
      if (!entry.isFile() || !/^rollout-.*\.jsonl$/.test(entry.name)) continue;
      if (++inspected > MAX_FILES) break;
      const stat = await fsp.stat(full).catch(() => null);
      if (!stat || stat.size > MAX_SESSION_BYTES || stat.size === 0) continue;
      const meta = await head(full).catch(() => null);
      if (!meta || !samePath(meta.cwd, cwd)) continue;
      found.push({ id: meta.id, file: full, cwd: meta.cwd,
        updatedAt: stat.mtime.toISOString(), startedAt: meta.timestamp ?? null });
    }
  }
  found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { sessions: found.slice(0, 30), scanned: inspected,
    limited: inspected >= MAX_FILES, total: found.length };
}
function blocks(content) {
  if (!Array.isArray(content)) return "";
  return content.filter(x => x && /(?:input_text|output_text|text)$/.test(x.type ?? "")
    && typeof x.text === "string").map(x => x.text).join("\n").trim();
}
function cap(s) { return s.length > MAX_ROW_CHARS ? s.slice(0, MAX_ROW_CHARS) + "\n\n… (recortado)" : s; }
async function transcript(file) {
  const response = [], usersByEvent = [], usersByItem = [], assistantByEvent = [];
  let order = 0;
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      ++order;
      if (!line || line.length > 2000000) continue;
      let x; try { x = JSON.parse(line); } catch { continue; }
      const p = x.payload ?? {};
      if (x.type === "event_msg") {
        if (p.type === "user_message" && typeof p.message === "string") {
          usersByEvent.push({ order, role: "user", text: cap(p.message), time: x.timestamp });
        } else if (p.type === "agent_message" && typeof p.message === "string") {
          assistantByEvent.push({ order, role: "assistant", text: cap(p.message), time: x.timestamp });
        }
      } else if (x.type === "response_item") {
        if (p.type === "message") {
          const value = blocks(p.content);
          if (!value) continue;
          const item = { order, role: p.role, text: cap(value), time: x.timestamp,
            phase: p.phase ?? null };
          if (p.role === "user") usersByItem.push(item);
          if (p.role === "assistant") response.push(item);
        } else if (["function_call", "custom_tool_call", "local_shell_call", "web_search_call"].includes(p.type)) {
          const name = p.name ?? (p.type === "local_shell_call" ? "shell" : p.type === "web_search_call" ? "web_search" : "tool");
          response.push({ order, role: "tool", text: String(name).slice(0, 120), time: x.timestamp });
        }
      }
    }
  } finally { lines.close(); stream.destroy(); }
  // Prefer the events intended for the human's input, and native response items
  // for assistant messages: mixing both sources duplicates the same conversation.
  const rows = [
    ...(usersByEvent.length ? usersByEvent : usersByItem),
    ...(response.some(x => x.role === "assistant") ? response : assistantByEvent),
  ].filter(x => typeof x.text === "string" && x.text.trim());
  rows.sort((a, b) => a.order - b.order);
  // Limit the result's size and number of rows to keep Herdr's exec response bounded.
  const tail = [];
  let budget = MAX_JSON_BYTES;
  for (let i = rows.length - 1; i >= 0 && tail.length < MAX_ROWS; i--) {
    const row = rows[i];
    const text = row.text.slice(0, Math.min(budget, MAX_ROW_CHARS));
    if (!text) break;
    budget -= text.length + 220;
    tail.push({ role: row.role, text, phase: row.phase ?? null, time: row.time });
    if (budget <= 0) break;
  }
  return { messages: tail.reverse(), total: rows.length, truncated: rows.length > tail.length };
}
async function main(argv) {
  const mode = argv[0], cwdAt = argv.indexOf("--cwd");
  const cwd = cwdAt >= 0 ? argv[cwdAt + 1] : null;
  if (!cwd || !path.isAbsolute(cwd)) throw new Error("Falta una carpeta absoluta de la terminal.");
  const root = store();
  if (mode === "list") return { ok: true, ...await scan(root, cwd) };
  if (mode === "read") {
    const fileAt = argv.indexOf("--file");
    const file = fileAt >= 0 ? argv[fileAt + 1] : null;
    if (!file || !path.isAbsolute(file) || !under(root, path.resolve(file)))
      throw new Error("Archivo de sesion no permitido.");
    const stat = await fsp.lstat(file);
    if (!stat.isFile() || stat.size > MAX_SESSION_BYTES) throw new Error("Archivo de sesion invalido.");
    const meta = await head(file);
    if (!meta || !samePath(meta.cwd, cwd)) throw new Error("La sesion no coincide con la carpeta seleccionada.");
    return { ok: true, id: meta.id, ...await transcript(file) };
  }
  throw new Error("Comando desconocido.");
}
if (require.main === module) {
  main(process.argv.slice(2)).then(x => process.stdout.write(JSON.stringify(x) + "\n"))
    .catch(e => { process.stderr.write(String(e?.message ?? e) + "\n"); process.exitCode = 1; });
}
module.exports = { samePath, scan, head, transcript, main };
