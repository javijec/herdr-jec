// JEC-specific action. The rest of the header is generated from upstream.
import { div } from "gpui-kit";
import { panes, spaces, run } from "herdr";
import { detectAgent, supportsChat } from "./provider-catalog.js";
import { NATIVE_MOD, toggleArgs } from "./native-pane.js";

function chatAvailable(p) {
  const space=spaces().find(s=>s.tabs?.some(tab=>tab.id===p?.tab));
  return Boolean(space && supportsChat({
    terminal:p?.terminal,cwd:p?.cwd,machine:space.machine,
    providerId:detectAgent(p?.program,p?.app)
  }));
}
export function showChatToggle(p) {
  return Boolean(toggleArgs(p)) && (p.body_mod===NATIVE_MOD || chatAvailable(p));
}
export function chatToggle(t,p) {
  return div().id("jec-chat-toggle-"+p.pane).h(23).px(9)
    .rounded(5).border_1().border_color(t.border).bg(t.raised)
    .text_size(11).font_semibold().text_color(t.foreground)
    .flex().items_center().cursor_pointer()
    .hover(el=>el.bg(t.hover))
    .on_click((_e,cx)=>{
      cx.stop_propagation();
      const live=panes().find(q=>q.pane===p.pane && q.terminal===p.terminal);
      if (!live || !showChatToggle(live)) return;
      const args=toggleArgs(live);
      if (args) run("pane.view",args);
    }).child(p.body_mod===NATIVE_MOD?"Terminal":"Chat");
}
