// Read-only CPU and memory metrics for the Machines list.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, window } from "herdr";

const LOCAL = { id: "local", on: null };
const WINDOWS = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding $false; $os=Get-CimInstance Win32_OperatingSystem; $cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; if($null -eq $cpu){throw 'Metrics unavailable'}; @{cpu=[double]$cpu;memUsed=([double]$os.TotalVisibleMemorySize-[double]$os.FreePhysicalMemory)*1024;memTotal=[double]$os.TotalVisibleMemorySize*1024} | ConvertTo-Json -Compress`;
const LINUX = `export LC_ALL=C; a=$(awk '/^cpu / {t=0; for(i=2;i<=9 && i<=NF;i++)t+=$i; print t,$5+$6; exit}' /proc/stat); sleep 1; b=$(awk '/^cpu / {t=0; for(i=2;i<=9 && i<=NF;i++)t+=$i; print t,$5+$6; exit}' /proc/stat); set -- $a $b; cpu=$(awk -v a="$1" -v b="$2" -v c="$3" -v d="$4" 'BEGIN { if(c<=a) exit 1; printf "%.2f", 100*(1-(d-b)/(c-a)) }') || exit 1; mem=$(awk '/^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2} END {if(!t || !a) exit 1; printf "%.0f %.0f",(t-a)*1024,t*1024}' /proc/meminfo) || exit 1; set -- $mem; [ "$#" -eq 2 ] || exit 1; printf '{"cpu":%s,"memUsed":%s,"memTotal":%s}\\n' "$cpu" "$1" "$2"`;
const MAX_CONCURRENT_PROBES = 4;
const gb = (n) => (n / 1073741824).toFixed(1);

function remotePlatformFromUname(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "linux") return "linux";
  if (/^(windows|mingw|msys|cygwin)/.test(value)) return "windows";
  return null;
}

function localPlatform() {
  const value = window().platform;
  return value === "windows" || value === "linux" ? value : null;
}

function parseMetrics(raw) {
  try {
    const data = JSON.parse(String(raw).replace(/^\uFEFF/, "").trim());
    const keys = ["cpu", "memUsed", "memTotal"];
    if (!data || keys.some((key) => typeof data[key] !== "number" || !Number.isFinite(data[key]))) return null;
    if (data.cpu < 0 || data.cpu > 100 || data.memTotal <= 0 || data.memUsed < 0 || data.memUsed > data.memTotal)
      return null;
    return Object.fromEntries(keys.map((key) => [key, data[key]]));
  } catch {
    return null;
  }
}

export class MachineVitals {
  init(cx) {
    this.state = {};
    this.platforms = {};
    this.busy = {};
    this.sampling = false;
    this.resampleRequested = false;
    this.last = 0;
    this.targets = [LOCAL];
    this.targetSignature = LOCAL.id;
    this.sample(cx);
    cx.timer.every(10000, (cx) => {
      if (Date.now() - this.last >= (window().active ? 10000 : 30000) - 100) this.sample(cx);
    });
  }

  setMachines(names, cx) {
    const targets = [LOCAL];
    const seen = new Set([LOCAL.id]);
    for (const raw of names) {
      if (typeof raw !== "string") continue;
      const name = raw.trim();
      const id = `remote:${name}`;
      if (!name || seen.has(id)) continue;
      seen.add(id);
      targets.push({ id, on: name });
    }
    const signature = targets.map((machine) => machine.id).join("\0");
    if (signature === this.targetSignature) return;
    this.targets = targets;
    this.targetSignature = signature;
    for (const id of Object.keys(this.state)) if (!seen.has(id)) delete this.state[id];
    for (const id of Object.keys(this.platforms)) if (!seen.has(id)) delete this.platforms[id];
    this.sample(cx, true);
  }

  isTarget(name) {
    if (name === null) return true;
    return this.targets.some((machine) => machine.on === name);
  }

  async readMetrics(machine) {
    const options = machine.on ? { on: machine.on } : {};
    let platform = machine.on ? this.platforms[machine.id] : localPlatform();

    if (machine.on && !platform) {
      try {
        const result = await exec("uname", ["-s"], options);
        if (result.code === 0) {
          platform = remotePlatformFromUname(result.stdout);
          if (!platform) return null;
          this.platforms[machine.id] = platform;
        }
      } catch {
        // Windows usually has no uname; its PowerShell metrics command identifies it.
      }
    }

    if (platform) {
      const data = await this.readForPlatform(platform, options);
      if (data && machine.on) this.platforms[machine.id] = platform;
      return data;
    }
    if (!machine.on) return null;

    // Some Windows hosts have no uname. A successful PowerShell result identifies Windows;
    // if it cannot start, try the Linux probe for minimal Linux hosts without uname.
    const windows = await this.readForPlatform("windows", options);
    if (windows) {
      this.platforms[machine.id] = "windows";
      return windows;
    }
    const linux = await this.readForPlatform("linux", options);
    if (linux) this.platforms[machine.id] = "linux";
    return linux;
  }

  async readForPlatform(platform, options) {
    try {
      const result = platform === "windows"
        ? await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS], options)
        : await exec("sh", ["-c", LINUX], options);
      return result.code === 0 ? parseMetrics(result.stdout) : null;
    } catch {
      return null;
    }
  }

  sample(cx, force = false) {
    if (this.sampling) {
      if (force) this.resampleRequested = true;
      return;
    }
    const targets = this.targets.filter((machine) => !this.busy[machine.id]);
    if (!targets.length) return;
    this.sampling = true;
    this.last = Date.now();
    targets.forEach((machine) => (this.busy[machine.id] = true));
    cx.spawn(async (cx) => {
      for (let i = 0; i < targets.length; i += MAX_CONCURRENT_PROBES) {
        await Promise.all(
          targets.slice(i, i + MAX_CONCURRENT_PROBES).map(async (machine) => {
            try {
              const data = await this.readMetrics(machine);
              this.state[machine.id] = data ? { data } : { error: "Unavailable" };
            } catch {
              this.state[machine.id] = { error: "Unavailable" };
            } finally {
              this.busy[machine.id] = false;
              cx.notify();
            }
          }),
        );
      }
      this.sampling = false;
      if (this.resampleRequested) {
        this.resampleRequested = false;
        this.sample(cx);
      }
    });
  }

  renderFor(name, narrow) {
    const id = name === null ? LOCAL.id : `remote:${name}`;
    const state = this.state[id];
    const data = state?.data;
    const mem = data ? (100 * data.memUsed) / data.memTotal : 0;
    const t = theme();
    const color = (pct) => (pct >= 95 ? t.ansi1 : pct >= 85 ? t.ansi3 : t.accent);
    const line = (label, value, pct) =>
      h_flex()
        .h(17)
        .gap(6)
        .items_center()
        .child(div().w(29).flex_none().text_size(10).text_color(t.dim).child(label))
        .child(
          div()
            .flex_1()
            .h(4)
            .rounded(2)
            .bg(t.border)
            .overflow_hidden()
            .child(div().h_full().w(`${Math.max(0, Math.min(100, pct))}%`).bg(color(pct))),
        )
        .child(
          div()
            .w(82)
            .flex_none()
            .text_right()
            .text_size(10.5)
            .text_color(t.foreground)
            .child(value),
        );
    const compact = (label, pct) =>
      h_flex()
        .h(14)
        .w_full()
        .flex_none()
        .items_center()
        .justify_between()
        .overflow_hidden()
        .child(div().flex_none().text_size(7).text_color(t.dim).child(label))
        .child(div().flex_none().text_size(8).text_color(color(pct)).child(`${Math.round(pct)}%`));
    const content = !data
      ? div()
          .h(narrow ? 14 : 17)
          .flex_none()
          .text_size(narrow ? 8 : 10)
          .text_color(state?.error ? t.ansi1 : t.dim)
          .child(state?.error ? (narrow ? "!" : "Unavailable") : "…")
      : narrow
        ? v_flex().flex_none().children([compact("CPU", data.cpu), compact("MEM", mem)])
        : v_flex().flex_none().gap(2).children([
            line("CPU", `${Math.round(data.cpu)}%`, data.cpu),
            line("Mem", `${gb(data.memUsed)}/${gb(data.memTotal)} GB`, mem),
          ]);
    return v_flex()
      .id(`machine-vitals-${id}`)
      .w_full()
      .flex_none()
      .min_w(0)
      .pl(narrow ? 2 : 12)
      .pr(8)
      .pb(7)
      .child(content);
  }
}
