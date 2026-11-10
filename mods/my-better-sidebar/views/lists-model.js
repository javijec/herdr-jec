export const isTabbedView = (settings) => settings?.lists_view !== "stacked";

export const LISTS_LAYOUTS = [
  { id: "stacked", label: "Stacked lists", icon: "layers" },
  { id: "tabs", label: "Tabbed view", icon: "panel-right" },
];

export const listsViewOf = (choice, settings) => {
  if (choice === "stacked" || choice === "tabs") return choice;
  return isTabbedView(settings) ? "tabs" : "stacked";
};
