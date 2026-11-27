// Uses existing Herdr layout snapshots, not network reachability.
export function machineOverview(machines) {
 const list = machines ?? [];
 const total = list.length;
 const ready = list.filter(m => m.layout === "ready").length;
 const loading = list.filter(m => m.layout === "loading").length;
 const unavailable = list.filter(m => m.layout === "unavailable").length;
 const unknown = total - ready - loading - unavailable;
 return {total, ready, loading, unavailable, unknown,
   hint: `Machine layouts: ${ready}/${total} ready · ${loading} loading · ${unavailable} unavailable${unknown ? " · " + unknown + " unknown" : ""} · Open machine settings`};
}
