// Native report consumer only. No provider hooks, subprocesses or file access.
const aliases = new Map([
 ["gentle-shell","Gentle Shell"],["gentle-pi","Gentle Shell"],
 ["pi","Pi"],["opencode","OpenCode"],["codex","Codex"],
 ["claude","Claude Code"],["claude-code","Claude Code"]
]);
const known = new Set(aliases.values());
function clean(value,max=120) {
 return typeof value==="string" ? value.replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,max) : "";
}
function identify(value) {
 const key=clean(value).toLowerCase().replace(/\.exe$/,"");
 return aliases.get(key)??null;
}
export function providerOf(agent, terminal) {
 // An explicit app report wins over process detection, including Pi wrappers.
 const app=clean(agent?.app)||clean(terminal?.report?.app)||clean(terminal?.app);
 if(app) return identify(app)??app;
 const key=agent?.program?.key??terminal?.program?.key;
 const name=agent?.program?.name??terminal?.program?.name;
 return identify(key)??identify(name)??(clean(name)||"Unknown");
}
export function nativeDetails(terminal) {
 const report=terminal?.report;
 const r=report && typeof report==="object" && !Array.isArray(report)?report:{};
 const progress=Number.isInteger(r.progress)&&r.progress>=0&&r.progress<=100&&(r.state==="working"||r.state==="blocked")?r.progress:null;
 const kind=["permission","question","auth"].includes(r.kind)?r.kind:"";
 const title=clean(r.title);
 const msg=clean(r.msg,160);
 // Additional records are optional in the host snapshot. They are not terminals
 // and must never be counted as additional agents.
 const records=terminal?.records;
 const entries=records && typeof records==="object" && !Array.isArray(records)?Object.entries(records):[];
 const active=entries.filter(([,v])=>v && ["working","blocked","error"].includes(v.state));
 const detail=active.slice(0,3).map(([id,v])=>{
  const label=clean(v.title)||clean(id);
  return label+": "+v.state+(Number.isInteger(v.progress)&&v.progress>=0&&v.progress<=100?" "+v.progress+"%":"");
 });
 return {progress,kind,title,msg,active:active.length,
   hint:[title,msg,kind?"Reason: "+kind:"",progress!==null?"Reported progress: "+progress+"%":"",active.length?"Activity records: "+active.length+" · "+detail.join(" · "):""].filter(Boolean).join(" · ")};
}
export function unreportedPanes(panes,states,terminalByAddress) {
 const found=new Map();
 for(const p of panes) {
  if(!p.terminal||states.has(p.terminal)||p.status!=null)continue;
  const terminal=terminalByAddress.get(p.terminal);
  const provider=providerOf(p,terminal);
  if(!known.has(provider))continue;
  // A recognized foreground program is not proof of a live agent session.
  if(!found.has(p.terminal))found.set(p.terminal,{pane:p.pane,address:p.terminal,provider,title:clean(p.title)});
 }
 return [...found.values()];
}
