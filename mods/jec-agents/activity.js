// JEC v0.7. Observed status durations, not provider task start times.
export function activitySnapshot(list, terminals, statusOf) {
  const listed = new Map(list.map(a => [a.address,a.status]));
  const terminalByAddress = new Map(terminals.filter(t=>t.state==="live" && t.address).map(t=>[t.address,t]));
  const children = new Map();
  for (const t of terminalByAddress.values()) {
    if (!t.parent || t.parent===t.address) continue;
    if (!children.has(t.parent)) children.set(t.parent,[]);
    children.get(t.parent).push(t);
  }
  const states = new Map(listed);
  const queue = [...listed.keys()], seen = new Set();
  for (let i=0;i<queue.length;i++) {
    const address=queue[i];
    if (seen.has(address)) continue;
    seen.add(address);
    for (const t of children.get(address)??[]) {
      if (!states.has(t.address)) states.set(t.address,statusOf(t,listed));
      if (!seen.has(t.address)) queue.push(t.address);
    }
  }
  return {states,children,terminalByAddress};
}
export function trackActivity(previous, states, now) {
  const next = new Map();
  for (const [address,status] of states) {
    if (status!=="working" && status!=="blocked") continue;
    const old=previous.get(address);
    next.set(address,old?.status===status && old.at<=now ? old : {status,at:now});
  }
  return next;
}
export function observedDuration(entry, now) {
  if (!entry) return "";
  const seconds=Math.max(0,Math.floor((now-entry.at)/1000));
  if(seconds<60)return seconds+"s";
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return minutes+"m";
  const hours=Math.floor(minutes/60);
  return hours<24?hours+"h "+(minutes%60)+"m":Math.floor(hours/24)+"d "+(hours%24)+"h";
}
export function activityHint(entry,now) {
  return entry ? (entry.status==="blocked"?"Blocked":"Working")+" · observed for "+observedDuration(entry,now) : "";
}
export function descendants(children,address,lead=[],seen=new Set([address])) {
  const kids=(children.get(address)??[]).filter(k=>!seen.has(k.address));
  const rows=[];
  for(let i=0;i<kids.length;i++){
    const k=kids[i];if(seen.has(k.address))continue;
    seen.add(k.address);
    const last=i===kids.length-1;
    rows.push({t:k,lines:[...lead,last?"└":"├"]});
    rows.push(...descendants(children,k.address,[...lead,last?"":"│"],seen));
  }
  return rows;
}
export function groupActivity(members,snapshot) {
  const unique=new Set();
  for (const a of members) {
    unique.add(a.address);
    for (const s of descendants(snapshot.children,a.address)) unique.add(s.t.address);
  }
  let working=0,blocked=0;
  for(const id of unique) {
    if(snapshot.states.get(id)==="working")working++;
    if(snapshot.states.get(id)==="blocked")blocked++;
  }
  return {total:unique.size,working,blocked};
}
export function machineName(agent,spaceById) {
  const space=spaceById.get(agent.space);
  if(space)return space.machine??null;
  return agent.address.includes("/")?agent.address.split("/")[0]:null;
}
