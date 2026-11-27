import { detectAgent, targetMachine } from "./provider-catalog.js";
// Pure helpers: keep target identity fixed while the dialog is open.
// Never infer a Codex session from a folder alone when multiple sessions exist.
export function resolveTarget({ focus, allPanes, allSpaces, allTerminals }) {
  const f = focus ?? {};
  const panes = allPanes ?? [];
  const spaces = allSpaces ?? [];
  const terminals = allTerminals ?? [];
  const p = panes.find(x => x.terminal && x.terminal === f.terminal)
    ?? panes.find(x => x.pane && x.pane === f.pane)
    ?? panes.find(x => x.focused && x.terminal);
  const address = p?.terminal ?? f.terminal ?? f.agent?.address ?? null;
  const term = terminals.find(x => x.address === address);
  const sp = spaces.find(x => x.id === f.space)
    ?? spaces.find(x => x.tabs?.some(tab => tab.id === p?.tab));
  const program = p?.program ?? term?.program ?? f.agent?.program ?? {};
  const providerId = detectAgent(program, p?.app ?? term?.report?.app ?? term?.app ?? f.agent?.app);
  return {
    terminal: address,
    pane: p?.pane ?? f.pane ?? null,
    cwd: p?.cwd ?? f.cwd ?? term?.cwd ?? sp?.folder ?? null,
    machine: targetMachine(address, sp?.machine),
    providerId,
  };
}
export function shortDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "sin fecha";
}
