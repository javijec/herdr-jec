"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
test("both views use an identical agent summary implementation",async()=>{
 const source=read("shared/agent-summary.js");
 for(const id of ["jec-agents","jec-workspace-status"])assert.equal(read("mods/"+id+"/agent-summary.js"),source);
 const {agentSummary,kidStatus}=await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(source));
 const list=[{address:"a",status:"working"},{address:"pi/b",status:"idle"}];
 const terminals=[{address:"c",parent:"a",state:"live",status:"error"},{address:"pi/b",parent:"a",state:"live",status:"idle"}];
 const expected={total:3,working:1,blocked:1,done:0,idle:1,unknown:0};
 assert.deepEqual(agentSummary(list,terminals),expected);
 assert.deepEqual(agentSummary(list,terminals,kidStatus),expected);
});
test("profile names match layout and installed mod directories",()=>{
 const p=JSON.parse(read("profile.json")),l=JSON.parse(read("layouts/jec.json"));
 function find(n,id){return n.id===id?n:(n.children??[]).map(c=>find(c,id)).find(Boolean)}
 assert.equal(p.version,"0.5.0");
 for(const e of p.mods){
  assert.ok(fs.existsSync(path.join(root,"mods",e.id,"mod.json")));
  for(const b of e.blocks)assert.equal(find(l,b).content.mod,e.id);
 }
 assert.equal(find(l,"sidebar-footer").size.px,69+p.mods.find(e=>e.name==="workspace-chrome").footerExtra);
});
test("status uses the shared deduplicated calculation",()=>{
 assert.match(read("mods/jec-workspace-status/main.js"),/agentSummary\(agents\(\), terminals\(\)\)/);
 assert.match(read("mods/jec-agents/main.js"),/agentSummary\(list, all, kidStatus\)/);
});
