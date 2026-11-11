import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parseMetrics } from "../mods/jec-sidebar/views/metrics.js";
import {
  isAgentOnDisconnectedMachine,
  isDisconnectedMachine,
  machineNameForAgentAddress,
  machineStatesByName,
} from "../mods/jec-sidebar/views/machine-availability.js";

const spacesSource = readFileSync(
  fileURLToPath(new URL("../mods/jec-sidebar/views/spaces.js", import.meta.url)),
  "utf8",
);
const agentsSource = readFileSync(
  fileURLToPath(new URL("../mods/jec-sidebar/views/agents.js", import.meta.url)),
  "utf8",
);

const source = readFileSync(
  fileURLToPath(new URL("../mods/jec-sidebar/views/vitals.js", import.meta.url)),
  "utf8",
)
  .replace(/^import\s+[\s\S]*?;\n/gm, "")
  .replace("export class MachineVitals", "globalThis.MachineVitals = class MachineVitals");

const metrics = JSON.stringify({ cpu: 12.5, memUsed: 536870912, memTotal: 2147483648 });

function harness(platform, run) {
  const calls = [];
  const pending = [];
  const cx = {
    notify() {},
    timer: { every() {} },
    spawn(fn) {
      pending.push(Promise.resolve().then(() => fn(cx)));
    },
  };
  const context = {
    Date,
    JSON,
    Map,
    Set,
    Math,
    Number,
    Object,
    String,
    parseMetrics,
    Promise,
    console,
    window: () => ({ platform, active: true }),
    exec: async (command, args, options) => {
      calls.push({ command, args, options });
      return run(command, args, options);
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const vitals = new context.MachineVitals();
  vitals.init(cx);
  return {
    calls,
    vitals,
    cx,
    async flush() {
      while (pending.length) await pending.shift();
    },
  };
}

test("local Windows uses PowerShell for metrics", async () => {
  const h = harness("windows", async () => ({ code: 0, stdout: metrics }));
  await h.flush();
  assert.equal(h.calls[0].command, "powershell.exe");
  assert.ok(h.vitals.state.local.data);
});

test("local Linux uses the Linux probe", async () => {
  const h = harness("linux", async () => ({ code: 0, stdout: metrics }));
  await h.flush();
  assert.equal(h.calls[0].command, "sh");
  assert.ok(h.vitals.state.local.data);
});

test("remote Linux is detected and uses the Linux probe", async () => {
  const h = harness("windows", async (command, _args, options) => {
    if (options?.on === "linuxbox" && command === "uname") return { code: 0, stdout: "Linux\n" };
    if (options?.on === "linuxbox" && command === "sh") return { code: 0, stdout: metrics };
    if (command === "powershell.exe") return { code: 0, stdout: metrics };
    return { code: 127, stdout: "" };
  });
  await h.flush();
  h.calls.length = 0;
  h.vitals.setMachines(["linuxbox"], h.cx);
  await h.flush();
  const remote = h.calls.filter((call) => call.options?.on === "linuxbox");
  assert.deepEqual(remote.map((call) => call.command), ["uname", "sh"]);
  assert.ok(h.vitals.state["remote:linuxbox"].data);
});

test("remote Windows falls back to PowerShell when uname is unavailable", async () => {
  const h = harness("windows", async (command, _args, options) => {
    if (options?.on === "winbox" && command === "uname") throw new Error("not found");
    if (options?.on === "winbox" && command === "powershell.exe") return { code: 0, stdout: metrics };
    if (command === "powershell.exe") return { code: 0, stdout: metrics };
    return { code: 127, stdout: "" };
  });
  await h.flush();
  h.calls.length = 0;
  h.vitals.setMachines(["winbox"], h.cx);
  await h.flush();
  const remote = h.calls.filter((call) => call.options?.on === "winbox");
  assert.deepEqual(remote.map((call) => call.command), ["uname", "powershell.exe"]);
  assert.ok(h.vitals.state["remote:winbox"].data);
});

test("removing a disconnected machine clears its metrics and platform cache", async () => {
  const h = harness("windows", async (command, _args, options) => {
    if (options?.on === "winbox" && command === "uname") return { code: 0, stdout: "Linux\n" };
    if (options?.on === "winbox" && command === "sh") return { code: 0, stdout: metrics };
    return { code: 0, stdout: metrics };
  });
  await h.flush();
  h.vitals.setMachines(["winbox"], h.cx);
  await h.flush();
  assert.ok(h.vitals.state["remote:winbox"].data);
  assert.equal(h.vitals.isTarget("winbox"), true);

  h.vitals.setMachines([], h.cx);
  await h.flush();
  assert.equal(h.vitals.isTarget("winbox"), false);
  assert.equal(h.vitals.state["remote:winbox"], undefined);
  assert.equal(h.vitals.platforms["remote:winbox"], undefined);
  assert.equal(h.vitals.targets.map((machine) => machine.id).join(","), "local");
});

test("sidebar supports parts without init while initializing parts that provide it", () => {
  function createSidebar(view, Part) {
    const sidebarSource = readFileSync(
      fileURLToPath(new URL("../mods/jec-sidebar/main.js", import.meta.url)),
      "utf8",
    )
      .replace(/^import\s+[\s\S]*?;\n/gm, "")
      .replace("export default class BetterSidebar", "globalThis.BetterSidebar = class BetterSidebar");
    const context = vm.createContext({
      View: class View {},
      props: () => ({ view }),
      Spaces: class Spaces {},
      Agents: class Agents {},
      Footer: class Footer {},
      PanelToggle: class PanelToggle {},
    });
    context[view === "footer" ? "Footer" : "Agents"] = Part;
    vm.runInContext(sidebarSource, context);
    return new context.BetterSidebar();
  }

  const footer = createSidebar("footer", class Footer {
    render() { return "footer"; }
  });
  footer.init({}, {});
  assert.equal(footer.render(), "footer");

  const calls = [];
  const given = {};
  const cx = {};
  const agents = createSidebar("agents", class Agents {
    init(receivedGiven, receivedCx) { calls.push([receivedGiven, receivedCx]); }
    render() { return "agents"; }
  });
  agents.init(given, cx);
  assert.deepEqual(calls, [[given, cx]]);
  assert.equal(agents.render(), "agents");
});

test("space creation is allowed only on the local or connected machine", async () => {
  const source = spacesSource
    .replace(/^import\s+[\s\S]*?;\n/gm, "")
    .replace("export class Spaces", "globalThis.Spaces = class Spaces");
  const context = vm.createContext({ Object, Set, Map, Array, String, Number, JSON, Math, Date });
  vm.runInContext(source, context);
  const spaces = Object.create(context.Spaces.prototype);
  spaces.machines = [{ name: "online", state: "connected" }, { name: "offline", state: "disconnected" }];

  assert.equal(spaces.machineConnected(null), true);
  assert.equal(spaces.machineConnected("online"), true);
  assert.equal(spaces.machineConnected("offline"), false);
});

test("machine status snapshots identify only known disconnected machines", () => {
  const states = machineStatesByName([
    { name: "online", state: "connected" },
    { name: "offline", state: "disconnected" },
    { name: "invalid", state: 1 },
    null,
  ], ["known-space-without-machine-record"]);
  assert.deepEqual(states, {
    "known-space-without-machine-record": "disconnected",
    offline: "disconnected",
    online: "connected",
  });
  assert.equal(isDisconnectedMachine("offline", states), true);
  assert.equal(isDisconnectedMachine("online", states), false);
  assert.equal(isDisconnectedMachine("unknown", states), false);
});

test("remote agents map to a machine and inherit its disconnected state", () => {
  const states = { vps: "disconnected", office: "connected" };
  assert.equal(machineNameForAgentAddress("vps/t7"), "vps");
  assert.equal(machineNameForAgentAddress("local-pane"), null);
  assert.equal(isAgentOnDisconnectedMachine("vps/t7", states), true);
  assert.equal(isAgentOnDisconnectedMachine("office/t2", states), false);
  assert.equal(isAgentOnDisconnectedMachine("local-pane", states), false);
});

test("disconnected machine groups collapse and omit all children", () => {
  const start = spacesSource.indexOf("  grouped(t, collapsed)");
  const end = spacesSource.indexOf("  machineConnected(m)", start);
  const grouped = spacesSource.slice(start, end);
  assert.match(grouped, /if \(this\.machineCollapsed\(m\)\) return \[head\]/);
  assert.match(spacesSource, /machineCollapsed\(m\) \{\s*return this\.folded\.has\(m\) \|\| this\.machineDisconnected\(m\);/);
  assert.match(spacesSource, /setShared\(MACHINE_STATES_KEY, this\.machineStates\)/);
});

test("disconnected agents are dimmed and their row actions are conditional", () => {
  assert.match(agentsSource, /machineStates: shared\(MACHINE_STATES_KEY\)/);
  assert.match(agentsSource, /isAgentOnDisconnectedMachine\(a\.address, view\.machineStates\)/);
  for (const method of ["railRow", "agentRow", "subRow"]) {
    const start = agentsSource.indexOf(`  ${method}(`);
    assert.notEqual(start, -1, `${method} renderer exists`);
    const nextMethod = agentsSource.slice(start + 1).match(/\n  [A-Za-z][A-Za-z0-9]*\(/);
    const end = nextMethod ? start + 1 + nextMethod.index : agentsSource.length;
    const body = agentsSource.slice(start, end);
    assert.match(body, /offline/);
    assert.match(body, /opacity\(0\.45\)/);
    assert.match(body, /\.when\(!offline,/);
  }
});
