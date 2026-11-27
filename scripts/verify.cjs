"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const profile=JSON.parse(read("profile.json"));
for(const entry of profile.mods){
 const dir=path.join(root,"mods",entry.id);
 JSON.parse(read("mods/"+entry.id+"/mod.json"));
 for(const name of fs.readdirSync(dir).filter(n=>n.endsWith(".js"))){
   const r=cp.spawnSync(process.execPath,["--input-type=module","--check"],{input:read("mods/"+entry.id+"/"+name),encoding:"utf8"});
   if(r.status!==0)throw Error(entry.id+"/"+name+": "+r.stderr);
 }
}
const canonical=read("shared/agent-summary.js");
for(const name of ["jec-agents","jec-workspace-status"])assert.equal(read("mods/"+name+"/agent-summary.js"),canonical);
const upstream=path.join(root,"upstream/herdr-app/defaults");
if(fs.existsSync(upstream)){
 for(const entry of profile.mods){
   const r=cp.spawnSync(process.execPath,[path.join(root,"scripts/derive-"+entry.name+".cjs"),"--check"],{stdio:"inherit"});
   if(r.status!==0)process.exit(1);
 }
}else{
 console.log("Official reference not materialized; baseline comparison skipped. Use git submodule update --init upstream/herdr-app.");
 if(process.argv.includes("--require-upstream"))process.exit(1);
}
const result=cp.spawnSync(process.execPath,["--test"],{cwd:root,stdio:"inherit"});
process.exit(result.status??1);
