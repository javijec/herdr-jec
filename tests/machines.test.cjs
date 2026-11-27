"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {remove}=require("../scripts/disable-chat-hooks.cjs");
test("disable only exact JEC hooks, preserve other handlers",()=>{
 const script="C:\\Users\\test\\.config\\herdr-app\\mods\\jec-chat\\providers\\session-hook.cjs";
 const own={type:"command",command:"node \""+script+"\""};
 const other={type:"command",command:"node other.js"};
 const c={hooks:{SessionStart:[{hooks:[own,other]},{hooks:[own]}],Stop:[{hooks:[other]}]}};
 assert.equal(remove(c,script),true);
 assert.deepEqual(c.hooks.SessionStart,[{hooks:[other]}]);
 assert.deepEqual(c.hooks.Stop,[{hooks:[other]}]);
 assert.equal(remove(c,script),false);
});
test("machine summaries isolate local and remote spaces and count statuses",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../mods/jec-machines/model.js"),"utf8");
 const {machineRows}=await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(source));
 const rows=machineRows([{name:null,layout:"ready"},{name:"pi",layout:"unavailable"},{name:"temp",temporary:true}],
 [{id:"s1",machine:null,tabs:[{}]},{id:"s2",machine:"pi",tabs:[{},{}]},{id:"s3",machine:"temp"}],
 [{space:"s1",status:"working"},{space:"s2",status:"blocked"},{space:"s2",status:"other"}]);
 assert.equal(rows.length,2);assert.equal(rows[0].name,null);assert.equal(rows[0].counts.working,1);
 assert.equal(rows[1].counts.blocked,1);assert.equal(rows[1].counts.unknown,1);
 assert.equal(rows[1].spaces[0].tabs,2);
});
