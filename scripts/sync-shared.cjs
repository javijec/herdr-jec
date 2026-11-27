"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"shared/agent-summary.js"),"utf8");
for(const id of ["jec-agents","jec-workspace-status"])fs.writeFileSync(path.join(root,"mods",id,"agent-summary.js"),source);
