import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView, ScrollHandle } from "gpui-base";
import { focused, panes, spaces, terminals, props, theme, closeOverlay, window as appWindow } from "herdr";
import { resolveTarget, shortDate } from "./session.js";
import { listSessions, readSession } from "./providers/codex.js";

function button(t, id, label, onClick, active = false) {
  return div().id(id).h(31).flex_none().px(11).rounded(7)
    .bg(active ? t.selected : t.raised).border_1().border_color(t.border)
    .text_color(t.foreground).text_size(12).flex().items_center()
    .cursor_pointer().hover(el => el.bg(t.hover))
    .on_click((_e, cx) => onClick(cx)).child(label);
}

export default class JecChat extends View {
  init(_props, cx) {
    this.target = resolveTarget({
      focus: focused(), allPanes: panes(), allSpaces: spaces(), allTerminals: terminals(),
    });
    this.sessions = []; this.selected = null; this.messages = []; this.total = 0;
    this.loading = false; this.reading = false; this.error = null;
    this.manual = false; this.stale = false; this.more = false;
    this.scroll = ScrollHandle.new();
    this.closed = false; this.seq = 0;
    if (this.target.terminal && this.target.cwd && !this.target.machine && this.target.isCodex) this.scan(cx);
    cx.timer.every(4000, (cx) => {
      if (!this.closed && this.selected && !this.reading && appWindow()?.visible !== false) this.refresh(cx);
    });
  }
  close() { this.closed = true; this.seq++; }
  back() { closeOverlay(props()?.overlay); }
  scan(cx) {
    if (this.loading || !this.target.cwd || this.target.machine) return;
    this.loading = true; this.error = null; this.selected = null;
    this.messages = []; this.total = 0;
    const seq = ++this.seq;
    cx.spawn(async cx => {
      try {
        const result = await listSessions(this.target.cwd);
        if (seq !== this.seq || this.closed) return;
        this.sessions = result.sessions ?? []; this.more = Boolean(result.limited || result.total > this.sessions.length);
        if (this.sessions.length === 1) this.choose(this.sessions[0], cx);
      } catch (e) { if (seq === this.seq) this.error = String(e?.message ?? e); }
      finally { if (seq === this.seq) { this.loading = false; cx.notify(); } }
    });
  }
  choose(session, cx) {
    this.selected = session; this.messages = []; this.total = 0; this.error = null;
    this.refresh(cx);
  }
  refresh(cx) {
    if (!this.selected || this.reading || this.closed) return;
    this.reading = true;
    const file = this.selected.file, seq = this.seq;
    cx.spawn(async cx => {
      try {
        const result = await readSession(this.target.cwd, file);
        if (this.closed || seq !== this.seq || this.selected?.file !== file) return;
        this.messages = result.messages ?? []; this.total = result.total ?? this.messages.length;
        this.stale = Boolean(result.truncated); this.error = null;
        this.scroll.scroll_to_item(Math.max(0, this.messages.length - 1));
      } catch (e) { if (seq === this.seq) this.error = String(e?.message ?? e); }
      finally { if (seq === this.seq) { this.reading = false; cx.notify(); } }
    });
  }
  sessionPicker(t) {
    return v_flex().gap(8).p(14)
      .child(div().font_semibold().text_size(16).child("Elegí la sesión correcta"))
      .child(div().text_color(t.muted).text_size(12).child(
        "Varias sesiones Codex usan esta carpeta. Elegí una: no se selecciona automáticamente la más reciente."))
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
  render(cx) {
    const t = theme(), target = this.target;
    const canScan = Boolean(target.terminal && target.cwd && !target.machine);
    const canRead = canScan && (target.isCodex || this.manual);
    return v_flex().id("jec-chat-root").w_full().h_full().min_h(0)
      .bg(t.background).text_color(t.foreground).text_size(13)
      .child(h_flex().h(53).flex_none().px(16).gap(10).items_center()
        .border_b(1).border_color(t.border)
        .child(div().font_semibold().text_size(17).child("JEC Chat"))
        .child(div().text_color(t.muted).text_size(11).truncate().flex_1().child(
          [target.terminal || "sin terminal", target.cwd || ""].filter(Boolean).join(" · ")))
        .child(button(t, "jec-terminal", "← Terminal", () => this.back()))
        .when(Boolean(this.selected), el => el.child(button(t, "jec-choose", "Cambiar sesión", cx => {
          this.selected = null; this.messages = []; this.reading = false; this.error = null; cx.notify();
        })))
        .child(button(t, "jec-refresh", "Actualizar", cx => {
          if (this.selected) this.refresh(cx); else if (canRead) this.scan(cx);
        })))
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
      .when(canRead && !this.loading && !this.selected && this.sessions.length > 1, el => el.child(this.sessionPicker(t)))
      .when(canRead && !this.loading && !this.selected && this.sessions.length === 0, el =>
        el.child(div().p(18).text_color(t.muted).child(
          "No se encontraron sesiones de Codex en esta carpeta. Iniciá Codex en la terminal y volvé a actualizar.")))
      .when(canRead && Boolean(this.selected), el =>
        el.child(v_flex().flex_1().min_h(0)
          .child(h_flex().h(35).px(16).flex_none().items_center().gap(10)
            .child(div().font_semibold().text_size(11).child(this.selected.id.slice(0, 16)))
            .child(div().text_size(11).text_color(t.muted).child(
              this.reading ? "Actualizando…" : this.total + " eventos"))
            .when(this.stale, el => el.child(div().text_size(11).text_color(t.dim).child("Últimos mensajes"))))
          .child(v_flex().id("jec-chat-scroll").flex_1().min_h(0).overflow_y_scrollbar()
            .track_scroll(this.scroll).p(12).gap(10)
            .children(this.messages.map((m, i) => this.message(t, m, i)))
            .when(!this.messages.length, el => el.child(div().p(12).text_color(t.muted)
              .child(this.reading ? "Cargando mensajes…" : "Esta sesión no tiene mensajes legibles."))))
          .child(div().flex_none().border_t(1).border_color(t.border).p(11)
            .text_size(11).text_color(t.muted)
            .child("Solo lectura · Para escribir o aprobar acciones, usá ← Terminal. La sesión sigue ejecutándose."))));
  }
}
