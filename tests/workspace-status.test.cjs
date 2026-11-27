"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const load=()=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(read("mods/jec-workspace-status/workspace-context.js")));
test("active remote and local context use layout readiness, not assumed connectivity",async()=>{
 const {workspaceContext}=await load();
 const machines=[{name:null,layout:"ready"},{name:"pi",layout:"loading"},{name:"vps",layout:"unavailable"}];
 const ctx=workspaceContext({machine:"pi",name:"Dev",folder:"/srv/dev",tabs:[{},{}]},machines);
 assert.equal(ctx.state,"loading");assert.equal(ctx.ready,1);assert.equal(ctx.total,3);
 assert.equal(ctx.tabs,2);assert.equal(ctx.spaceName,"Dev");assert.match(ctx.spaceHint,/\/srv\/dev/);
 assert.equal(workspaceContext({machine:null},machines).state,"ready");
 assert.equal(workspaceContext({machine:"vps"},machines).state,"unavailable");
 assert.equal(workspaceContext({machine:"missing"},machines).state,"unknown");
});
test("empty snapshots are safe and do not claim readiness",async()=>{
 const {workspaceContext}=await load();
 const ctx=workspaceContext(undefined,[]);
 assert.equal(ctx.state,"unknown");assert.equal(ctx.tabs,0);assert.equal(ctx.spaceHint,"No active space");
});
test("official status bar baseline and exact delta",{skip:!fs.existsSync(path.join(root,"upstream/herdr-app/defaults/mods/workspace-status/main.js"))},()=>{
 const {derive}=require("../scripts/derive-workspace-status.cjs");
 assert.equal(read("mods/jec-workspace-status/main.js"),derive(read("upstream/herdr-app/defaults/mods/workspace-status/main.js")));
});
test("status bar preserves native command palette and uses official machine settings",()=>{
 const s=read("mods/jec-workspace-status/main.js");
 assert.match(s,/run\("app.palette"\)/);assert.match(s,/run\("app.settings", \{ section: "machines" \}\)/);
 assert.match(s,/if \(checking\(\)\) return;/);
 assert.match(s,/cx\.timer\.every\(5000/);
 assert.doesNotMatch(s,/\bhc\(/);
});
