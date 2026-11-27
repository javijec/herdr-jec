import { resolveTarget } from "./session.js";
import { supportsChat } from "./provider-catalog.js";
export const NATIVE_MOD = "jec-chat-native";

// Bind to props from the native body slot, never to global focus or cwd.
export function resolvePaneBody(identity, allPanes, allSpaces, allTerminals) {
  if (!identity?.pane || !identity?.terminal) return null;
  const pane = allPanes.find(p => p.pane === identity.pane && p.terminal === identity.terminal);
  const space = pane && allSpaces.find(s => s.tabs?.some(t => t.id === pane.tab));
  if (!pane || !space) return null;
  const candidate = resolveTarget({
    focus:{pane:pane.pane,terminal:pane.terminal,space:space.id},
    allPanes:[pane],allSpaces,allTerminals
  });
  if (!supportsChat(candidate) || candidate.terminal !== identity.terminal || candidate.pane !== identity.pane) return null;
  return {...candidate,tab:pane.tab,space:space.id};
}
export function paneBodyVisible(identity, allPanes, allSpaces) {
  const pane=allPanes.find(p=>p.pane===identity?.pane && p.terminal===identity?.terminal);
  const space=allSpaces.find(s=>s.active);
  const tab=space?.tabs?.find(t=>t.active);
  if (!pane || !tab || pane.tab!==tab.id || pane.body_mod!==NATIVE_MOD) return false;
  const zoomed=allPanes.find(p=>p.tab===tab.id && p.zoomed);
  return !zoomed || zoomed.pane===pane.pane;
}
export function samePaneTarget(a,b) {
  return Boolean(a && b && a.pane===b.pane && a.terminal===b.terminal && a.providerId===b.providerId
    && a.machine===b.machine && a.cwd===b.cwd && a.tab===b.tab && a.space===b.space);
}
export function toggleArgs(pane) {
  if (!pane?.pane || !pane?.terminal || !Object.prototype.hasOwnProperty.call(pane,"body_mod")) return null;
  return pane.body_mod===NATIVE_MOD ? {pane:pane.pane} : pane.body_mod==null ? {pane:pane.pane,mod:NATIVE_MOD} : null;
}
