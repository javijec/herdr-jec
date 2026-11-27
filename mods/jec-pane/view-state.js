// Chat/Terminal is a preference of the active tab, not of the global layout.
// Keep both mods' copies identical; Herdr resolves modules within each mod.
export const VIEW_KEY = "jec.chat.views.v1";
export function activeTab(spaces) {
  const space = spaces?.find(s => s.active);
  const tab = space?.tabs?.find(t => t.active);
  return space?.id && tab?.id ? {space:space.id,tab:tab.id} : null;
}
function sameTab(a,b) {
  return Boolean(a && b && a.space === b.space && a.tab === b.tab);
}
export function rememberChat(saved, active, pane) {
  if (!active?.space || !active?.tab || !pane?.pane || !pane?.terminal || pane.tab !== active.tab) return saved;
  const entries = Array.isArray(saved) ? saved : [];
  return [...entries.filter(e => !sameTab(e,active)), {
    ...active,pane:pane.pane,terminal:pane.terminal
  }].slice(-128);
}
export function forgetChat(saved, active) {
  return (Array.isArray(saved)?saved:[]).filter(e => !sameTab(e,active));
}
export function wantedPane(saved, active, panes) {
  if (!active) return null;
  const wanted = (Array.isArray(saved)?saved:[]).find(e => sameTab(e,active));
  if (!wanted) return null;
  return panes?.find(p => p.pane === wanted.pane && p.terminal === wanted.terminal && p.tab === active.tab) ?? null;
}
export function activeView(tree) {
  if (!tree) return null;
  if (tree.id === "jec-view") return tree.active;
  for (const child of tree.children ?? []) {
    const found = activeView(child);
    if (found) return found;
  }
  return null;
}
