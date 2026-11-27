import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, TextView, ScrollHandle } from "gpui-base";
import { focused, panes, spaces, terminals, props, theme, closeOverlay, shared, run, layout, window as appWindow } from "herdr";
import { resolveTarget, shortDate } from "./session.js";
import { listSessions, readSession, resolveCurrentSession, registeredSession } from "./providers/codex.js";

function button(t, id, label, onClick, active = false, compact = false) {
  return div().id(id).h(compact ? 23 : 31).flex_none().px(compact ? 9 : 11).rounded(compact ? 5 : 7)
    .bg(active ? t.selected : t.raised).border_1().border_color(t.border)
    .text_color(t.foreground).text_size(compact ? 11 : 12).flex().items_center()
    .cursor_pointer().hover(el => el.bg(t.hover))
    .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); }).child(label);
}

// Layout-owned chat: the pane header supplies the exact terminal identity.
// Recheck it before every view change so switching Spaces/Tabs cannot show
// an unrelated Codex conversation from another terminal in the same folder.
function embeddedTarget() {
  const wanted = shared("jec.chat.target");
  if (!wanted?.terminal || !wanted?.pane || !wanted?.tab) return null;
  const currentSpace = spaces().find(space => space.active);
  const activeTab = currentSpace?.tabs?.find(tab => tab.active)?.id;
  if (!activeTab || wanted.tab !== activeTab || currentSpace.machine) return null;
  const p = panes().find(p => p.pane === wanted.pane && p.terminal === wanted.terminal && p.tab === wanted.tab);
  if (!p) return null;
  const candidate = resolveTarget({
    focus: { pane: p.pane, terminal: p.terminal, space: currentSpace.id },
    allPanes: panes(), allSpaces: spaces(), allTerminals: terminals(),
  });
  return candidate.isCodex && candidate.terminal === wanted.terminal
    ? { ...candidate, tab: p.tab } : null;
}
function activeView(tree) {
  if (!tree) return null;
  if (tree.id === "jec-view") return tree.active;
  for (const child of tree.children ?? []) {
    const found = activeView(child);
    if (found) return found;
  }
  return null;
}
const emptyTarget = () => ({ terminal: null, pane: null, cwd: null, machine: null, isCodex: false });

export default class JecChat extends View {
  init(_props, cx) {
    this.embedded = props()?.embedded === true;
    this.target = this.embedded ? (embeddedTarget() ?? emptyTarget()) : resolveTarget({
      focus: focused(), allPanes: panes(), allSpaces: spaces(), allTerminals: terminals(),
    });
    this.sessions = []; this.selected = null; this.messages = []; this.total = 0;
    this.loading = false; this.reading = false; this.error = null;
    this.matchMethod = null; this.previousView = this.embedded ? activeView(layout()) : null;
    this.manual = false; this.stale = false; this.more = false;
    this.registered = false; this.pendingRegistration = null;
    this.scroll = ScrollHandle.new();
    this.closed = false; this.seq = 0; this.readSeq = 0;
    if (this.target.terminal && this.target.cwd && !this.target.machine && this.target.isCodex) this.scan(cx);
    if (this.embedded) cx.timer.every(400, cx => this.syncTarget(cx));
    cx.timer.every(4000, (cx) => {
      if (!this.closed && (this.selected || this.pendingRegistration) && !this.reading && !this.loading && appWindow()?.visible !== false
          && (!this.embedded || activeView(layout()) === "jec-chat-view")) this.refresh(cx);
    });
  }
  close() { this.closed = true; this.seq++; this.readSeq++; }
  back() {
    if (this.embedded) run("layout.select", { stack: "jec-view", child: "main" });
    else closeOverlay(props()?.overlay);
  }
  syncTarget(cx) {
    if (this.closed || !this.embedded) return;
    const next = embeddedTarget();
    const old = this.target;
    const changed = (next?.terminal ?? null) !== old?.terminal || (next?.cwd ?? null) !== old?.cwd
      || (next?.pane ?? null) !== old?.pane;
    if (changed) {
      this.target = next ?? emptyTarget();
      this.selected = null; this.sessions = []; this.messages = []; this.total = 0;
      this.manual = false; this.error = null; this.loading = false; this.reading = false;
      this.seq++; this.readSeq++; this.more = false; this.stale = false; this.matchMethod = null;
      this.registered = false; this.pendingRegistration = null;
      if (next?.isCodex && next.cwd) this.scan(cx);
      cx.notify();
    }
    const view = activeView(layout());
    // A Codex user can type /new or /resume while in Terminal. Every time
    // Chat is reopened, re-identify the session rather than reuse a stale file.
    if (!changed && next && view === "jec-chat-view" && this.previousView !== "jec-chat-view") this.scan(cx);
    this.previousView = view;
    // Another tab/agent was selected while Chat was active.
    if (!next && view === "jec-chat-view") this.back();
  }
  scan(cx, forcePicker = false) {
    if (this.loading || !this.target.cwd || this.target.machine) return;
    this.loading = true; this.error = null; this.selected = null;
    this.matchMethod = null; this.registered = false; this.pendingRegistration = null;
    this.messages = []; this.total = 0; this.readSeq++; this.reading = false;
    const seq = ++this.seq;
    cx.spawn(async cx => {
      try {
        if (!forcePicker && this.target.isCodex && this.target.terminal) {
          const direct = await registeredSession(this.target.cwd, this.target.terminal);
          if (seq !== this.seq || this.closed) return;
          if (direct) { this.acceptRegistration(direct); return; }
        }
        const result = await listSessions(this.target.cwd);
        if (seq !== this.seq || this.closed) return;
        this.sessions = result.sessions ?? []; this.more = Boolean(result.limited || result.total > this.sessions.length);
        if (!forcePicker && this.sessions.length && this.target.isCodex && this.target.terminal) {
          const match = await resolveCurrentSession(this.target.cwd, this.target.terminal, this.sessions);
          if (seq !== this.seq || this.closed) return;
          if (match?.session) {
            this.matchMethod = match.method;
            this.choose(match.session, cx);
          }
        }
      } catch (e) { if (seq === this.seq) this.error = String(e?.message ?? e); }
      finally { if (seq === this.seq) { this.loading = false; cx.notify(); } }
    });
  }
  acceptRegistration(direct) {
    this.registered = true;
    this.pendingRegistration = direct.pending ? direct.id : null;
    this.sessions = []; this.more = false;
    this.selected = direct.session ?? null;
    this.matchMethod = direct.method ?? "registro Codex";
    this.messages = direct.data?.messages ?? [];
    this.total = direct.data?.total ?? this.messages.length;
    this.stale = Boolean(direct.data?.truncated);
    this.error = null;
    this.scroll.scroll_to_item(Math.max(0, this.messages.length - 1));
  }
  choose(session, cx) {
    this.registered = false; this.pendingRegistration = null;
    this.selected = session; this.messages = []; this.total = 0; this.error = null;
    this.readSeq++; this.reading = false;
    this.refresh(cx);
  }
  refresh(cx) {
    if ((!this.selected && !this.pendingRegistration) || this.reading || this.closed) return;
    if (this.registered) { this.refreshRegistered(cx); return; }
    this.reading = true;
    const file = this.selected.file, seq = this.seq, readSeq = ++this.readSeq;
    cx.spawn(async cx => {
      try {
        const result = await readSession(this.target.cwd, file);
        if (this.closed || seq !== this.seq || readSeq !== this.readSeq || this.selected?.file !== file) return;
        this.messages = result.messages ?? []; this.total = result.total ?? this.messages.length;
        this.stale = Boolean(result.truncated); this.error = null;
        this.scroll.scroll_to_item(Math.max(0, this.messages.length - 1));
      } catch (e) { if (seq === this.seq && readSeq === this.readSeq) this.error = String(e?.message ?? e); }
      finally { if (seq === this.seq && readSeq === this.readSeq) { this.reading = false; cx.notify(); } }
    });
  }
  refreshRegistered(cx) {
    this.reading = true;
    const seq = this.seq, readSeq = ++this.readSeq;
    const target = this.target;
    cx.spawn(async cx => {
      try {
        const direct = await registeredSession(target.cwd, target.terminal);
        if (this.closed || seq !== this.seq || readSeq !== this.readSeq) return;
        if (direct) this.acceptRegistration(direct);
        else {
          // SessionEnd removed the label; do not show the ended session.
          this.registered = false; this.pendingRegistration = null;
          this.selected = null; this.messages = []; this.total = 0;
          this.matchMethod = null; this.sessions = [];
        }
      } catch (e) {
        if (seq === this.seq && readSeq === this.readSeq) this.error = String(e?.message ?? e);
      } finally {
        if (seq === this.seq && readSeq === this.readSeq) { this.reading = false; cx.notify(); }
      }
    });
  }
  sessionPicker(t) {
    return v_flex().gap(8).p(14)
      .child(h_flex().items_center().gap(8)
        .child(div().font_semibold().text_size(this.embedded ? 13 : 16).child("Elegí la sesión correcta"))
        .child(div().flex_1())
        .when(this.embedded, el => el.child(button(t, "jec-retry", "Actualizar", cx => this.scan(cx), false, true))))
      .child(div().text_color(t.muted).text_size(12).child(
        "No pudimos confirmar qué sesión está abierta en esta terminal. Elegí la correcta; nunca seleccionamos por fecha."))
      .children(this.sessions.map((s, i) =>
        h_flex().id("jec-session-" + i).p(11).gap(10).rounded(8).bg(t.raised)
          .border_1().border_color(t.border).cursor_pointer().hover(el => el.bg(t.hover))
          .on_click((_e, cx) => this.choose(s, cx))
          .child(div().font_semibold().text_size(12).child(s.id.slice(0, 12)))
          .child(div().flex_1())
          .child(div().text_size(11).text_color(t.muted).child(shortDate(s.updatedAt)))
      ))
      .when(this.more, el => el.child(div().text_size(11).text_color(t.muted).child(
        "Hay más sesiones de las mostradas. Esta versión lista hasta 30 coincidencias.")));
  }
  message(t, m, i) {
    const mine = m.role === "user", tool = m.role === "tool";
    const label = mine ? "Vos" : tool ? "Herramienta" : m.phase === "commentary" ? "Codex · progreso" : "Codex";
    return h_flex().id("jec-row-" + i).w_full().justify_between()
      .when(mine, el => el.child(div().flex_1()))
      .child(v_flex().max_w(770).min_w(0).gap(7).p(13).rounded(10)
        .bg(mine ? t.selected : tool ? t.chrome : t.surface)
        .border_1().border_color(t.border)
        .child(h_flex().items_center().gap(9)
          .child(div().font_semibold().text_size(11).text_color(mine ? t.accent : t.muted).child(label))
          .child(div().text_color(t.dim).text_size(10).child(m.time ? shortDate(m.time) : "")))
        .child(tool
          ? div().text_color(t.muted).text_size(12).child(m.text)
          : TextView.markdown("jec-message-" + i, m.text).raw_html(false).selectable(true).w_full()))
      .when(!mine, el => el.child(div().flex_1()));
  }
  // Use the same 30 px pane header, name, icon, path and chrome as Herdr's
  // terminal pane. The embedded chat is a view, not a new application shell.
  header(t, target) {
    const pane = this.embedded ? panes().find(p => p.pane === target.pane) : null;
    const program = pane?.program;
    const pic = program?.icon
      ? (program.tint ? svg(program.icon).size(14).flex_none().text_color(t.dim)
        : image(program.icon).w(14).h(14).flex_none()) : null;
    const name = this.embedded
      ? pane?.name || ((program?.agent || program?.shell) && program.name) || pane?.title || program?.name || "Codex"
      : "JEC Chat";
    const cwd = this.embedded ? (target.cwd || "")
      : [target.terminal || "sin terminal", target.cwd || ""].filter(Boolean).join(" · ");
    return h_flex().h(this.embedded ? 30 : 53).flex_none()
      .px(this.embedded ? 10 : 16).gap(8).items_center()
      .bg(t.background).border_b(1).border_color(t.border)
      .when(Boolean(pic), el => el.child(pic))
      .child(div().flex_none().font_medium().text_size(this.embedded ? 12 : 15)
        .max_w(this.embedded ? 170 : 240).truncate().child(name))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim)
        .text_size(this.embedded ? 12 : 11).child(cwd))
      .child(button(t, "jec-terminal", this.embedded ? "Terminal" : "← Terminal", () => this.back(), false, this.embedded))
      .when(!this.embedded && Boolean(this.selected), el => el.child(button(t, "jec-choose", "Cambiar sesión", cx => this.resetChoice(cx))))
      .when(!this.embedded, el => el.child(button(t, "jec-refresh", "Actualizar", cx => {
        if (this.selected) this.refresh(cx);
        else this.scan(cx);
      })));
  }
  resetChoice(cx) {
    this.readSeq++; this.reading = false;
    this.scan(cx, true); cx.notify();
  }
  render(cx) {
    const t = theme(), valid = this.embedded ? embeddedTarget() : this.target;
    const target = this.embedded && (valid?.terminal !== this.target?.terminal
      || valid?.pane !== this.target?.pane) ? emptyTarget() : this.target;
    const canScan = Boolean(target.terminal && target.cwd && !target.machine);
    const canRead = canScan && (target.isCodex || this.manual);
    return v_flex().id("jec-chat-root").w_full().h_full().min_h(0)
      .bg(t.background).text_color(t.foreground).text_size(13)
      .when(this.embedded, el => el.rounded(10).overflow_hidden().border_1().border_color(t.border))
      .child(this.header(t, target))
      .when(Boolean(this.error), el => el.child(div().p(12).bg(t.raised).text_color(t.blocked)
        .text_size(12).child(this.error)))
      .when(Boolean(target.machine), el => el.child(div().p(18).text_color(t.muted)
        .child("Esta versión solo lee sesiones de Codex locales. La terminal remota permanece intacta.")))
      .when(!target.machine && !target.terminal, el => el.child(div().p(18).text_color(t.muted)
        .child("Seleccioná primero una terminal de Codex en Herdr y abrí nuevamente JEC Chat.")))
      .when(canScan && !target.isCodex && !this.manual, el =>
        el.child(v_flex().p(18).gap(10)
          .child(div().text_color(t.muted).child("Herdr no identificó esta terminal como Codex."))
          .child(button(t, "jec-manual", "Buscar sesiones en esta carpeta", cx => {
            this.manual = true; this.scan(cx); cx.notify();
          }))))
      .when(canRead && this.loading, el => el.child(div().p(16).text_color(t.muted).child("Buscando sesiones de Codex…")))
      .when(canRead && !this.loading && !this.selected && !this.pendingRegistration && this.sessions.length > 0, el => el.child(this.sessionPicker(t)))
      .when(canRead && !this.loading && Boolean(this.pendingRegistration), el => el.child(v_flex().p(16).gap(10)
        .child(div().text_color(t.muted).child("Sesión registrada: " + this.pendingRegistration.slice(0, 12)))
        .child(div().text_color(t.dim).child("Esperando un historial legible de Codex. Se actualizará automáticamente."))
        .child(h_flex().gap(8)
          .child(button(t, "jec-pending-retry", "Actualizar", cx => this.refresh(cx), false, this.embedded))
          .child(button(t, "jec-pending-pick", "Buscar manualmente", cx => this.resetChoice(cx), false, this.embedded)))))
      .when(canRead && !this.loading && !this.selected && !this.pendingRegistration && this.sessions.length === 0, el =>
        el.child(div().p(18).text_color(t.muted).child(
          "No se encontró una sesión activa de Codex. Iniciá Codex en la terminal o volvé a abrir Chat.")))
      .when(canRead && Boolean(this.selected), el =>
        el.child(v_flex().flex_1().min_h(0)
          .child(h_flex().h(this.embedded ? 29 : 35).px(this.embedded ? 12 : 16)
            .flex_none().items_center().gap(9)
            .child(div().font_semibold().text_size(11).truncate().max_w(160)
              .child(this.selected.id.slice(0, 16)))
            .child(div().text_size(11).text_color(t.muted).child(
              this.reading ? "Actualizando…" : this.total + " eventos"))
            .when(Boolean(this.matchMethod), el => el.child(div().text_size(11).text_color(t.dim)
              .truncate().child("· " + this.matchMethod)))
            .when(this.stale, el => el.child(div().text_size(11).text_color(t.dim).child("Últimos mensajes")))
            .child(div().flex_1().min_w(0))
            .when(this.embedded, el => el
              .child(button(t, "jec-choose-inline", "Sesión", cx => this.resetChoice(cx), false, true))
              .child(button(t, "jec-refresh-inline", "↻", cx => this.refresh(cx), false, true))))
          .child(v_flex().id("jec-chat-scroll").flex_1().min_h(0).overflow_y_scrollbar()
            .track_scroll(this.scroll).p(12).gap(10)
            .children(this.messages.map((m, i) => this.message(t, m, i)))
            .when(!this.messages.length, el => el.child(div().p(12).text_color(t.muted)
              .child(this.reading ? "Cargando mensajes…" : "Esta sesión no tiene mensajes legibles."))))
          .child(div().flex_none().h(this.embedded ? 27 : 39)
            .border_t(1).border_color(t.border).px(12).flex().items_center()
            .text_size(11).text_color(t.muted).truncate()
            .child(this.embedded
              ? "Solo lectura · Para escribir o aprobar acciones, elegí Terminal"
              : "Solo lectura · Para escribir o aprobar acciones, elegí Terminal. La sesión sigue ejecutándose."))));
  }
}
