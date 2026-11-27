// Pure projection of Herdr's live machine/space/agent snapshots.
export function machineRows(machines,spaces,agents){
 const rows=new Map();
 const key=x=>x??null;
 for(const m of machines??[]){
   if(m.temporary)continue;
   rows.set(key(m.name),{name:key(m.name),layout:m.layout??"unknown",spaces:[],counts:{working:0,blocked:0,done:0,idle:0,unknown:0}});
 }
 for(const s of spaces??[]){
   const k=key(s.machine);if(!rows.has(k))continue;
   const related=(agents??[]).filter(a=>a.space===s.id);
   const counts={working:0,blocked:0,done:0,idle:0,unknown:0};
   for(const a of related)counts[Object.hasOwn(counts,a.status)?a.status:"unknown"]++;
   const row=rows.get(k);
   for(const state of Object.keys(counts))row.counts[state]+=counts[state];
   row.spaces.push({id:s.id,name:s.name||s.folder||s.id,active:Boolean(s.active),tabs:s.tabs?.length??0,counts});
 }
 return [...rows.values()].sort((a,b)=>a.name===null?-1:b.name===null?1:a.name.localeCompare(b.name));
}
