"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const load=()=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(fs.readFileSync(path.join(__dirname,"../mods/jec-agents/activity.js"),"utf8")));
const kid=(t,listed)=>listed.get(t.address)??(t.status==="error"?"blocked":t.status==="done"?"idle":t.status);
test("deduplicated group counts, nested and pinned children, ignored exited terminals",async()=>{
 const {activitySnapshot,groupActivity,descendants}=await load();
 const list=[{address:"a",status:"working"},{address:"b",status:"idle",pinned:true}];
 const terminals=[{address:"b",parent:"a",state:"live",status:"idle"},{address:"c",parent:"b",state:"live",status:"error"},{address:"d",parent:"a",state:"exited",status:"working"}];
 const s=activitySnapshot(list,terminals,kid);
 assert.deepEqual(groupActivity(list,s),{total:3,working:1,blocked:1});
 assert.deepEqual(descendants(s.children,"a").map(r=>r.t.address),["b","c"]);
});
test("observed durations reset on transitions and disappearance, no invented start time",async()=>{
 const {trackActivity,observedDuration}=await load();
 let s=trackActivity(new Map(),new Map([["a","working"]]),1000);
 s=trackActivity(s,new Map([["a","working"]]),62000);
 assert.equal(observedDuration(s.get("a"),62000),"1m");
 s=trackActivity(s,new Map([["a","blocked"]]),63000);
 assert.equal(observedDuration(s.get("a"),64000),"1s");
 s=trackActivity(s,new Map(),65000);assert.equal(s.size,0);
 s=trackActivity(s,new Map([["a","working"]]),70000);
 assert.equal(observedDuration(s.get("a"),70000),"0s");
});
test("cycle-safe traversal and machine-qualified addresses",async()=>{
 const {activitySnapshot,descendants,machineName}=await load();
 const list=[{address:"pi/a",status:"working"}];
 const s=activitySnapshot(list,[{address:"pi/a",parent:"pi/b",state:"live"},{address:"pi/b",parent:"pi/a",state:"live",status:"error"}],kid);
 assert.deepEqual(descendants(s.children,"pi/a").map(x=>x.t.address),["pi/b"]);
 assert.equal(machineName({address:"pi/a",space:"s"},new Map([["s",{machine:"pi"}]])),"pi");
 assert.equal(machineName({address:"a",space:"l"},new Map([["l",{machine:null}]])),null);
});
