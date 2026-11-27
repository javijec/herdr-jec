import { appHome, exec, hc } from "herdr";
import { resumedId, visibleMatch } from "./match.js";

// Node runs as a short-lived subprocess. Herdr mods have no Node process APIs.
const script = () => appHome().replace(/[\\/]$/, "") + "/mods/jec-chat/providers/codex.cjs";

async function invoke(mode, cwd, file, id) {
  const args = [script(), mode, "--cwd", cwd];
  if (file) args.push("--file", file);
  if (id) args.push("--id", id);
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
export const readSession = (cwd, file, id) => invoke("read", cwd, file, id);

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

// Read the native label written by Codex's hook. No session discovery or TUI
// text comparison on the normal path. The reader validates the UUID and cwd.
export function registration(labels) {
  try {
    const data = JSON.parse(labels?.["jec.chat.codex"] ?? "null");
    if (!data || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)
      || typeof data.cwd !== "string") return null;
    return { id: data.id.toLowerCase(), file: typeof data.file === "string" && data.file ? data.file : null, cwd: data.cwd };
  } catch { return null; }
}
export async function registeredSession(cwd, address) {
  let entry;
  try {
    const result = await hc(["get", address, "--json"]);
    if (result.code !== 0) return null;
    const info = JSON.parse(result.stdout);
    const record = info.terminal ?? info.record ?? info;
    if (record.state && record.state !== "live") return null;
    entry = registration(record.labels);
  } catch { return null; }
  if (!entry) return null;
  if (!entry.file) return { pending: true, id: entry.id };
  try {
    const data = await readSession(cwd, entry.file, entry.id);
    return { session: { id: entry.id, file: entry.file, cwd: entry.cwd }, data, method: "registro Codex" };
  } catch {
    // Path may not yet exist; never silently attach a different thread.
    return { pending: true, id: entry.id };
  }
}

// Keep the interactive path separate from discovery. A manually picked
// transcript is never sufficient authority to send into a live terminal.
export function terminalStatus(record) {
  return typeof record?.status === "string" ? record.status
    : record?.status?.state ?? record?.report?.state ?? null;
}
export function validatePrompt(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("Escribí un mensaje.");
  if (text.length > 16000) throw new Error("El mensaje supera los 16 000 caracteres.");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text))
    throw new Error("El mensaje contiene caracteres de control no permitidos.");
  if (/^\s*[\/!]/.test(text))
    throw new Error("Usá Terminal para comandos de Codex o del shell.");
  return text.replace(/\r\n?/g, "\n");
}
export async function sendPrompt(target, session, text, stillCurrent = () => true) {
  const prompt = validatePrompt(text);
  if (target?.machine || !target?.isCodex || !/^t[0-9a-z]+$/i.test(target?.terminal ?? "")
      || !session?.id || !session?.file) throw new Error("La sesión no está vinculada a una terminal local.");
  const info = await hc(["get", target.terminal, "--json"]);
  if (info.code !== 0) throw new Error("No se pudo verificar la terminal.");
  const response = JSON.parse(info.stdout);
  const record = response.terminal ?? response.record ?? response;
  const entry = registration(record.labels);
  if (record.state !== "live" || (record.address && record.address !== target.terminal)
      || !entry || entry.id !== session.id.toLowerCase() || entry.file !== session.file)
    throw new Error("La sesión cambió. Actualizá el chat antes de enviar.");
  if (terminalStatus(record) !== "idle")
    throw new Error("Codex no está listo. Esperá o revisá Terminal.");
  if (!stillCurrent()) throw new Error("Cambió el panel activo. No se envió el mensaje.");
  // The core rechecks idle at delivery; do not use --force or retry on error.
  // End options before the terminal and the user's literal text.
  const result = await hc(["send", "--if", "idle", "--json", "--", target.terminal, prompt]);
  if (result.code !== 0) {
    throw new Error("Herdr no confirmó el envío. Revisá Terminal antes de volver a intentarlo.");
  }
  let data;
  try { data = JSON.parse(result.stdout); } catch {
    throw new Error("No se pudo confirmar el envío. Revisá Terminal antes de volver a intentarlo.");
  }
  if (data?.error || data?.ok === false || data?.sent === false)
    throw new Error("Herdr no confirmó el envío. Revisá Terminal antes de volver a intentarlo.");
  return data;
}
