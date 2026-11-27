import { appHome, exec } from "herdr";

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
