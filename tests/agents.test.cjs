"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const load=()=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(read("mods/jec-agents/agent-summary.js")));
const kid=(t,listed)=>listed.get(t.address)??(t.status==="error"?"blocked":t.status==="done"?"idle":t.status);
test("counts listed and live descendant agents once, including pinned children",async()=>{
 const {agentSummary}=await load();
 const list=[{address:"t1",status:"working"},{address:"pi/t1",status:"done"},{address:"t2",status:"blocked",pinned:true}];
 const all=[{address:"t2",parent:"t1",state:"live",status:"idle"},{address:"t3",parent:"t2",state:"live",status:"error"},{address:"t4",parent:"t1",state:"live",status:"done"},{address:"t5",parent:"t1",state:"exited",status:"working"},{address:"t6",parent:"unrelated",state:"live",status:"working"}];
 assert.deepEqual(agentSummary(list,all,kid),{total:5,working:1,blocked:2,done:1,idle:1,unknown:0});
});
test("summary handles empty snapshots and cyclic parent data safely",async()=>{
 const {agentSummary}=await load();
 assert.equal(agentSummary([],[],kid).total,0);
 assert.deepEqual(agentSummary([{address:"a",status:"working"}],[{address:"b",parent:"a",state:"live",status:"mystery"},{address:"a",parent:"b",state:"live",status:"idle"}],kid),{total:2,working:1,blocked:0,done:0,idle:0,unknown:1});
});
test("official Agents baseline plus exact delta",{skip:!fs.existsSync(path.join(root,"upstream/herdr-app/defaults/mods/agents/main.js"))},()=>{
 const {derive}=require("../scripts/derive-agents.cjs");
 assert.equal(read("mods/jec-agents/main.js"),derive(read("upstream/herdr-app/defaults/mods/agents/main.js")));
});
test("sort menu stays in same mod and native controls are retained",()=>{
 const s=read("mods/jec-agents/main.js");
 assert.match(s,/mod: "jec-agents", kind: "popup"/);
 assert.match(s,/setAgentOrder\(/);assert.match(s,/terminal\.pin/);assert.match(s,/terminal\.peek/);
 assert.doesNotMatch(s,/cx\.timer\.every\((?!30000)/);
});
