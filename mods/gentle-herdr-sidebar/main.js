import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import {
  agents as herdrAgents,
  closeOverlay,
  exec,
  focused,
  home,
  nextCommand,
  openOverlay,
  panes,
  props,
  readTextFile,
  spaces,
  theme,
} from "herdr";
import {
  combineModelEffort,
  contextProgressBar,
  formatPercent,
  isRecord,
  isSectionExpanded,
  normalizeGentleAgentTasks,
  nonNegative,
  previewTodos,
  percentTone,
  retainFreshSnapshot,
  retainHerdrAgentSnapshot,
  resolveSectionChildren,
  runningJobs,
  safeText,
  sameDirectory,
  selectSnapshot,
  toggleCollapsedSection,
} from "./model.js";

const PRESENCE_LIMIT = 64;
const MAX_ACTIVE_AGE_MS = 60_000;
const MAX_SNAPSHOT_BYTES = 1024 * 1024;
const SNAPSHOT_NAME = /^session-[A-Za-z0-9_-]+\.json$/;
const PRESENCE_NAME = /^presence-[A-Za-z0-9_-]+\.json$/;

function joinPath(directory, name) {
  const trimmed = String(directory).replace(/[\\/]+$/, "");
  const separator = String(directory).includes("\\") && !String(directory).includes("/") ? "\\" : "/";
  return `${trimmed}${trimmed.endsWith(":") && separator === "\\" ? "\\" : separator}${name}`;
}

function absolutePath(value) {
  return typeof value === "string" && (/^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(value));
}

function shellQuotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function paneTarget() {
  const configured = props() ?? {};
  if (typeof configured.cwd === "string" && configured.cwd.length > 0) {
    return {
      cwd: configured.cwd,
      machine: typeof configured.machine === "string" && configured.machine.length > 0 ? configured.machine : null,
      terminal: typeof configured.terminal === "string" ? configured.terminal : null,
      space: typeof configured.space === "string" ? configured.space : undefined,
      tab: typeof configured.tab === "string" ? configured.tab : undefined,
    };
  }

  const space = spaces().find((item) => item.active);
  const tab = space?.tabs?.find((item) => item.active);
  const current = focused();
  const visiblePanes = panes().filter((item) => item.tab === tab?.id && item.terminal && item.cwd);
  const pane = visiblePanes.find((item) => item.pane === current?.pane)
    ?? visiblePanes.find((item) => item.focused)
    ?? visiblePanes[0];
  return {
    cwd: pane?.cwd ?? current?.cwd ?? space?.folder ?? "",
    machine: space?.machine ?? null,
    terminal: pane?.terminal ?? current?.terminal ?? null,
    space: space?.id,
    tab: tab?.id,
  };
}

async function shellOutput(target, command, args) {
  const result = await exec(command, args, { on: target.machine, cwd: target.cwd || undefined });
  if (result.code !== 0) throw new Error("Unable to inspect the bridge directory");
  return result.stdout.trim();
}

async function bridgeDirectory(target, override) {
  if (typeof override === "string" && override.length > 0) {
    if (!absolutePath(override)) throw new Error("Snapshot directory must be absolute");
    return override;
  }

  const sh = 'if [ -n "$GENTLE_HERDR_DIR" ]; then printf "%s\\n" "$GENTLE_HERDR_DIR"; else printf "%s/.gentle-herdr\\n" "$HOME"; fi';
  try {
    const result = await shellOutput(target, "sh", ["-c", sh]);
    if (absolutePath(result)) return result;
  } catch {}

  const ps = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); if ($env:GENTLE_HERDR_DIR) { [IO.Path]::GetFullPath($env:GENTLE_HERDR_DIR) } else { Join-Path $HOME '.gentle-herdr' }";
  try {
    const result = await shellOutput(target, "powershell", ["-NoProfile", "-Command", ps]);
    if (absolutePath(result)) return result;
  } catch {}

  if (!target.machine) return joinPath(home(), ".gentle-herdr");
  throw new Error("Cannot resolve the remote bridge directory");
}

async function listPresenceNames(target, directory) {
  const script = `& { param([string]$d) $items = @(Get-ChildItem -LiteralPath $d -File -Filter 'presence-*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First ${PRESENCE_LIMIT} -ExpandProperty Name); ConvertTo-Json -InputObject $items -Compress } ${shellQuotePowerShell(directory)}`;
  try {
    const output = await shellOutput(target, "powershell", ["-NoProfile", "-Command", script]);
    const names = JSON.parse(output || "[]");
    return Array.isArray(names) ? names.filter((name) => typeof name === "string" && PRESENCE_NAME.test(name)) : [];
  } catch {
    const sh = 'ls -1t "$1"/presence-*.json 2>/dev/null | head -n "$2" | while IFS= read -r p; do printf "%s\\n" "${p##*/}"; done';
    const output = await shellOutput(target, "sh", ["-c", sh, "gentle-herdr-sidebar", directory, String(PRESENCE_LIMIT)]);
    return output.split(/\r?\n/).filter((name) => PRESENCE_NAME.test(name));
  }
}

async function readSnapshots(target, override, now) {
  const directory = await bridgeDirectory(target, override);
  const names = await listPresenceNames(target, directory);
  const presenceRecords = await Promise.all(names.map(async (name) => {
    try {
      const raw = await readTextFile(joinPath(directory, name), { on: target.machine });
      if (typeof raw !== "string" || raw.length > 16_384) return undefined;
      const presence = JSON.parse(raw);
      if (!isRecord(presence) || typeof presence.sessionId !== "string" || !presence.sessionId || typeof presence.cwd !== "string") return undefined;
      if (!sameDirectory(presence.cwd, target.cwd)) return undefined;
      const updatedAt = Date.parse(presence.updatedAt);
      const age = now - updatedAt;
      if (!Number.isFinite(updatedAt) || age < 0 || age > MAX_ACTIVE_AGE_MS) return undefined;
      const snapshotName = name.replace(/^presence-/, "session-");
      if (!SNAPSHOT_NAME.test(snapshotName)) return undefined;
      return { name: snapshotName, sessionId: presence.sessionId, cwd: presence.cwd, updatedAt, updatedAtText: presence.updatedAt };
    } catch {
      return undefined;
    }
  }));

  const candidates = presenceRecords.filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  const snapshots = await Promise.all(candidates.map(async (record) => {
    try {
      const raw = await readTextFile(joinPath(directory, record.name), { on: target.machine });
      if (typeof raw !== "string" || raw.length > MAX_SNAPSHOT_BYTES) return undefined;
      const snapshot = JSON.parse(raw);
      if (!isRecord(snapshot) || snapshot.sessionId !== record.sessionId || snapshot.updatedAt !== record.updatedAtText
        || !sameDirectory(snapshot.cwd, record.cwd)) return undefined;
      return snapshot;
    } catch {
      return undefined;
    }
  }));
  return snapshots.filter(Boolean);
}

function colorForTone(t, tone) {
  if (tone === "danger") return t.ansi1 ?? t.blocked;
  if (tone === "warning") return t.ansi3 ?? t.working;
  return t.foreground;
}

function statusColor(t, state) {
  if (state === "working" || state === "running") return t.working;
  if (state === "blocked" || state === "failed" || state === "timed_out") return t.blocked;
  if (state === "done" || state === "completed") return t.done;
  if (state === "waiting") return t.ansi3 ?? t.working;
  if (state === "idle" || state === "cancelled" || state === "aborted") return t.dim;
  if (state === "queued") return t.muted;
  return t.unknown ?? t.muted;
}

function countText(value) {
  const number = nonNegative(value);
  return number === undefined ? undefined : String(Math.round(number));
}

function moneyText(value) {
  const number = nonNegative(value);
  return number === undefined ? undefined : `$${number.toFixed(2)}`;
}

function row(label, value, t, valueColor = t.foreground) {
  const safeLabel = safeText(label, 100);
  const safeValue = typeof value === "string" ? safeText(value, 1000) : undefined;
  if (!safeLabel || !safeValue) return null;
  return h_flex().min_h(22).gap(8).items_center()
    .child(div().text_size(12).text_color(t.dim).child(safeLabel))
    .child(div().flex_1().min_w(0))
    .child(div().min_w(0).truncate().text_right().text_size(12).text_color(valueColor).child(safeValue));
}

function contextUsageRow(progress, t) {
  const color = colorForTone(t, progress.tone);
  return h_flex().min_h(22).gap(8).items_center()
    .child(div().text_size(12).text_color(t.dim).child("Context"))
    .child(div().flex_1().min_w(0))
    .child(div().w(90).h(6).rounded(3).bg(t.border)
      .child(div().w(progress.width).h(6).rounded(3).bg(color)))
    .child(div().w(40).flex_none().text_size(12).text_right().text_color(color).child(progress.label));
}

function section(title, summary, t, { expanded = true, onToggle, onTitleClick, children = () => [], expandUp = false, borderBottom = true } = {}) {
  const toggle = () => onToggle?.();
  let titleLabel = div().flex_none().font_semibold().text_color(t.foreground).child(title);
  if (onTitleClick) titleLabel = titleLabel.cursor_pointer().on_click(onTitleClick);
  let heading = h_flex().min_h(28).gap(6).items_center()
    .child(h_flex().flex_1().min_w(0).gap(8).items_center()
      .child(titleLabel)
      .child(div().flex_1().min_w(0))
      .child(div().min_w(0).truncate().text_right().text_size(11).text_color(t.muted).child(summary ?? "")))
    .child(div().min_w(22).min_h(22).flex_none().rounded(4).border_1().border_color(t.border)
      .cursor_pointer().hover((style) => style.bg(t.hover)).text_center().text_color(t.muted).on_click(toggle)
      .child(expanded ? "−" : "+"));
  const output = v_flex().flex_none().gap(4).px(10).py(7);
  if (borderBottom) output.border_b(1).border_color(t.border);
  if (expanded && expandUp) output.child(v_flex().gap(2).children(resolveSectionChildren(expanded, children)));
  output.child(heading);
  if (expanded && !expandUp) output.child(v_flex().gap(2).children(resolveSectionChildren(expanded, children)));
  return output;
}

function stateLabel(state) {
  const labels = {
    working: "Working", blocked: "Blocked", done: "Done", idle: "Idle", failed: "Failed", aborted: "Aborted",
    queued: "Queued", running: "Running", waiting: "Waiting", completed: "Completed", cancelled: "Cancelled", timed_out: "Timed out",
  };
  return labels[state] ?? safeText(state, 60);
}

function formatDuration(value) {
  const ms = nonNegative(value);
  if (ms === undefined) return undefined;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusRows(snapshot, t) {
  const status = snapshot.status;
  const output = [
    row("Folder", snapshot.cwd, t),
    row("Branch", snapshot.branch, t),
    row("Model / Effort", combineModelEffort(status.model, status.effort), t),
    row("Profile", status.profile, t),
    row("Session", status.sessionName, t),
  ];
  if (isRecord(status.context)) {
    const progress = contextProgressBar(status.context.pct);
    if (progress) output.push(contextUsageRow(progress, t));
  }
  if (isRecord(status.cost)) {
    const cost = moneyText(status.cost.usd);
    if (cost) output.push(row(status.cost.sub === true ? "Cost · sub" : "Cost", cost, t));
  }
  const agentState = safeText(status.agentState, 40);
  if (agentState) output.push(row("State", stateLabel(agentState) ?? agentState, t, statusColor(t, agentState)));

  if (Array.isArray(status.usage)) {
    for (const provider of status.usage.slice(0, 12)) {
      if (!isRecord(provider)) continue;
      const providerName = safeText(provider.provider, 100);
      if (!providerName || !Array.isArray(provider.limits)) continue;
      for (const limit of provider.limits.slice(0, 12)) {
        if (!isRecord(limit) || !Array.isArray(limit.windows)) continue;
        for (const usageWindow of limit.windows.slice(0, 8)) {
          if (!isRecord(usageWindow)) continue;
          const pct = formatPercent(usageWindow.usedPercent);
          const label = safeText(usageWindow.label, 100);
          if (pct && label) output.push(row(`${providerName} · ${label}`, pct, t, colorForTone(t, percentTone(usageWindow.usedPercent))));
        }
      }
    }
  }
  if (Array.isArray(status.extensionStatuses)) {
    for (const extensionStatus of status.extensionStatuses.slice(0, 24)) {
      const text = safeText(extensionStatus, 300);
      if (text) output.push(row("Integration", text, t));
    }
  }
  return output;
}

function agentItems(snapshot) {
  const agents = snapshot?.status?.agents;
  return isRecord(agents) && Array.isArray(agents.items) ? agents.items.filter(isRecord).slice(0, 3) : undefined;
}

function agentDetails(snapshot, t, target, compact = false, liveAgents = []) {
  const agents = snapshot?.status?.agents;
  const items = agentItems(snapshot);
  const liveTasks = normalizeGentleAgentTasks(agents?.liveTasks);
  const output = [];
  if (agents?.liveAvailable === true) {
    if (liveTasks.length === 0) output.push(div().text_size(12).text_color(t.dim).child("No live Gentle Agents tasks reported"));
    for (const task of liveTasks.slice(0, compact ? 1 : 20)) {
      output.push(h_flex().min_h(22).gap(7).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(12).child(task.label ?? `Task ${task.id}`))
        .child(div().flex_none().text_size(11).text_color(statusColor(t, task.status)).child(stateLabel(task.status) ?? "Unknown")));
    }
  }
  if (liveAgents.length === 0) output.push(div().text_size(12).text_color(t.dim).child("No Herdr agents in this tab"));
  for (const item of liveAgents.slice(0, compact ? 1 : 100)) {
    output.push(h_flex().min_h(22).gap(7).items_center()
      .child(div().w(13).flex_none().text_color(statusColor(t, item.status)).child("●"))
      .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().child(item.name))
      .child(div().flex_none().text_size(11).text_color(statusColor(t, item.status)).child(stateLabel(item.status) ?? "Unknown"))
      .when(Boolean(item.app), (element) => element.child(div().flex_none().text_size(10).text_color(t.dim).child(item.app))));
  }
  if (!isRecord(agents) || !items) {
    output.push(div().pt(5).text_size(12).text_color(t.dim).child("Recent Gentle Agents task history unavailable"));
    return output;
  }
  if (agents.historyPartial === true) output.push(div().text_size(11).text_color(t.ansi3 ?? t.working).child("Recent task history is partial"));
  if (!items.length) {
    output.push(div().text_size(12).text_color(t.dim).child(agents.historyAvailable === true ? "No recent finished tasks" : "Recent task history unavailable"));
    return output;
  }
  for (const item of items.slice(0, compact ? 1 : 3)) {
    const agent = safeText(item.agent, 100) ?? "Agent";
    const label = safeText(item.label, 300) ?? "Finished task";
    const state = safeText(item.state, 32);
    output.push(v_flex().gap(2).py(4).border_b(1).border_color(t.border)
      .child(h_flex().gap(6).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(12).font_semibold().child(label))
        .child(div().flex_none().text_size(11).text_color(statusColor(t, state)).child(stateLabel(state) ?? "Unknown")))
      .child(div().text_size(11).text_color(t.dim).child([
        agent,
        safeText(item.model, 80),
        countText(item.tokens) === undefined ? undefined : `${countText(item.tokens)} tokens`,
        moneyText(item.costUsd),
        formatDuration(item.elapsedMs),
      ].filter(Boolean).join(" · "))));
  }
  return output;
}

function todoItems(snapshot) {
  const todos = snapshot.status.todos;
  return isRecord(todos) && Array.isArray(todos.items) ? todos.items.filter(isRecord).slice(0, 500) : undefined;
}

function todoSummary(snapshot) {
  const todos = todoItems(snapshot);
  if (!todos) return "TODO unavailable";
  const complete = todos.filter((item) => item.state === "done").length;
  return `${complete} of ${todos.length}`;
}

function todoDetails(snapshot, t, expanded = false) {
  const todos = snapshot.status.todos;
  const items = todoItems(snapshot);
  if (!isRecord(todos) || !items) return [div().text_size(12).text_color(t.muted).child("TODO data unavailable")];
  const output = [];
  if (nonNegative(todos.staleTurns) >= 2) output.push(div().pb(3).text_size(11).text_color(t.ansi3 ?? t.working).child(`stale · ${Math.round(todos.staleTurns)} turns`));
  const visible = previewTodos(items, expanded);
  for (const item of visible) {
    const title = safeText(item.text, 300);
    const state = safeText(item.state, 32);
    const note = safeText(item.note, 600);
    if (!title || !state) continue;
    output.push(v_flex().gap(2).py(3).border_b(1).border_color(t.border)
      .child(h_flex().min_h(22).gap(7).items_center()
        .child(div().w(13).flex_none().text_size(11).text_color(statusColor(t, state)).child(state === "done" ? "✓" : state === "in_progress" ? "●" : "○"))
        .child(div().flex_1().min_w(0).truncate().text_size(12).child(title))
        .child(div().flex_none().text_size(10).text_color(t.muted).child(state.replace("_", " "))))
      .when(Boolean(note), (element) => element.child(div().px(4).text_size(11).text_color(t.dim).child(note))));
  }
  if (expanded && items.length > visible.length) output.push(div().text_size(11).text_color(t.dim).child(`… ${items.length - visible.length} more`));
  if (items.length === 0) output.push(div().text_size(12).text_color(t.dim).child("No TODO items"));
  else if (!expanded && visible.length === 0) output.push(div().text_size(12).text_color(t.dim).child("No pending or in-progress TODO items"));
  return output;
}

function jobItems(snapshot) {
  return runningJobs(snapshot.status.jobs)?.slice(0, 100);
}

function jobDetails(snapshot, t, jobs = jobItems(snapshot)) {
  if (!jobs) return [];
  return jobs.map((job) => {
    const description = safeText(job.description ?? job.label, 300) ?? "Job description unavailable";
    return h_flex().min_h(22).gap(7).items_center()
      .child(div().text_color(t.working).child("●"))
      .child(div().flex_1().min_w(0).truncate().text_size(12).child(description));
  }).filter(Boolean);
}

function statsDetails(snapshot, t) {
  const stats = snapshot.status.stats;
  if (!isRecord(stats)) return [];
  const output = [];
  for (const [label, value] of [
    ["Session spend", moneyText(stats.cost)],
    ["Input tokens", countText(stats.input)],
    ["Output tokens", countText(stats.output)],
    ["Cache hit", formatPercent(Number.isFinite(stats.cacheHitRate) ? stats.cacheHitRate * 100 : undefined)],
    ["Tool calls", countText(stats.toolCalls)],
    ["Tool failures", countText(stats.toolErrors)],
    ["Subagent spend", moneyText(stats.subagents?.cost)],
  ]) if (value !== undefined) output.push(row(label, value, t));
  if (Array.isArray(stats.models)) {
    for (const model of stats.models.filter(isRecord).slice(0, 12)) {
      const name = safeText(model.model, 120);
      const cost = moneyText(model.cost);
      const tokens = countText(model.tokens);
      if (name) output.push(row(name, [cost, tokens ? `${tokens} tokens` : undefined].filter(Boolean).join(" · "), t));
    }
  }
  return output;
}

export default class GentleHerdrSidebar extends View {
  init(_initialProps, cx) {
    const settings = props() ?? {};
    this.panel = settings.panel === "agents" ? settings.panel : null;
    this.directoryOverride = settings.snapshotDirectory;
    this.active = true;
    this.requestId = 0;
    this.contextKey = "";
    this.target = paneTarget();
    this.snapshot = null;
    this.error = null;
    this.loading = false;
    this.todoExpanded = true;
    this.collapsedSections = new Set();
    this.liveAgents = [];
    this.refresh(cx);
    this.refreshLiveAgents(cx);
    cx.timer.every(2000, (cx) => {
      this.refresh(cx);
      this.refreshLiveAgents(cx);
    });
    if (!this.panel) this.listenForCommands(cx);
  }

  async close() {
    this.active = false;
    this.requestId += 1;
  }

  listenForCommands(cx) {
    cx.spawn(async () => {
      while (this.active) {
        let command;
        try {
          command = await nextCommand();
        } catch {
          return;
        }
        if (!this.active) return;
        const action = typeof command === "string" ? command.split(":").at(-1).split(".").at(-1) : "";
        if (action === "agents") this.openPanel(action);
      }
    });
  }

  openPanel(panel) {
    const target = this.target ?? paneTarget();
    if (!target.cwd || panel !== "agents") return;
    openOverlay({
      mod: "gentle-herdr-sidebar",
      props: {
        panel,
        cwd: target.cwd,
        machine: target.machine,
        terminal: target.terminal,
        space: target.space,
        tab: target.tab,
        snapshotDirectory: this.directoryOverride,
      },
      kind: "dialog",
      modal: true,
      width: 720,
      height: 760,
    });
  }

  refreshLiveAgents(cx) {
    if (!this.active) return;
    const target = paneTarget();
    const scopeKey = JSON.stringify({ space: target.space, tab: target.tab });
    if (scopeKey !== this.agentScopeKey) {
      this.agentScopeKey = scopeKey;
      this.liveAgents = [];
    }
    const requestId = (this.agentRequestId ?? 0) + 1;
    this.agentRequestId = requestId;
    const targetCopy = { ...target };
    cx.spawn(async (cx) => {
      let value;
      try {
        value = herdrAgents();
      } catch {}
      if (!this.active || requestId !== this.agentRequestId) return;
      this.liveAgents = retainHerdrAgentSnapshot(this.liveAgents, value, targetCopy);
      cx.notify();
    });
  }

  refresh(cx) {
    if (!this.active) return;
    const target = paneTarget();
    const key = JSON.stringify({ cwd: target.cwd, machine: target.machine, terminal: target.terminal, space: target.space, tab: target.tab, panel: this.panel });
    if (key !== this.contextKey) {
      this.contextKey = key;
      this.target = target;
      this.snapshot = null;
      this.error = null;
      this.loading = false;
      this.todoExpanded = true;
      this.collapsedSections = new Set();
      this.requestId += 1;
    }
    if (!target.cwd || this.loading) return;
    this.loading = true;
    const requestId = ++this.requestId;
    const targetCopy = { ...target };
    cx.spawn(async (cx) => {
      try {
        const candidates = await readSnapshots(targetCopy, this.directoryOverride, Date.now());
        const selected = selectSnapshot(candidates, targetCopy.cwd, Date.now());
        if (requestId === this.requestId) {
          this.snapshot = retainFreshSnapshot(this.snapshot, selected, targetCopy.cwd, Date.now());
          this.error = null;
        }
      } catch {
        if (requestId === this.requestId) {
          this.snapshot = retainFreshSnapshot(this.snapshot, null, targetCopy.cwd, Date.now());
          this.error = this.snapshot ? null : "Bridge snapshot reader unavailable";
        }
      } finally {
        if (requestId === this.requestId) {
          this.loading = false;
          cx.notify();
        }
      }
    });
  }

  render(cx) {
    const target = paneTarget();
    const key = JSON.stringify({ cwd: target.cwd, machine: target.machine, terminal: target.terminal, space: target.space, tab: target.tab, panel: this.panel });
    if (key !== this.contextKey) this.refresh(cx);
    const t = theme();
    const snapshot = this.snapshot;

    if (this.panel) {
      const title = "Agents";
      const overlayId = props()?.overlay;
      return v_flex().id(`gentle-herdr-${this.panel}-overlay`).size_full().min_h(0).rounded(10).overflow_hidden()
        .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
        .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
          .child(div().flex_1().font_semibold().child(title))
          .child(div().cursor_pointer().text_color(t.muted).on_click(() => { if (overlayId) closeOverlay(overlayId); }).child("Close")))
        .child(v_flex().id(`gentle-herdr-${this.panel}-details`).flex_1().min_h(0).overflow_y_scrollbar().p(10)
          .children(agentDetails(snapshot, t, target, false, this.liveAgents)));
    }

    if (!target.cwd) {
      return v_flex().id("gentle-herdr-sidebar-empty").size_full().min_h(0).rounded(10).overflow_hidden()
        .bg(t.background).border_1().border_color(t.border).text_color(t.foreground)
        .child(div().py(12).text_center().text_color(t.muted).child("Select a terminal pane to view Gentle Shell status"));
    }

    const liveAgents = this.liveAgents;
    const jobs = snapshot ? jobItems(snapshot) : undefined;
    const sectionOptions = (id) => ({
      expanded: isSectionExpanded(this.collapsedSections, id),
      onToggle: () => {
        this.collapsedSections = toggleCollapsedSection(this.collapsedSections, id);
        cx.notify();
      },
    });
    const sections = snapshot ? [
      section("Status", snapshot.status.agentState ? stateLabel(snapshot.status.agentState) : "", t, { ...sectionOptions("status"), children: () => statusRows(snapshot, t) }),
      section("Agents", "", t, { ...sectionOptions("agents"), onTitleClick: () => this.openPanel("agents"), children: () => agentDetails(snapshot, t, target, true, liveAgents) }),
      section("TODO", todoSummary(snapshot), t, {
        ...sectionOptions("todo"),
        onTitleClick: () => { this.todoExpanded = !this.todoExpanded; cx.notify(); },
        children: () => [v_flex().flex_none().children(
          todoDetails(snapshot, t, this.todoExpanded),
        )],
      }),
      ...(jobs?.length ? [section("Jobs", `${jobs.length} running`, t, { ...sectionOptions("jobs"), children: () => jobDetails(snapshot, t, jobs) })] : []),
    ] : [
      section("Status", this.loading ? "Loading" : "Bridge unavailable", t, { ...sectionOptions("status"), children: () => [
        div().text_size(12).text_color(t.muted).child(this.error ?? "No recent bridge snapshot for this pane"),
      ] }),
      section("Agents", "", t, { ...sectionOptions("agents"), onTitleClick: () => this.openPanel("agents"), children: () => agentDetails(null, t, target, true, liveAgents) }),
      section("TODO", "TODO unavailable", t, { ...sectionOptions("todo"), children: () => [
        div().text_size(12).text_color(t.dim).child("No recent bridge snapshot"),
      ] }),
    ];

    return v_flex().id("gentle-herdr-sidebar").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(12).gap(7).items_center().border_b(1).border_color(t.border)
        .child(div().flex_1())
        .child(div().text_color(t.ansi5 ?? t.accent).child("✿"))
        .child(div().font_semibold().child("Gentle-Pi"))
        .child(div().text_color(t.ansi5 ?? t.accent).child("✿"))
        .child(div().flex_1()))
      .child(v_flex().flex_1().min_h(0)
        .child(v_flex().id("gentle-herdr-sidebar-sections").flex_1().min_h(0).overflow_y_scrollbar()
          .children(sections))
        .when(snapshot && isRecord(snapshot.status.stats), (element) => element.child(
          section("Stats", moneyText(snapshot.status.stats.cost) ?? "Session totals", t, {
            ...sectionOptions("stats"),
            expandUp: true,
            borderBottom: false,
            children: () => statsDetails(snapshot, t),
          }),
        )));
  }
}
