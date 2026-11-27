// Derived from herdrdev/herdr-app defaults/mods/pane/main.js @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa
// Apache-2.0; see LICENSE.herdr. Modified for JEC header role and Chat action.
// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, layout, spaces, shared, setShared } from "herdr";
import { detectAgent, supportsChat } from "./provider-catalog.js";
import { VIEW_KEY, activeTab, wantedPane, rememberChat, activeView } from "./view-state.js";

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function chatAvailable(p) {
  const space = spaces().find(s => s.tabs?.some(tab => tab.id === p?.tab));
  return Boolean(space && supportsChat({
    terminal: p?.terminal, cwd: p?.cwd, machine: space.machine,
    providerId: detectAgent(p?.program, p?.app)
  }));
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export class PaneHeader {
  constructor(cx) {
    this.hovered = false;
    // Restore only the remembered pane of the current tab.
    cx.timer.every(250, () => this.restoreChat());
  }
  restoreChat() {
    if (activeView(layout()) !== "main") return;
    const active = activeTab(spaces());
    const p = this.me();
    const wanted = wantedPane(shared(VIEW_KEY), active, panes());
    if (!wanted || !p || p.pane !== wanted.pane || p.terminal !== wanted.terminal
        || p.tab !== active?.tab || !chatAvailable(p)) return;
    run("layout.select", { stack: "jec-view", child: "jec-chat-view" });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }

  chatButton(t, p) {
    return div().id("jec-chat-toggle-" + p.pane).h(23).px(9)
      .rounded(5).border_1().border_color(t.border).bg(t.raised)
      .text_size(11).font_semibold().text_color(t.foreground)
      .flex().items_center().cursor_pointer()
      .hover(el => el.bg(t.hover))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        // This is the exact pane/terminal, never a guess based on cwd.
        const active = activeTab(spaces());
        const live = this.me();
        if (!live || live.terminal !== p.terminal || live.pane !== p.pane || live.tab !== active?.tab || !chatAvailable(live)) return;
        setShared(VIEW_KEY, rememberChat(shared(VIEW_KEY), active, live));
        run("layout.select", { stack: "jec-view", child: "jec-chat-view" });
      }).child("Chat");
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = p.name || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(chatAvailable(p), el => el.child(this.chatButton(t, p)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
