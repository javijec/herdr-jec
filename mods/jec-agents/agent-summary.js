// Read-only projection of the same live snapshots used by the stock Agents mod.
// Only listed agents and their live descendants count; addresses are globally
// qualified by machine. Kept/pinned descendants count once.
export function agentSummary(list, terminals, kidStatus) {
  const listed = new Map(list.map(a => [a.address, a.status]));
  const seen = new Map(listed);
  const children = new Map();
  for (const t of terminals) {
    if (t.state !== "live" || !t.parent || !t.address) continue;
    if (!children.has(t.parent)) children.set(t.parent, []);
    children.get(t.parent).push(t);
  }
  const queue = [...listed.keys()], expanded = new Set();
  for (let i = 0; i < queue.length; i++) {
    const parent = queue[i];
    if (expanded.has(parent)) continue;
    expanded.add(parent);
    for (const t of children.get(parent) ?? []) {
      if (!seen.has(t.address)) seen.set(t.address, kidStatus(t, listed));
      if (!expanded.has(t.address)) queue.push(t.address);
    }
  }
  const counts = { total: seen.size, working: 0, blocked: 0, done: 0, idle: 0, unknown: 0 };
  for (const status of seen.values()) counts[["working","blocked","done","idle"].includes(status) ? status : "unknown"]++;
  return counts;
}
export function summaryLabel(s) {
  return `${s.total} agents · ${s.working} working · ${s.blocked} need you · ${s.done} done · ${s.idle} idle · ${s.unknown} unknown`;
}
