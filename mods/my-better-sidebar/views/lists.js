import { h_flex, v_flex } from "gpui-base";
import { theme } from "herdr";
import { Agents } from "./agents.js";
import { Spaces } from "./spaces.js";
import { TEXT } from "./ui.js";
import { isTabbedView } from "./lists-model.js";

const TABS = ["spaces", "agents"];

export class Lists {
  init(props, cx) {
    this.spaces = new Spaces();
    this.spaces.init(props, cx);
    this.agents = new Agents();
    this.agents.init(props, cx);
    const saved = localStorage.getItem("lists.tab");
    this.tab = TABS.includes(saved) ? saved : "spaces";
  }

  pick(tab, cx) {
    this.tab = tab;
    localStorage.setItem("lists.tab", tab);
    cx.notify();
  }

  render() {
    const t = theme();
    const root = v_flex()
      .id("better-sidebar-lists")
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .text_size(TEXT.body);
    if (!isTabbedView(this.spaces.settings) || this.spaces.collapsed())
      return root
        .child(v_flex().flex_1().min_h(0).child(this.spaces.render()))
        .child(v_flex().flex_1().min_h(0).child(this.agents.render()));

    return root
      .child(this.tabBar(t))
      .child(v_flex().flex_1().min_h(0).child(this.tab === "spaces" ? this.spaces.render() : this.agents.render()));
  }

  tabBar(t) {
    const tab = (id, label) =>
      h_flex()
        .id(`lists-tab-${id}`)
        .px(10)
        .h(24)
        .justify_center()
        .items_center()
        .rounded(6)
        .cursor_pointer()
        .text_size(TEXT.label)
        .font_medium()
        .text_color(this.tab === id ? t.foreground : t.dim)
        .when(this.tab === id, (el) => el.bg(t.selected))
        .when(this.tab !== id, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
        .on_click((_e, cx) => this.pick(id, cx))
        .child(label);
    return h_flex()
      .id("lists-tabs")
      .px(8)
      .py(6)
      .mb(4)
      .border_b(1)
      .border_color(t.border)
      .flex_none()
      .gap(6)
      .items_center()
      .children([tab("spaces", "Spaces"), tab("agents", "Agents")]);
  }
}
