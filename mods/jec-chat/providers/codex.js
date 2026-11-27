import { appHome, exec, hc } from "herdr";
import { resumedId, visibleMatch } from "./match.js";

// Node runs as a short-lived subprocess. Herdr mods have no Node process APIs.
const script = () => appHome().replace(/[\\/]$/, "") + "/mods/jec-chat/providers/codex.cjs";

async function invoke(mode, cwd, file) {
  const args = [script(), mode, "--cwd", cwd];
  if (file) args.push("--file", file);
  const r = await exec("node", args, { timeout: 15000 });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || "No se pudo leer Codex").trim().slice(0, 800));
  try {
    const data = JSON.parse(r.stdout);
    if (!data.ok) throw new Error(data.error || "Error leyendo Codex");
    return data;
  } catch (e) {
    throw new Error("El lector de Codex devolvio una respuesta invalida: " + String(e.message ?? e).slice(0, 300));
  }
}
export const listSessions = (cwd) => invoke("list", cwd);
export const readSession = (cwd, file) => invoke("read", cwd, file);

// Ask *this terminal* what it displays and which command owns it. Never pick
// the newest file just because it is in the same working directory.
export async function resolveCurrentSession(cwd, address, sessions) {
  if (!address || !cwd || !sessions?.length) return null;
  let explicit = null;
  try {
    const info = await hc(["get", address, "--json"]);
    if (info.code === 0) {
      const id = resumedId(JSON.parse(info.stdout));
      if (id) explicit = sessions.find(s => s.id?.toLowerCase() === id) ?? null;
    }
  } catch { /* Older cores may not expose foreground argv. */ }

  // Read the terminal's real screen (incl. a limited scrollback); don't
  // accidentally read a mod pane or another agent in the same folder.
  let screen = "";
  try {
    const read = await hc(["read", address, "--lines", "80"]);
    if (read.code === 0) screen = read.stdout.slice(-48000);
  } catch { /* TUI may have closed since the header was clicked. */ }

  if (screen && sessions.length <= 10) {
    const records = [];
    try {
      // If any candidate fails to read, the sample is incomplete, so it
      // cannot prove uniqueness. Fall back to explicit resume or the picker.
      for (const session of sessions) {
        const result = await readSession(cwd, session.file);
        records.push({ id: session.id, messages: result.messages });
      }
      const match = visibleMatch(screen, records);
      if (match) {
        const selected = sessions.find(s => s.id === match.id);
        return selected ? { session: selected, method: match.method } : null;
      }
    } catch { /* Not enough evidence. */ }
  }
  // argv 'codex resume <UUID>' is explicit (never --last, never just cwd).
  // It may still become stale after /new in the same TUI, hence the screen
  // match above takes priority when it establishes another active thread.
  return explicit ? { session: explicit, method: "identificador de Codex" } : null;
}
