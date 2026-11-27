"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const url=s=>"data:text/javascript;charset=utf-8,"+encodeURIComponent(s);
const extension=()=>import(url(fs.readFileSync(path.join(root,"integrations/pi/jec-chat.ts"),"utf8")));
const id="01234567-89ab-4cde-8fab-0123456789ab", generation="11234567-89ab-4cde-8fab-0123456789ab";
const target={providerId:"pi",terminal:"t1y",cwd:"/work",machine:null};
const fixture=()=>({version:1,provider:"pi",terminal:target.terminal,id,generation,at:Date.now(),cwd:target.cwd,status:"idle",data:{messages:[{role:"user",text:"hola"}],total:1,truncated:false}});
async function provider(){
  return import(url(fs.readFileSync(path.join(root,"mods/jec-chat/providers/pi.js"),"utf8")
    .replace('import { appHome, readTextFile, hc } from "herdr";','let mocks; export const setMocks=m=>{mocks=m}; const appHome=()=>"/app"; const readTextFile=(...a)=>mocks.readTextFile(...a); const hc=(...a)=>mocks.hc(...a);')));
}
test("Pi uses the current branch only, excludes reasoning and tool data",async()=>{
  const p=await extension();
  const message=m=>({type:"message",message:m});
  const branch=[message({role:"user",content:[{type:"text",text:"hola"},{type:"image",data:"secret"}]}),message({role:"assistant",content:[{type:"thinking",thinking:"secret"},{type:"text",text:"respuesta"},{type:"toolCall",name:"bash",arguments:{secret:1}}]}),message({role:"toolResult",toolName:"bash",content:[{type:"text",text:"secret"}]}),{type:"custom_message",content:"secret"}];
  let idle=true, queued=false;
  const ctx={hasUI:true,sessionManager:{getSessionId:()=>id,getCwd:()=>"/work",getBranch:()=>branch},isIdle:()=>idle,hasPendingMessages:()=>queued};
  const data=p.capture(ctx);
  assert.equal(data.id,id); assert.equal(data.status,"idle");
  assert.deepEqual(data.data.messages.map(m=>m.text),["hola","respuesta","bash · requested","bash · completed"]);
  assert.ok(!JSON.stringify(data).includes("secret"));
  queued=true; assert.equal(p.capture(ctx).status,"working"); queued=false;
  idle=false; assert.equal(p.capture(ctx).status,"working");
  assert.equal(p.capture({...ctx,hasUI:false}).reason,"session_loading");
  const huge=p.normalizeMessages(Array.from({length:100},()=>message({role:"user",content:"汉".repeat(20000)})));
  assert.ok(huge.truncated && huge.messages.length<=80 && Buffer.byteLength(JSON.stringify(huge.messages))<=500000);
});
test("Pi snapshot and live identity guard sends, interruption and stale registrations",async()=>{
  const p=await provider(); let active=fixture(), record={state:"live",address:target.terminal,status:"idle"}; const calls=[];
  p.setMocks({readTextFile:()=>JSON.stringify(active),hc(args){calls.push(args);return {code:0,stdout:args[0]==="read"?"approval":JSON.stringify(args[0]==="get"?record:{started:true})}}});
  assert.equal(p.parseSnapshot(JSON.stringify(active),"t2"),null);
  assert.equal(p.parseSnapshot(JSON.stringify(active),target.terminal,active.at+7000),null);
  const direct=await p.identify(target); assert.equal(direct.method,"registro Pi");
  const session=direct.session; assert.equal(session.id,id);
  await p.send(target,session,"hola");
  assert.deepEqual(calls.at(-1),["send","--if","idle","--json","--","t1y","hola"]);
  record.status="done"; await p.send(target,session,"otra");
  assert.deepEqual(calls.at(-1),["send","--json","--","t1y","otra"]);
  calls.length=0;
  active.generation=id; await assert.rejects(p.send(target,session,"no"));
  active=fixture(); active.status="working"; record.status="working";
  await assert.rejects(p.send(target,session,"no"));
  await p.interrupt(target,session);
  assert.deepEqual(calls.at(-1),["interrupt","t1y","--json"]);
  record.status="blocked"; assert.equal(await p.blockedPreview(target,session),"approval");
  active.at=Date.now()-7000; assert.equal((await p.identify(target)).pending,true);
  assert.ok(!calls.some(c=>c[0]==="send"));
  assert.equal(await p.identify({...target,machine:"remote"}),null);
});
