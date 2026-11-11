import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme } from "herdr";

export default class WorkspaceStatus extends View {
  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    const label = (icon, text) => h_flex().min_w(0).gap(6).items_center()
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(13).text_color(t.muted))
      .child(div().flex_1().min_w(0).truncate().child(text));
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(h_flex().min_w(0).gap(6).items_center().child(div().size(6).flex_none().rounded(3).bg(t.dim))
        .child(div().flex_1().min_w(0).truncate().child(`${list.length} agents`))
        .when(needs > 0, el => el.child(div().flex_1().min_w(0).truncate().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1().min_w(0));
  }
}
