"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const load=()=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(fs.readFileSync(path.join(__dirname,"../mods/jec-agents/providers.js"),"utf8")));
test("reported provider takes precedence over process identity",async()=>{
 const {providerOf}=await load();
 assert.equal(providerOf({app:"gentle-shell",program:{key:"pi"}}),"Gentle Shell");
 assert.equal(providerOf({program:{key:"pi"}},{report:{app:"gentle-shell"}}),"Gentle Shell");
 assert.equal(providerOf({program:{key:"pi"}}),"Pi");
 assert.equal(providerOf({app:"opencode"}),"OpenCode");
 assert.equal(providerOf({app:"codex"}),"Codex");
 assert.equal(providerOf({app:"custom",program:{key:"pi"}}),"custom");
});
test("progress and reasons are displayed only when explicitly reported",async()=>{
 const {nativeDetails}=await load();
 assert.equal(nativeDetails({report:{state:"working",progress:0}}).progress,0);
 assert.equal(nativeDetails({report:{state:"working",progress:101}}).progress,null);
 assert.equal(nativeDetails({report:{state:"idle",progress:100}}).progress,null);
 assert.equal(nativeDetails({}).progress,null);
 const d=nativeDetails({report:{state:"blocked",kind:"permission",msg:"Approve"},records:{a:{state:"working",title:"Tests"},b:{state:"done"},c:{state:"error",title:"Build"}}});
 assert.equal(d.active,2);assert.equal(d.kind,"permission");assert.match(d.hint,/Approve/);assert.match(d.hint,/Build: error/);
});
test("unreported panes are separate and deduplicated",async()=>{
 const {unreportedPanes}=await load();
 const p=[{pane:"p1",terminal:"t1",program:{key:"codex"},status:null},{pane:"p2",terminal:"t1",program:{key:"codex"},status:null},{pane:"p3",terminal:"t2",program:{key:"pi"},status:null},{pane:"p4",terminal:"t3",program:{key:"shell"},status:null}];
 const r=unreportedPanes(p,new Map([["t2","working"]]),new Map());
 assert.deepEqual(r.map(x=>x.address),["t1"]);
});
