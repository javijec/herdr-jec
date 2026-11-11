import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { focused, panes, spaces, agents, theme } from "herdr";
import { footerTelemetry } from "./model.js";
import { readWorkspaceSnapshot } from "./snapshot-reader.js";

function activePaneTarget() {
  const space = spaces().find((item) => item.active);
  const tab = space?.tabs?.find((item) => item.active);
  const current = focused();
  const visiblePanes = panes().filter((item) => item.tab === tab?.id && item.terminal && item.cwd);
  const pane = visiblePanes.find((item) => item.pane === current?.pane)
    ?? visiblePanes.find((item) => item.focused)
    ?? visiblePanes[0];
  return { cwd: pane?.cwd ?? current?.cwd ?? space?.folder ?? "", machine: space?.machine ?? null };
}


export default class WorkspaceStatus extends View {
  init(_initialProps, cx) {
    this.active = true;
    this.loading = false;
    this.requestId = 0;
    this.targetKey = "";
    this.snapshot = undefined;
    this.refresh(cx);
    cx.timer.every(2000, (cx) => this.refresh(cx));
  }

  close() {
    this.active = false;
    this.requestId += 1;
  }

  refresh(cx, target = activePaneTarget()) {
    if (!this.active) return;
    const key = JSON.stringify({ cwd: target.cwd, machine: target.machine });
    if (key !== this.targetKey) {
      this.targetKey = key;
      this.snapshot = undefined;
      this.loading = false;
      this.requestId += 1;
    }
    if (!target.cwd || this.loading) return;
    this.loading = true;
    const requestId = ++this.requestId;
    const targetCopy = { ...target };
    cx.spawn(async (cx) => {
      try {
        const snapshot = await readWorkspaceSnapshot(targetCopy, Date.now());
        if (this.active && requestId === this.requestId) this.snapshot = snapshot;
      } catch {
        if (this.active && requestId === this.requestId) this.snapshot = undefined;
      } finally {
        if (this.active && requestId === this.requestId) {
          this.loading = false;
          cx.notify();
        }
      }
    });
  }

  render(cx) {
    const target = activePaneTarget();
    const key = JSON.stringify({ cwd: target.cwd, machine: target.machine });
    if (key !== this.targetKey) this.refresh(cx, target);
    const t = theme();
    const list = agents();
    const needs = list.filter((agent) => agent.status === "blocked").length;
    const telemetry = footerTelemetry(this.snapshot);
    const contextPct = telemetry?.contextPct;
    const contextColor = contextPct >= 95 ? t.blocked : contextPct >= 80 ? t.working : t.foreground;
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .when(Boolean(telemetry?.model), (element) => element.child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(telemetry.model)))
      .when(contextPct !== undefined, (element) => element.child(h_flex().flex_none().gap(6).items_center()
        .child(div().text_size(10).text_color(t.muted).child("Context"))
        .child(div().w(48).h(5).rounded(3).bg(t.border)
          .child(div().w(Math.round(48 * contextPct / 100)).h(5).rounded(3).bg(contextColor)))
        .child(div().flex_none().text_size(11).text_color(contextColor).child(`${Math.round(contextPct)}%`))))
      .child(h_flex().min_w(0).gap(6).items_center().child(div().size(6).flex_none().rounded(3).bg(needs > 0 ? t.blocked : t.dim))
        .child(div().flex_1().min_w(0).truncate().child(`${list.length} agents`))
        .when(needs > 0, (element) => element.child(div().flex_1().min_w(0).truncate().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1().min_w(0));
  }
}
