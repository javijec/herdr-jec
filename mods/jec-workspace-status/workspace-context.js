// Pure projection; no polling, shell commands, remote requests or writes.
export function workspaceContext(space, machines) {
  const name = space?.machine ?? null;
  const list = machines ?? [];
  const machine = list.find(m => m.name === name);
  const state = ["ready","loading","unavailable"].includes(machine?.layout) ? machine.layout : "unknown";
  const labels = { ready: "Layout ready", loading: "Loading layout", unavailable: "Layout unavailable", unknown: "Layout state unknown" };
  const ready = list.filter(m => m.layout === "ready").length;
  const machineName = name ?? "This computer";
  const tabs = space?.tabs?.length ?? 0;
  const spaceName = space?.name ?? "";
  return { machineName, state, ready, total: list.length, spaceName, tabs,
    machineHint: `${machineName} · ${labels[state]} · ${ready}/${list.length} machine layouts ready · Click for machine settings`,
    spaceHint: space ? `${spaceName} · ${tabs} ${tabs === 1 ? "tab" : "tabs"}${space.folder ? " · " + space.folder : ""}` : "No active space"
  };
}
