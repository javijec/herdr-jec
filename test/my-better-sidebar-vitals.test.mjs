import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  fileURLToPath(new URL("../mods/my-better-sidebar/views/vitals.js", import.meta.url)),
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
