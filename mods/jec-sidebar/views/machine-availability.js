export const MACHINE_STATES_KEY = "better-sidebar.machine-states";

export function machineStatesByName(machines, knownNames = []) {
  const entries = (Array.isArray(machines) ? machines : []).flatMap((machine) => {
    if (
      !machine ||
      typeof machine.name !== "string" ||
      machine.name.length === 0 ||
      typeof machine.state !== "string"
    ) return [];
    return [[machine.name, machine.state]];
  });
  const states = Object.fromEntries(entries);
  for (const name of Array.isArray(knownNames) ? knownNames : []) {
    if (typeof name !== "string" || name.length === 0) continue;
    if (!Object.prototype.hasOwnProperty.call(states, name)) states[name] = "disconnected";
  }
  return Object.fromEntries(Object.entries(states).sort(([left], [right]) => left.localeCompare(right)));
}

export function isDisconnectedMachine(name, states) {
  return typeof name === "string"
    && name.length > 0
    && states !== null
    && typeof states === "object"
    && Object.prototype.hasOwnProperty.call(states, name)
    && typeof states[name] === "string"
    && states[name] !== "connected";
}

export function machineNameForAgentAddress(address) {
  if (typeof address !== "string") return null;
  const separator = address.indexOf("/");
  return separator > 0 ? address.slice(0, separator) : null;
}

export function isAgentOnDisconnectedMachine(address, states) {
  return isDisconnectedMachine(machineNameForAgentAddress(address), states);
}
