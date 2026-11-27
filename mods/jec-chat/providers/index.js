// Agent-neutral interface. Only enable providers after identity and actions
// have been validated against the agent's existing live terminal.
import * as codex from "./codex.js";
import * as opencode from "./opencode.js";
import { agentInfo, supportsChat, targetMachine } from "../provider-catalog.js";

const codexProvider = Object.freeze({
  id: "codex",
  name: "Codex",
  capabilities: Object.freeze({ history: true, discovery: true, send: true, interrupt: true, blockedPreview: true, approval: false, remote: false }),
  identify: target => codex.registeredSession(target.cwd, target.terminal),
  list: target => codex.listSessions(target.cwd),
  match: (target, sessions) => codex.resolveCurrentSession(target.cwd, target.terminal, sessions),
  read: (target, session) => codex.readSession(target.cwd, session.file, session.id),
  status: codex.terminalStatus,
  send: (target, session, text, stillCurrent) => codex.sendPrompt({ ...target, isCodex: target.providerId === "codex" }, session, text, stillCurrent),
  interrupt: (target, session, stillCurrent) => codex.interruptPrompt({ ...target, isCodex: target.providerId === "codex" }, session, stillCurrent),
  blockedPreview: (target, session) => codex.blockedScreen({ ...target, isCodex: target.providerId === "codex" }, session),
});

const opencodeProvider = Object.freeze({
  id: "opencode", name: "OpenCode",
  capabilities: Object.freeze({ history: true, discovery: false, send: true, interrupt: true, blockedPreview: true, approval: false, remote: false }),
  identify: opencode.identify,
  read: opencode.read,
  status: opencode.status,
  send: opencode.send,
  interrupt: opencode.interrupt,
  blockedPreview: opencode.blockedPreview,
});
const providers = new Map([[codexProvider.id, codexProvider], [opencodeProvider.id, opencodeProvider]]);
export function providerFor(target, manual = false) {
  if (!target?.terminal || !target?.cwd) return null;
  if (supportsChat(target)) return providers.get(target.providerId) ?? null;
  // Preserve legacy manually selected Codex history, but never route another
  // recognized agent or a remote path through a local Codex reader.
  if (manual && !target.providerId && !targetMachine(target.terminal, target.machine)) return codexProvider;
  return null;
}
export function providerName(target, provider = null) {
  return provider?.name ?? agentInfo(target?.providerId)?.name ?? "Agente";
}
export function sessionKey(target, provider, session) {
  if (!target?.terminal || !provider?.id || !session?.id) return null;
  return JSON.stringify([targetMachine(target.terminal, target.machine), target.terminal, provider.id, session.id]);
}
// Drafts belong to a conversation; in-flight actions belong to a live registration.
export function sameActiveSession(a, b) {
  return Boolean(a?.id && b?.id && a.id === b.id
    && (a.generation ?? null) === (b.generation ?? null)
    && (a.file ?? null) === (b.file ?? null));
}
export function allowsAction(target, provider, session, registered, action) {
  return Boolean(registered && session?.id && supportsChat(target)
    && provider?.id === target.providerId && provider.capabilities?.[action] === true
    && typeof provider[action] === "function");
}
