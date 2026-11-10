import { h_flex, v_flex } from "gpui-base";
import { shared, setShared, theme } from "herdr";
import { Agents } from "./agents.js";
import { Spaces } from "./spaces.js";
import { IconButton, Menu, MenuLabel, MenuOption, TEXT } from "./ui.js";
import { listsViewOf } from "./lists-model.js";

const TABS = ["spaces", "agents"];
const LAYOUTS = [
  { id: "stacked", label: "Stacked lists", icon: "layers" },
  { id: "tabs", label: "Tabbed view", icon: "panel-right" },
];

export class Lists {
  init(props, cx) {
    this.spaces = new Spaces();
    this.spaces.init(props, cx);
    this.agents = new Agents();
    this.agents.init(props, cx);
    this.layoutOpen = false;
    this.layoutFocus = cx.focus_handle();
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
    const view = listsViewOf(shared("better-sidebar.lists-view"), this.spaces.settings);
    const root = v_flex()
      .id("better-sidebar-lists")
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .text_size(TEXT.body);
    if (view !== "tabs" || this.spaces.collapsed())
      return root
        .child(this.stackedToolbar(view))
        .child(v_flex().flex_1().min_h(0).child(this.spaces.render()))
        .child(v_flex().flex_1().min_h(0).child(this.agents.render()));

    return root
      .child(this.tabBar(t, view))
      .child(v_flex().flex_1().min_h(0).child(this.tab === "spaces" ? this.spaces.render() : this.agents.render()));
  }

  stackedToolbar(view) {
    return h_flex()
      .id("lists-layout-toolbar")
      .px(8)
      .py(4)
      .flex_none()
      .items_center()
      .child(h_flex().flex_1())
      .child(this.layoutMenu(view));
  }

  layoutMenu(view) {
    return Menu({
      id: "lists-layout-menu",
      open: this.layoutOpen,
      focus: this.layoutFocus,
      onOpenChange: (open, cx) => {
        this.layoutOpen = open;
        cx.notify();
      },
      trigger: IconButton({
        id: "lists-layout",
        icon: view === "tabs" ? "panel-right" : "layers",
        label: `Sidebar layout: ${view === "tabs" ? "Tabbed view" : "Stacked lists"}`,
        iconSize: 14,
        muted: true,
      }),
      children: [
        MenuLabel("Sidebar layout"),
        ...LAYOUTS.map((layout) =>
          MenuOption({
            id: `lists-layout-${layout.id}`,
            icon: layout.icon,
            label: layout.label,
            selected: layout.id === view,
            onClick: (cx) => {
              setShared("better-sidebar.lists-view", layout.id);
              this.layoutOpen = false;
              cx.notify();
            },
          }),
        ),
      ],
    });
  }

  tabBar(t, view) {
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
      .children([
        tab("spaces", "Spaces"),
        tab("agents", "Agents"),
        h_flex().flex_1(),
        this.layoutMenu(view),
      ]);
  }
}
