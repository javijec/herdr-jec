"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const load=()=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(read("mods/jec-workspace-chrome/machine-overview.js")));
test("machine overview uses layout states only, handles unknown and empty data",async()=>{
 const {machineOverview}=await load();
 const s=machineOverview([{name:null,layout:"ready"},{name:"pi",layout:"loading"},{name:"vps",layout:"unavailable"},{name:"other"}]);
 assert.deepEqual([s.total,s.ready,s.loading,s.unavailable,s.unknown],[4,1,1,1,1]);
 assert.match(s.hint,/1\/4 ready/);assert.equal(machineOverview([]).total,0);
});
test("native chrome actions preserved, machine settings uses stock command",()=>{
 const s=read("mods/jec-workspace-chrome/main.js");
 for(const word of ['run("app.settings")','run("mod.open", { name: "machine-add" })','run("mod.open", { name: "picker" })','run("layout.resize"','updates().app.ready','run("app.settings", { section: "machines" })']) assert.ok(s.includes(word),word);
 assert.doesNotMatch(s,/cx\.timer|\bexec\(|\bhc\(/);
});
test("official chrome baseline plus exact delta",{skip:!fs.existsSync(path.join(root,"upstream/herdr-app/defaults/mods/workspace-chrome/main.js"))},()=>{
 const {derive}=require("../scripts/derive-workspace-chrome.cjs");
 assert.equal(read("mods/jec-workspace-chrome/main.js"),derive(read("upstream/herdr-app/defaults/mods/workspace-chrome/main.js")));
});
