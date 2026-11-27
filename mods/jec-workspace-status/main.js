// Based on official Herdr Workspace Status @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa; Apache-2.0 (LICENSE.herdr).
// JEC v0.3: active machine availability and workspace context.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, terminals, machines, theme, run, window, keys, exec, checking } from "herdr";
import { probe, describeMetrics, REFRESH_MS, RETRY_MS } from "./machine-metrics.js";
import { agentSummary, summaryLabel } from "./agent-summary.js";
import { workspaceContext } from "./workspace-context.js";

export default class WorkspaceStatus extends View {
  init(_props, cx) {
    this.metrics = new Map();
    this.metricsBusy = false;
    if (checking()) return;
    // One job at a time, active visible machine only. Never poll from render().
    this.refreshMetrics(cx);
    cx.timer.every(5000, cx => this.refreshMetrics(cx));
  }

  refreshMetrics(cx) {
    if (checking() || !window()?.visible || !window()?.active || this.metricsBusy) return;
    const space = spaces().find(s => s.active);
    if (!space) return;
    const on = space.machine ?? null;
    if (machines().find(m => m.name === on)?.layout !== "ready") return;
    const now = Date.now();
    const prev = this.metrics.get(on);
    if (prev && now < prev.next) return;
    this.metricsBusy = true;
    cx.spawn(async cx => {
      try {
        const platform = on === null ? window()?.platform : null;
        const preferred = platform === "windows" || platform === "linux" ? platform : (prev?.platform ?? null);
        const result = await probe(exec, on, preferred);
        const at = Date.now();
        this.metrics.set(on, result
          ? { ...result, at, next: at + REFRESH_MS }
          : { failed: true, at, next: at + RETRY_MS });
      } finally {
        this.metricsBusy = false;
        cx.notify();
      }
    });
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const context = workspaceContext(space, machines());
    const summary = agentSummary(agents(), terminals());
    const needs = summary.blocked;
    const machineMetrics = describeMetrics(this.metrics?.get(space?.machine ?? null), Date.now(), context.machineName);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(h_flex().id("jec-machine-status").gap(6).items_center().min_w(0)
        .cursor_pointer().hover(el => el.text_color(t.foreground))
        .tooltip(context.machineHint)
        .on_click(() => run("app.settings", { section: "machines" }))
        .child(svg(`mods/workspace-chrome/${space?.machine ? "server" : "monitor"}.svg`).size(13).flex_none())
        .child(div().min_w(0).max_w(130).truncate().child(context.machineName))
        .child(div().size(6).rounded(3).flex_none().bg(context.state === "ready" ? t.ansi2 : context.state === "unavailable" ? t.blocked : t.dim)))
      .when(Boolean(space), el => el.child(h_flex().min_w(0).gap(5).items_center().tooltip(context.spaceHint)
        .child(div().min_w(0).max_w(130).truncate().child(context.spaceName))
        .child(div().flex_none().text_color(t.dim).child(`· ${context.tabs} ${context.tabs === 1 ? "tab" : "tabs"}`))))
      .when(Boolean(space?.branch), el => el.child(h_flex().gap(6).items_center().min_w(0).tooltip(space.branch)
        .child(svg("mods/workspace-chrome/branch.svg").size(13).flex_none())
        .child(div().min_w(0).max_w(120).truncate().child(space.branch))))
      .child(h_flex().gap(6).items_center().flex_none().tooltip(summaryLabel(summary)).child(div().size(6).rounded(3).bg(summary.working ? t.working : t.dim)).child(`${summary.total} ${summary.total === 1 ? "agent" : "agents"}`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} ${needs === 1 ? "needs" : "need"} you`))))
      .child(div().flex_1().min_w(0))
      .when(Boolean(space) && context.state === "ready", el => el.child(div().id("jec-metrics").min_w(0).max_w(260).truncate().text_color(machineMetrics.available ? t.muted : t.dim).tooltip(machineMetrics.hint).child(machineMetrics.text)))
      .child(div().id("palette").flex_none().text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t)));
  }
}
