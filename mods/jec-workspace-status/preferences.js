// Per-block options passed by the official layout props API.
const bool = (v,d=true) => typeof v==="boolean"?v:d;
export function statusOptions(p) {
 const v=p?.jec??{};
 const seconds=Number.isInteger(v.refreshSeconds)&&v.refreshSeconds>=15&&v.refreshSeconds<=300?v.refreshSeconds:15;
 return {metrics:bool(v.metrics),refreshMs:seconds*1000,staleMs:Math.max(45000,seconds*3000),
  cpu:bool(v.cpu),ram:bool(v.ram),disk:bool(v.disk),temperature:bool(v.temperature),
  space:bool(v.space),branch:bool(v.branch),agentSummary:bool(v.agentSummary)};
}
export function agentsOptions(p) {
 const v=p?.jec??{};
 return {durations:bool(v.durations),progress:bool(v.progress),unreported:bool(v.unreported)};
}
export function chromeOptions(p) {
 return {machines:bool(p?.jec?.machines)};
}
