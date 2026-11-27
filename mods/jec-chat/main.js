import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, TextView, ScrollHandle, TextareaState, Textarea } from "gpui-base";
import { focused, panes, spaces, terminals, props, theme, closeOverlay, shared, setShared, run, layout, window as appWindow } from "herdr";
import { resolveTarget, shortDate } from "./session.js";
import { providerFor, providerName, sessionKey, sameActiveSession, allowsAction } from "./providers/index.js";
import { supportsChat } from "./provider-catalog.js";
import { VIEW_KEY, activeTab, wantedPane, forgetChat, activeView } from "./view-state.js";
import { PaneHeader } from "./pane-header.js";

function button(t, id, label, onClick, active = false, compact = false) {
  return div().id(id).h(compact ? 23 : 31).flex_none().px(compact ? 9 : 11).rounded(compact ? 5 : 7)
    .bg(active ? t.selected : t.raised).border_1().border_color(t.border)
    .text_color(t.foreground).text_size(compact ? 11 : 12).flex().items_center()
    .cursor_pointer().hover(el => el.bg(t.hover))
    .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); }).child(label);
}

// Resolve only the remembered pane of the CURRENT tab/space. A different
// tab may have its own Chat preference, or may remain in Terminal.
function embeddedTarget() {
  const allSpaces = spaces(), allPanes = panes();
  const active = activeTab(allSpaces);
  const wanted = wantedPane(shared(VIEW_KEY), active, allPanes);
  if (!wanted) return null;
  const candidate = resolveTarget({
    focus: { pane: wanted.pane, terminal: wanted.terminal, space: active.space },
    allPanes, allSpaces, allTerminals: terminals(),
  });
  return supportsChat(candidate) && candidate.terminal === wanted.terminal
    ? { ...candidate, tab: wanted.tab, space: active.space } : null;
}
const emptyTarget = () => ({ terminal: null, pane: null, cwd: null, machine: null, providerId: null });

export default class JecChat extends View {
  init(_props, cx) {
    const config = props() ?? {};
    this.headerRole = config.paneHeader === true;
    if (this.headerRole) { this.paneHeader = new PaneHeader(cx); return; }
    this.embedded = config.embedded === true;
    this.target = this.embedded ? (embeddedTarget() ?? emptyTarget()) : resolveTarget({
      focus: focused(), allPanes: panes(), allSpaces: spaces(), allTerminals: terminals(),
    });
    this.provider = providerFor(this.target);
    this.sessions = []; this.selected = null; this.messages = []; this.total = 0;
    this.loading = false; this.reading = false; this.error = null;
    this.matchMethod = null; this.previousView = this.embedded ? activeView(layout()) : null;
    this.manual = false; this.stale = false; this.more = false;
    this.registered = false; this.pendingRegistration = null;
    this.coreStatus = null;
    this.scroll = ScrollHandle.new();
    this.composer = TextareaState.new({ placeholder: "Escribí un mensaje…", rows: 3 });
    this.draftKey = null; this.drafts = new Map();
    this.draft = ""; this.sending = false; this.sendError = null; this.sendNotice = null;
    this.waitingFor = null; this.interrupting = false;
    this.dialog = null; this.dialogLoading = false; this.lastPoll = 0;
    this.composer.on("change", (_e, cx) => {
      this.draft = this.composer.value();
      if (this.draftKey) {
        this.drafts.set(this.draftKey, this.draft);
        if (this.drafts.size > 30) this.drafts.delete(this.drafts.keys().next().value);
      }
      cx.notify();
    });
    // The native textarea emits submit with explicit Shift/secondary flags.
    // Older bridge versions without these flags keep the button as fallback.
    this.composer.on("submit", (e, cx) => {
      if (e?.shift !== false || e?.secondary === true) return;
      if (this.closed || this.sending || this.interrupting || !allowsAction(this.target, this.provider, this.selected, this.registered, "send")) return;
      if (!this.canSend()) return;
      // The underlying textarea inserts a newline before emitting submit.
      // Remove only that newline at the current caret, not existing lines.
      try {
        const value = this.composer.value(), range = this.composer.selected_range();
        if (range.start === range.end && range.start > 0 && value[range.start - 1] === "\n") {
          const pos = range.start - 1;
          this.composer.set_value(value.slice(0, pos) + value.slice(pos + 1));
          this.composer.set_selected_range({ start: pos, end: pos });
        }
      } catch { /* Button remains available if the selection API is older. */ }
      if (this.composer.value().trim()) this.send(cx);
    });
    this.closed = false; this.seq = 0; this.readSeq = 0;
    if (this.provider) this.scan(cx);
    if (this.embedded) cx.timer.every(400, cx => this.syncTarget(cx));
    cx.timer.every(1000, (cx) => {
      if (this.closed || (!this.selected && !this.pendingRegistration) || this.reading || this.loading || appWindow()?.visible === false
          || (this.embedded && activeView(layout()) !== "jec-chat-view")) return;
      const state = this.agentState();
      const busy = this.sending || (this.waitingFor && !this.waitingFor.expired) || this.interrupting || state === "working" || state === "blocked";
      const interval = busy ? 1000 : 2500;
      if (Date.now() - this.lastPoll >= interval) { this.lastPoll = Date.now(); this.refresh(cx); }
    });
  }
  close() { if (this.headerRole) return; this.closed = true; this.seq++; this.readSeq++; this.composer.release(); }
  back() {
    this.composer.blur();
    if (this.embedded) {
      // An explicit Terminal click changes ONLY this tab's preference.
      const active = activeTab(spaces());
      const live = embeddedTarget();
      if (!live || live.terminal !== this.target?.terminal || live.pane !== this.target?.pane || live.tab !== this.target?.tab || live.space !== this.target?.space) return;
      setShared(VIEW_KEY, forgetChat(shared(VIEW_KEY), active));
      run("layout.select", { stack: "jec-view", child: "main" });
    } else closeOverlay(props()?.overlay);
  }
  syncTarget(cx) {
    if (this.closed || !this.embedded) return;
    const next = embeddedTarget();
    const old = this.target;
    const changed = (next?.terminal ?? null) !== old?.terminal || (next?.cwd ?? null) !== old?.cwd
      || (next?.pane ?? null) !== old?.pane || (next?.providerId ?? null) !== old?.providerId
      || (next?.machine ?? null) !== old?.machine
      || (next?.tab ?? null) !== (old?.tab ?? null) || (next?.space ?? null) !== (old?.space ?? null);
    if (changed) {
      this.composer.blur(); this.bindDraft(null);
      this.target = next ?? emptyTarget();
      this.provider = providerFor(this.target);
      this.selected = null; this.sessions = []; this.messages = []; this.total = 0;
      this.manual = false; this.error = null; this.loading = false; this.reading = false;
      this.seq++; this.readSeq++; this.more = false; this.stale = false; this.matchMethod = null;
      this.registered = false; this.pendingRegistration = null; this.coreStatus = null;
      this.dialog = null; this.waitingFor = null; this.sendError = null; this.sendNotice = null;
      if (this.provider) this.scan(cx);
      cx.notify();
    }
    const view = activeView(layout());
    // A Codex user can type /new or /resume while in Terminal. Every time
    // Chat is reopened, re-identify the session rather than reuse a stale file.
    if (!changed && next && view === "jec-chat-view" && this.previousView !== "jec-chat-view") this.scan(cx);
    this.previousView = view;
    // Automatic fallback must NOT forget the previous tab's preference.
    // The visible pane header restores Chat when returning to a remembered tab.
    if (!next && view === "jec-chat-view") {
      this.composer.blur();
      run("layout.select", { stack: "jec-view", child: "main" });
    }
  }
  scan(cx, forcePicker = false) {
    const target = this.target, provider = this.provider;
    if (this.loading || !provider?.capabilities.history || !target.cwd || (target.machine && !provider.capabilities.remote)) return;
    this.loading = true; this.error = null; this.selected = null;
    this.matchMethod = null; this.registered = false; this.pendingRegistration = null; this.coreStatus = null;
    this.messages = []; this.total = 0; this.readSeq++; this.reading = false;
    const seq = ++this.seq;
    cx.spawn(async cx => {
      try {
        if (!forcePicker && target.providerId === provider.id && target.terminal) {
          const direct = await provider.identify(target);
          if (seq !== this.seq || this.closed) return;
          if (direct) { this.acceptRegistration(direct); return; }
        }
        if (!provider.capabilities.discovery) {
          this.acceptRegistration({pending:true,reason:"Esperando el registro de la sesión activa."});
          return;
        }
        const result = await provider.list(target);
        if (seq !== this.seq || this.closed) return;
        this.sessions = result.sessions ?? []; this.more = Boolean(result.limited || result.total > this.sessions.length);
        if (!forcePicker && this.sessions.length && target.providerId === provider.id && target.terminal) {
          const match = await provider.match(target, this.sessions);
          if (seq !== this.seq || this.closed) return;
          if (match?.session) {
            this.matchMethod = match.method;
            this.choose(match.session, cx);
          }
        }
      } catch (e) {
        if (seq === this.seq && !this.closed) {
          if (!provider.capabilities.discovery) this.acceptRegistration({pending:true,reason:"No se pudo consultar el agente. Reintentando…"});
          else this.error = String(e?.message ?? e);
        }
      }
      finally { if (seq === this.seq) { this.loading = false; cx.notify(); } }
    });
  }
  acceptRegistration(direct) {
    this.registered = true;
    this.coreStatus = direct.status ?? null;
    this.pendingRegistration = direct.pending ? (direct.id ?? "pending") : null;
    this.pendingReason = direct.pending ? direct.reason ?? null : null;
    this.sessions = []; this.more = false;
    const previousSession = this.selected;
    this.selected = direct.session ?? null;
    if (!sameActiveSession(previousSession, this.selected)) {
      this.dialog = null; this.waitingFor = null; this.sendNotice = null; this.sendError = null;
    }
    this.bindDraft(sessionKey(this.target, this.provider, this.selected));
    this.matchMethod = direct.method ?? "registro " + providerName(this.target, this.provider);
    const messages = direct.data?.messages ?? [];
    const total = direct.data?.total ?? messages.length;
    const last = messages[messages.length - 1], previous = this.messages[this.messages.length - 1];
    const changed = !sameActiveSession(previousSession, this.selected)
      || total !== this.total || messages.length !== this.messages.length
      || last?.time !== previous?.time || last?.text !== previous?.text;
    this.messages = messages; this.total = total;
    this.stale = Boolean(direct.data?.truncated);
    this.error = null;
    if (this.waitingFor && (this.waitingFor.key !== this.draftKey || this.total > this.waitingFor.total
        || ["working", "blocked"].includes(this.coreStatus))) {
      this.waitingFor = null; this.sendNotice = null;
    }
    if (this.waitingFor && !this.waitingFor.expired && Date.now() - this.waitingFor.at > 15000) {
      this.waitingFor.expired = true;
      this.sendNotice = "Herdr entregó el mensaje. Si no aparece en el historial, revisá Terminal.";
    }
    if (this.coreStatus !== "blocked") this.dialog = null;
    if (changed) this.scroll.scroll_to_item(Math.max(0, this.messages.length - 1));
  }
  choose(session, cx) {
    this.bindDraft(null);
    this.registered = false; this.pendingRegistration = null;
    this.selected = session; this.messages = []; this.total = 0; this.error = null;
    this.readSeq++; this.reading = false;
    this.refresh(cx);
  }
  refresh(cx) {
    if ((!this.selected && !this.pendingRegistration) || this.reading || this.closed) return;
    if (this.registered) { this.refreshRegistered(cx); return; }
    this.reading = true;
    const session = this.selected, target = this.target, provider = this.provider;
    const seq = this.seq, readSeq = ++this.readSeq;
    cx.spawn(async cx => {
      try {
        const result = await provider.read(target, session);
        if (this.closed || seq !== this.seq || readSeq !== this.readSeq || this.selected?.id !== session.id) return;
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
    const target = this.target, provider = this.provider;
    cx.spawn(async cx => {
      try {
        const direct = await provider.identify(target);
        if (this.closed || seq !== this.seq || readSeq !== this.readSeq) return;
        if (direct) this.acceptRegistration(direct);
        else if (!provider.capabilities.discovery) {
          this.acceptRegistration({pending:true,reason:"Esperando el registro de la sesión activa."});
        } else {
          // SessionEnd removed the label; do not show the ended session.
          this.registered = false; this.pendingRegistration = null;
          this.bindDraft(null);
          this.selected = null; this.messages = []; this.total = 0;
          this.matchMethod = null; this.sessions = [];
        }
      } catch (e) {
        if (seq === this.seq && readSeq === this.readSeq && !this.closed) {
          if (!provider.capabilities.discovery) this.acceptRegistration({pending:true,reason:"No se pudo consultar el agente. Reintentando…"});
          else this.error = String(e?.message ?? e);
        }
      } finally {
        if (seq === this.seq && readSeq === this.readSeq) { this.reading = false; cx.notify(); }
      }
    });
  }
  bindDraft(key) {
    if (key === this.draftKey) return;
    this.draftKey = key;
    this.draft = key ? this.drafts.get(key) ?? "" : "";
    this.composer.set_value(this.draft);
    this.sendError = null; this.sendNotice = null; this.waitingFor = null; this.dialog = null;
  }
  agentState(target = this.target) {
    // Direct-only providers can require both the TUI and core to agree.
    if (this.registered && this.provider?.capabilities.discovery === false) return this.coreStatus;
    return this.coreStatus ?? this.provider?.status(terminals().find(x => x.address === target?.terminal)) ?? null;
  }
  canSend(target = this.target) {
    const state = this.agentState(target);
    if (this.provider?.capabilities.discovery === false) return state === "idle" || state === "done";
    return state !== "working" && state !== "blocked";
  }
  send(cx) {
    if (this.closed || this.sending || this.interrupting || this.loading || !allowsAction(this.target, this.provider, this.selected, this.registered, "send") || !this.canSend()) return;
    const target = this.target, provider = this.provider, session = this.selected, key = this.draftKey, seq = this.seq;
    const prompt = this.composer.value(), baseline = this.total;
    if (!key || !prompt.trim()) {
      this.sendError = "Escribí un mensaje antes de enviar."; cx.notify(); return;
    }
    const current = () => {
      return this.provider === provider && this.draftKey === key && this.currentAction(target, session, seq);
    };
    if (!current()) { this.sendError = "El panel cambió. Volvé a abrir Chat."; cx.notify(); return; }
    this.sending = true; this.sendError = null; this.sendNotice = null; cx.notify();
    cx.spawn(async cx => {
      try {
        const sent = await provider.send(target, session, prompt, current);
        // Never erase edits or another session's draft made during the send.
        if (current() && this.drafts.get(key) === prompt) this.drafts.delete(key);
        if (current()) {
          if (this.composer.value() === prompt) {
            this.composer.set_value(""); this.draft = "";
          }
          if (sent?.started === true && this.total <= baseline) this.coreStatus = "working";
          if (this.total <= baseline && !["working", "blocked"].includes(this.coreStatus)) {
            this.waitingFor = { key, total: baseline, at: Date.now() };
            this.sendNotice = "Mensaje entregado · esperando el historial";
          } else { this.waitingFor = null; this.sendNotice = null; }
          this.refresh(cx);
        }
      } catch (e) {
        if (current()) this.sendError = String(e?.message ?? e);
      } finally {
        this.sending = false;
        if (!this.closed) cx.notify();
      }
    });
  }
  currentAction(target, session, seq) {
    if (this.closed || this.seq !== seq || !this.registered || !sameActiveSession(this.selected, session)
        || this.target?.terminal !== target.terminal || this.target?.providerId !== target.providerId
        || this.target?.machine !== target.machine) return false;
    if (!this.embedded) return true;
    const live = embeddedTarget();
    return activeView(layout()) === "jec-chat-view" && live?.terminal === target.terminal && live?.pane === target.pane
      && live?.providerId === target.providerId && live?.machine === target.machine
      && live?.tab === target.tab && live?.space === target.space;
  }
  stop(cx) {
    if (this.closed || this.sending || this.interrupting || !allowsAction(this.target, this.provider, this.selected, this.registered, "interrupt")) return;
    const target = this.target, provider = this.provider, session = this.selected, seq = this.seq;
    const current = () => this.currentAction(target, session, seq);
    if (!current()) return;
    this.interrupting = true; this.sendError = null; this.sendNotice = null; this.waitingFor = null; cx.notify();
    cx.spawn(async cx => {
      try {
        await provider.interrupt(target, session, current);
      } catch (e) { if (current()) this.sendError = String(e?.message ?? e); }
      finally {
        this.interrupting = false;
        if (current()) this.refresh(cx);
        if (!this.closed) cx.notify();
      }
    });
  }
  inspectDialog(cx) {
    if (this.dialogLoading || this.closed || !allowsAction(this.target, this.provider, this.selected, this.registered, "blockedPreview")) return;
    const target = this.target, provider = this.provider, session = this.selected, seq = this.seq;
    const current = () => this.currentAction(target, session, seq);
    if (!current()) return;
    this.dialogLoading = true; this.sendError = null; cx.notify();
    cx.spawn(async cx => {
      try {
        const screen = await provider.blockedPreview(target, session);
        if (current()) this.dialog = screen || null;
      } catch (e) { if (current()) this.sendError = String(e?.message ?? e); }
      finally {
        this.dialogLoading = false;
        if (current()) this.refresh(cx);
        if (!this.closed) cx.notify();
      }
    });
  }
  composerView(t, target) {
    if (!allowsAction(target, this.provider, this.selected, this.registered, "send")) {
      return div().flex_none().h(27).border_t(1).border_color(t.border).px(12)
        .flex().items_center().text_size(11).text_color(t.muted).truncate()
        .child("Solo lectura · vinculá la sesión al agente activo para enviar mensajes.");
    }
    const state = this.agentState(target), name = providerName(target, this.provider);
    // Never let a stale presentation status or delayed change event prevent
    // the click; sendPrompt performs a fresh, authoritative idle check.
    const ready = !this.loading && !this.sending && !this.interrupting && this.canSend(target);
    const enabled = ready && Boolean(this.composer.value().trim());
    const status = this.interrupting ? "Interrumpiendo…" : this.sending ? "Enviando…" : state === "blocked" ? "Requiere tu intervención"
      : state === "working" ? name + " está trabajando" : (state === "idle" || state === "done") ? name + " listo"
      : "Estado: " + (state ?? "sin confirmar") + " · se verifica al enviar";
    return v_flex().flex_none().border_t(1).border_color(t.border).px(12).py(8).gap(6)
      .child(h_flex().items_center().gap(8)
        .child(div().flex_1().min_w(0)
          .child(Textarea.new(this.composer).w_full().h(64).px(9).py(6).rounded(7)
            .border_1().border_color(t.input || t.border).bg(t.raised).text_color(t.foreground).text_size(13)))
        .child((state === "working" || this.interrupting) && this.provider.capabilities.interrupt
          ? div().id("jec-stop").h(32).px(12).rounded(7).flex_none().flex().items_center()
            .border_1().border_color(t.border).bg(t.raised).text_color(t.foreground).text_size(12).font_medium()
            .when(!this.interrupting && !this.sending, el => el.cursor_pointer().hover(x => x.opacity(0.88))
              .on_click((_e, cx) => { cx.stop_propagation(); this.stop(cx); }))
            .child(this.interrupting ? "Deteniendo…" : "Detener")
          : div().id("jec-send").h(32).px(12).rounded(7).flex_none().flex().items_center()
          .font_medium().text_size(12).bg(enabled ? t.solid : t.raised)
          .text_color(enabled ? t.solid_foreground : t.dim)
          .border_1().border_color(enabled ? t.solid : t.border)
          .when(ready, el => el.cursor_pointer().hover(x => x.opacity(0.88))
            .on_click((_e, cx) => { cx.stop_propagation(); this.send(cx); }))
          .child(this.sending ? "Enviando…" : "Enviar")))
      .child(h_flex().items_center().gap(8)
        .when(state === "working" || this.sending || this.interrupting, el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working).spin(900)))
        .child(div().text_size(11).text_color(state === "blocked" ? t.blocked : t.muted).child(status))
        .child(div().flex_1())
        .child(div().text_size(11).text_color(t.dim).child("Enter: enviar · Shift+Enter: nueva línea")))
      .when(state === "blocked", el => el.child(v_flex().gap(6).p(8).rounded(7).border_1().border_color(t.border)
        .child(div().text_size(12).text_color(t.muted).child(name + " espera una decisión. Revisá el diálogo original antes de responder."))
        .child(h_flex().gap(8)
          .when(this.provider.capabilities.blockedPreview, row => row.child(button(t, "jec-inspect", this.dialogLoading ? "Leyendo…" : "Ver solicitud", cx => this.inspectDialog(cx), false, true)))
          .child(button(t, "jec-resolve", "Resolver en Terminal", () => this.back(), false, true)))
        .when(Boolean(this.dialog), box => box.child(div().max_h(160).overflow_y_scrollbar().text_size(11).text_color(t.foreground)
          .child(TextView.markdown("jec-blocked-dialog", "```text\n" + this.dialog.replace(/```/g, "ˋˋˋ") + "\n```").raw_html(false).selectable(true))))))
      .when(Boolean(this.sendError), el => el.child(div().text_size(11).text_color(t.blocked).child(this.sendError)))
      .when(Boolean(this.sendNotice) && !this.sendError, el => el.child(div().text_size(11).text_color(t.muted).child(this.sendNotice)));
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
    const name = providerName(this.target, this.provider);
    const label = mine ? "Vos" : tool ? "Herramienta" : m.phase === "commentary" ? name + " · progreso" : name;
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
      ? pane?.name || ((program?.agent || program?.shell) && program.name) || pane?.title || program?.name || providerName(target, this.provider)
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
      .when(!this.embedded && Boolean(this.selected) && Boolean(this.provider?.capabilities.discovery), el => el.child(button(t, "jec-choose", "Cambiar sesión", cx => this.resetChoice(cx))))
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
    if (this.headerRole) return this.paneHeader.render(cx);
    const t = theme(), valid = this.embedded ? embeddedTarget() : this.target;
    const target = this.embedded && (valid?.terminal !== this.target?.terminal
      || valid?.pane !== this.target?.pane || valid?.tab !== this.target?.tab
      || valid?.space !== this.target?.space || valid?.providerId !== this.target?.providerId
      || valid?.machine !== this.target?.machine) ? emptyTarget() : this.target;
    const canScan = Boolean(target.terminal && target.cwd);
    const canRead = canScan && Boolean(this.provider?.capabilities.history) && (!target.machine || this.provider.capabilities.remote);
    const name = providerName(target, this.provider);
    return v_flex().id("jec-chat-root").w_full().h_full().min_h(0)
      .bg(t.background).text_color(t.foreground).text_size(13)
      .when(this.embedded, el => el.rounded(10).overflow_hidden().border_1().border_color(t.border))
      .child(this.header(t, target))
      .when(Boolean(target.terminal && this.error), el => el.child(div().p(12).bg(t.raised).text_color(t.blocked)
        .text_size(12).child(this.error)))
      .when(Boolean(target.machine) && !canRead, el => el.child(div().p(18).text_color(t.muted)
        .child("Este proveedor todavía no admite sesiones remotas. La terminal permanece intacta.")))
      .when(!target.machine && !target.terminal, el => el.child(div().p(18).text_color(t.muted)
        .child("Seleccioná primero una terminal de un agente compatible en Herdr y abrí nuevamente JEC Chat.")))
      .when(canScan && !target.machine && !canRead, el =>
        el.child(v_flex().p(18).gap(10)
          .child(div().text_color(t.muted).child(target.providerId ? name + " todavía no tiene proveedor habilitado." : "Herdr no identificó un agente compatible."))
          .when(!target.providerId, box => box.child(button(t, "jec-manual", "Buscar historial de Codex (solo lectura)", cx => {
            this.manual = true; this.provider = providerFor(this.target, true); this.scan(cx); cx.notify();
          })))))
      .when(canRead && this.loading, el => el.child(div().p(16).text_color(t.muted).child("Buscando sesiones de " + name + "…")))
      .when(canRead && !this.loading && !this.selected && !this.pendingRegistration && this.sessions.length > 0, el => el.child(this.sessionPicker(t)))
      .when(canRead && !this.loading && Boolean(this.pendingRegistration), el => el.child(v_flex().p(16).gap(10)
        .child(div().text_color(t.muted).child(this.pendingRegistration === "pending" ? "Esperando la sesión activa de " + name : "Sesión registrada: " + this.pendingRegistration.slice(0, 12)))
        .child(div().text_color(t.dim).child(this.pendingReason ?? ("Esperando un historial legible de " + name + ". Se actualizará automáticamente.")))
        .child(h_flex().gap(8)
          .child(button(t, "jec-pending-retry", "Actualizar", cx => this.refresh(cx), false, this.embedded))
          .when(Boolean(this.provider?.capabilities.discovery), row => row.child(button(t, "jec-pending-pick", "Buscar manualmente", cx => this.resetChoice(cx), false, this.embedded))))))
      .when(canRead && !this.loading && !this.selected && !this.pendingRegistration && this.sessions.length === 0, el =>
        el.child(div().p(18).text_color(t.muted).child(
          "No se encontró una sesión activa de " + name + ". Iniciá el agente en la terminal o volvé a abrir Chat.")))
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
              .when(Boolean(this.provider?.capabilities.discovery), row => row.child(button(t, "jec-choose-inline", "Sesión", cx => this.resetChoice(cx), false, true)))
              .child(button(t, "jec-refresh-inline", "↻", cx => this.refresh(cx), false, true))))
          .child(v_flex().id("jec-chat-scroll").flex_1().min_h(0).overflow_y_scrollbar()
            .track_scroll(this.scroll).p(12).gap(10)
            .children(this.messages.map((m, i) => this.message(t, m, i)))
            .when(!this.messages.length, el => el.child(div().p(12).text_color(t.muted)
              .child(this.reading ? "Cargando mensajes…" : "Esta sesión no tiene mensajes legibles."))))
          .child(this.composerView(t, target))));
  }
}
