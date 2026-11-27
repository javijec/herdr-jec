import { appHome, readTextFile, hc } from "herdr";
const SESSION = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TERMINAL = /^t[0-9a-z]+$/i;
const GENERATION = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_AGE = 6500;
export function status(record) {
  const value = (typeof record?.status === "string" ? record.status : record?.status?.state) ?? record?.report?.state;
  return typeof value === "string" ? value.toLowerCase() : null;
}
function validTarget(target) {
  return target?.providerId === "pi" && !target.machine && TERMINAL.test(target.terminal ?? "");
}
function pending(reason, state = null) { return {pending:true,id:null,reason,status:state}; }
export function parseSnapshot(raw, address, now = Date.now()) {
  if (typeof raw !== "string" || raw.length > 900000) return null;
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  if (data?.version !== 1 || data.provider !== "pi" || data.terminal !== address
    || !GENERATION.test(data.generation ?? "") || !Number.isFinite(data.at)
    || now - data.at > MAX_AGE || data.at - now > 2000) return null;
  if (!data.id) return {reason: typeof data.reason === "string" ? data.reason : "open_session"};
  if (!SESSION.test(data.id) || typeof data.cwd !== "string" || !data.cwd) return null;
  const history = data.data;
  if (!Array.isArray(history?.messages) || history.messages.length > 80
    || !Number.isSafeInteger(history.total) || history.total < history.messages.length) return null;
  if (!history.messages.every(m => ["user","assistant","tool"].includes(m?.role)
    && typeof m.text === "string" && m.text.length <= 12000)) return null;
  return data;
}
function snapshotPath(address) {
  return appHome().replace(/[\\/]$/, "") + "/data/jec-chat-pi/" + address + ".json";
}
async function snapshot(target) {
  if (!validTarget(target)) return null;
  let raw;
  try { raw = await readTextFile(snapshotPath(target.terminal)); } catch { return null; }
  return parseSnapshot(raw, target.terminal);
}
async function terminalRecord(target) {
  if (!validTarget(target)) throw new Error("Pi / Gentle Shell: sólo se admite la terminal local asociada.");
  const result = await hc(["get",target.terminal,"--json"]);
  if (result.code !== 0) throw new Error("No se pudo verificar la terminal de Pi / Gentle Shell.");
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { throw new Error("Estado de Herdr no válido."); }
  const record = parsed.terminal ?? parsed.record ?? parsed;
  if (record?.state !== "live" || (record.address && record.address !== target.terminal))
    throw new Error("La terminal de Pi / Gentle Shell ya no está activa.");
  return record;
}
export function combinedStatus(record, active) {
  const core = status(record);
  if (core === "blocked" || active?.status === "blocked") return "blocked";
  if (core === "working" || active?.status === "working") return "working";
  if (active?.status === "idle" && ["idle","done"].includes(core)) return core;
  return null;
}
const reasons = {
  session_loading:"Esperando la sesión interactiva de Pi.",
  api_unavailable:"La extensión JEC no pudo leer la sesión de Pi. Revisá su versión."
};
export async function identify(target) {
  if (!validTarget(target)) return null;
  const record = await terminalRecord(target).catch(() => null);
  if (!record) return pending("Esperando que Herdr confirme la terminal activa de Pi / Gentle Shell.");
  const active = await snapshot(target);
  if (!active) return pending("Esperando la extensión JEC de Pi. Reiniciá el agente desde Herdr y comprobá su directorio de extensiones.", status(record));
  if (!active.id) return pending(reasons[active.reason] ?? "Esperando la sesión activa de Pi / Gentle Shell.", status(record));
  return {
    session:{id:active.id,cwd:active.cwd,generation:active.generation},
    data:active.data, status:combinedStatus(record,active), method:"registro Pi"
  };
}
function sameSession(active, session) {
  return Boolean(active?.id && active.id === session?.id && active.generation === session?.generation);
}
async function checked(target, session, stillCurrent) {
  const before = await snapshot(target);
  if (!sameSession(before,session)) throw new Error("La sesión activa de Pi / Gentle Shell cambió o el plugin dejó de responder.");
  const record = await terminalRecord(target);
  const active = await snapshot(target);
  if (!sameSession(active,session) || !stillCurrent()) throw new Error("Cambió la sesión o el panel activo.");
  return {record,active,state:combinedStatus(record,active)};
}
export async function read(target, session) {
  const active = await snapshot(target);
  if (!sameSession(active,session)) throw new Error("La sesión de Pi / Gentle Shell cambió.");
  return active.data;
}
export function validatePrompt(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 16000
    || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text) || /^\s*[\/!]/.test(text))
    throw new Error("Escribí un mensaje de texto válido; los comandos se ejecutan en Terminal.");
  return text.replace(/\r\n?/g,"\n");
}
async function action(args, message) {
  const result = await hc(args);
  if (result.code !== 0) {
    let kind = "";
    try { const k = JSON.parse(result.stdout || result.stderr).error?.kind; if (/^[a-z_]+$/.test(k ?? "")) kind = " ("+k+")"; } catch {}
    throw new Error(message + kind + ". Revisá Terminal antes de volver a intentarlo.");
  }
  let value;
  try { value = JSON.parse(result.stdout); } catch { throw new Error(message + ". Revisá Terminal."); }
  if (value?.error || value?.ok === false || value?.sent === false) throw new Error(message + ". Revisá Terminal.");
  return value;
}
export async function send(target, session, text, stillCurrent = () => true) {
  const prompt = validatePrompt(text);
  const {state} = await checked(target,session,stillCurrent);
  if (state !== "idle" && state !== "done")
    throw new Error("Pi / Gentle Shell no está listo (estado: "+(state ?? "sin confirmar")+"). Verificá el indicador de agente de Herdr.");
  // Native Herdr delivery; no force and no automatic retry. The core does
  // not support --if done, so the done pre-check is not atomic with delivery.
  const args = state === "idle" ? ["send","--if","idle"] : ["send"];
  return action([...args,"--json","--",target.terminal,prompt],"Herdr no confirmó el envío");
}
export async function interrupt(target, session, stillCurrent = () => true) {
  const {record,active,state} = await checked(target,session,stillCurrent);
  if (state !== "working" || status(record) !== "working" || active.status !== "working")
    throw new Error("Pi / Gentle Shell ya no está trabajando o su estado no está confirmado.");
  return action(["interrupt",target.terminal,"--json"],"Herdr no confirmó la interrupción");
}
export async function blockedPreview(target, session) {
  const before = await checked(target,session,()=>true);
  if (before.state !== "blocked") return null;
  const result = await hc(["read",target.terminal,"--lines","0"]);
  if (result.code !== 0) throw new Error("No se pudo leer la solicitud.");
  const after = await checked(target,session,()=>true);
  return after.state === "blocked" ? String(result.stdout ?? "").trim().slice(-8000) : null;
}
