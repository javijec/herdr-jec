// JEC: projection only; no commands, polling or storage.
export function machineSummary(spaces, machine) {
  const own = spaces.filter(s => (s.machine ?? null) === machine);
  const tabs = own.reduce((sum, s) => sum + (s.tabs?.length ?? 0), 0);
  const active = own.some(s => s.active);
  return { count: own.length, tabs, active,
    label: `${own.length} ${own.length === 1 ? "space" : "spaces"} · ${tabs} ${tabs === 1 ? "tab" : "tabs"}${active ? " · active machine" : ""}` };
}
