// Shared, pure catalog. Keep the pane header's copy identical (CI verifies).
// A recognized program is not automatically an enabled chat provider.
export const AGENTS = Object.freeze([
  Object.freeze({ id: "codex", name: "Codex", aliases: Object.freeze(["codex", "openai-codex"]), enabled: true, remote: false }),
  Object.freeze({ id: "opencode", name: "OpenCode", aliases: Object.freeze(["opencode", "open-code", "opencode-native"]), enabled: true, remote: false }),
  Object.freeze({ id: "pi", name: "Pi / Gentle Shell", aliases: Object.freeze(["pi", "pi-agent", "pi-coding-agent", "gentle-shell", "gentle shell"]), enabled: false, remote: false }),
]);
export function agentInfo(id) {
  return AGENTS.find(agent => agent.id === id) ?? null;
}
export function detectAgent(program = {}, app = null) {
  // Program metadata and the reported app, not editable terminal names/titles.
  // Match complete identifiers: "pi" must not match "pipeline" or Raspberry Pi.
  for (const value of [program?.key, app, program?.name, program?.agent]) {
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    const found = AGENTS.find(agent => agent.aliases.includes(normalized));
    if (found) return found.id;
  }
  return null;
}
export function targetMachine(address, machine = null) {
  if (machine) return machine;
  return typeof address === "string" && address.includes("/") ? address.split("/")[0] || "remote" : null;
}
export function supportsChat(target) {
  const agent = agentInfo(target?.providerId);
  return Boolean(agent?.enabled && target?.terminal && target?.cwd
    && (!targetMachine(target.terminal, target.machine) || agent.remote));
}
