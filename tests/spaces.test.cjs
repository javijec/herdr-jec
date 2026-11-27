"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
test("machine summary isolates machines including empty groups and counts all spaces",async()=>{
 const {machineSummary}=await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(read("mods/jec-spaces/machine-summary.js")));
 const data=[{id:"a",machine:null,tabs:[{}]},{id:"b",machine:"pi",active:true,tabs:[{},{}]},{id:"c",machine:"pi"},{id:"d",tabs:[{}]}];
 assert.deepEqual(machineSummary(data,"pi"),{count:2,tabs:2,active:true,label:"2 spaces · 2 tabs · active machine"});
 assert.equal(machineSummary(data,null).count,2);assert.equal(machineSummary(data,null).active,false);
 assert.equal(machineSummary(data,"offline").count,0);
});
test("layout uses official components except spaces and agents",()=>{
 const l=JSON.parse(read("layouts/jec.json"));
 function find(n,id){return n.id===id?n:(n.children??[]).map(x=>find(x,id)).find(Boolean);}
 assert.equal(find(l,"spaces").content.mod,"jec-spaces");
 assert.equal(find(l,"agents").content.mod,"jec-agents");
 for(const id of ["tabs","files","changes"])assert.equal(find(l,id).content.mod,id);
 assert.equal(find(l,"main").content.pane.header.content.mod,"pane");
});
test("generated files exactly match pinned official sources plus explicit changes",{skip:!fs.existsSync(path.join(root,"upstream/herdr-app/defaults/mods/spaces/main.js"))},()=>{
 const {derive,deriveLayout}=require("../scripts/derive-spaces.cjs");
 assert.equal(read("mods/jec-spaces/main.js"),derive(read("upstream/herdr-app/defaults/mods/spaces/main.js")));
 assert.equal(read("layouts/jec.json"),deriveLayout(read("upstream/herdr-app/defaults/layouts/main.json")));
});
