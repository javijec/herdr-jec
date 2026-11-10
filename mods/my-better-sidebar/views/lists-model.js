export const isTabbedView = (settings) => settings?.lists_view === "tabs";

export const listsViewOf = (choice, settings) => {
  if (choice === "stacked" || choice === "tabs") return choice;
  return isTabbedView(settings) ? "tabs" : "stacked";
};
