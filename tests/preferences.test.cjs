"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=p=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(read(p)));
test("default configuration keeps all previous features enabled",async()=>{
 const c=JSON.parse(read("config/jec-settings.default.json"));
 const {statusOptions,agentsOptions,chromeOptions}=await load("shared/preferences.js");
 assert.equal(c.mods.length,4);
 assert.deepEqual(statusOptions({jec:c.status}),{metrics:true,refreshMs:15000,staleMs:45000,cpu:true,ram:true,disk:true,temperature:true,space:true,branch:true,agentSummary:true});
 assert.deepEqual(agentsOptions({jec:c.agents}),{durations:true,progress:true,unreported:true});
 assert.equal(chromeOptions({jec:c.chrome}).machines,true);
});
test("custom settings handle invalid types and interval bounds defensively",async()=>{
 const {statusOptions,agentsOptions}=await load("shared/preferences.js");
 assert.equal(statusOptions({jec:{refreshSeconds:5}}).refreshMs,15000);
 assert.equal(statusOptions({jec:{refreshSeconds:300}}).staleMs,900000);
 assert.equal(statusOptions({jec:{metrics:false,ram:"false"}}).metrics,false);
 assert.equal(statusOptions({jec:{ram:"false"}}).ram,true);
 assert.equal(agentsOptions({jec:{progress:false}}).progress,false);
});
test("metric display honors selected fields and slower sampling",async()=>{
 const {parseMetrics,describeMetrics}=await load("mods/jec-workspace-status/machine-metrics.js");
 const data=parseMetrics("JEC_METRICS_V1\ncpu=30\nmem=100 200\ndisk=100 200\ntemp=50\n");
 const result=describeMetrics({data,at:1000,platform:"linux"},61000,"pi",{cpu:true,ram:false,disk:false,temperature:false,staleMs:180000});
 assert.equal(result.text,"CPU 30%");assert.doesNotMatch(result.hint,/RAM|Root|temperature/);assert.equal(result.available,true);
});
