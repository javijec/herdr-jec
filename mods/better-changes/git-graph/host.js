export function graphViewForTab(tab) {
  return tab === "commit" ? "git-graph" : "changes";
}

export function graphPollInterval(embedded, refreshIntervalMs) {
  if (Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0)
    return Math.max(1000, refreshIntervalMs);
  return embedded ? 10000 : 15000;
}

// Embedded Graphs reuse a handle created by the owning View's init context.
export function graphFocusHandle(cx, focusHandle) {
  return focusHandle ?? cx.focus_handle();
}

export function graphOverlay(role, props, options = {}) {
  const overlayRole = role === "menu" ? "git-graph-menu" : "git-graph-dialog";
  return {
    mod: "better-changes",
    kind: role === "menu" ? "popup" : "dialog",
    ...options,
    props: { ...props, role: overlayRole },
  };
}

export function graphOverlayMode(role) {
  if (role === "git-graph-menu") return "menu";
  if (role === "git-graph-dialog") return "dialog";
  return null;
}

export function graphLocation(provider) {
  const value = typeof provider === "function" ? provider() : null;
  return { cwd: value?.cwd ?? null, on: value?.on ?? null };
}
