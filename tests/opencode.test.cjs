"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const url=s=>"data:text/javascript;charset=utf-8,"+encodeURIComponent(s);
const plugin=()=>import(url(fs.readFileSync(path.join(root,"integrations/opencode/tui.ts"),"utf8")));
const id="ses_example123", generation="01234567-89ab-4cde-8fab-0123456789ab";
const target={providerId:"opencode",terminal:"t1y",cwd:"C:/work",machine:null};
const fixture=()=>({version:1,provider:"opencode",terminal:target.terminal,id,generation,at:Date.now(),cwd:target.cwd,status:"idle",
  data:{messages:[{role:"user",text:"hola",time:123},{role:"assistant",text:"Hola",time:124}],total:2,truncated:false}});
async function provider(){
  const source=fs.readFileSync(path.join(root,"mods/jec-chat/providers/opencode.js"),"utf8")
    .replace('import { appHome, readTextFile, hc } from "herdr";',
      'let mocks; export const setMocks=m=>{mocks=m}; const appHome=()=>"/app"; const readTextFile=(...a)=>mocks.readTextFile(...a); const hc=(...a)=>mocks.hc(...a);');
  return import(url(source));
}
test("OpenCode snapshot captures only visible user/assistant/tool rows, not reasoning or metadata",async()=>{
  const p=await plugin();
  const raw=[
    {type:"user",text:"hola",time:{created:123},metadata:{secret:"omit"}},
    {type:"synthetic",text:"secret synthetic"},
    {type:"assistant",time:{created:124,completed:125},content:[
      {type:"reasoning",text:"secret reasoning"},{type:"text",text:"respuesta"},
      {type:"tool",name:"bash",state:{status:"completed",input:{secret:"omit"},content:["secret output"]}}]}
  ];
  const data=p.normalizeMessages(raw);
  assert.deepEqual(data.messages.map(m=>[m.role,m.text]),[["user","hola"],["assistant","respuesta"],["tool","bash · completed"]]);
  assert.ok(!JSON.stringify(data).includes("secret"));
  const huge=p.normalizeMessages(Array.from({length:100},()=>({type:"user",text:"汉".repeat(20000)})));
  assert.ok(huge.messages.length<=80 && huge.truncated && huge.total===100);
  assert.ok(Buffer.byteLength(JSON.stringify(huge.messages))<=500000);
});
test("active TUI route selects exact root session, not newest session or subagent",async()=>{
  const p=await plugin();
  let route={type:"session",sessionID:id}, parentID, status="idle", permissions=[];
  let requested=[];
  const ctx={ui:{router:{current:()=>route}},data:{session:{
    get:(key)=>({id:key,parentID,location:{directory:"C:/work"}}),
    message:{list:key=>{requested.push(key);return [{type:"user",text:"hola"}]}},
    status:()=>status,permission:{list:()=>permissions},form:{list:()=>[]}
  }}};
  assert.equal(p.capture(ctx).id,id);
  assert.deepEqual(requested,[id]);
  status="running";assert.equal(p.capture(ctx).status,"working");
  permissions=[{}];assert.equal(p.capture(ctx).status,"blocked");
  parentID="ses_parent";assert.equal(p.capture(ctx).reason,"root_required");
  route={type:"home"};assert.equal(p.capture(ctx).reason,"open_session");
});
test("snapshot rejects wrong terminal, expired lease, invalid id and malformed history",async()=>{
  const p=await provider();
  const s=fixture(), now=s.at;
  assert.equal(p.parseSnapshot(JSON.stringify(s),target.terminal,now).id,id);
  assert.equal(p.parseSnapshot(JSON.stringify(s),"t1z",now),null);
  assert.equal(p.parseSnapshot(JSON.stringify(s),target.terminal,now+7000),null);
  assert.equal(p.parseSnapshot(JSON.stringify({...s,id:"wrong"}),target.terminal,now),null);
  assert.equal(p.parseSnapshot(JSON.stringify({...s,data:{messages:[{role:"system",text:"secret"}],total:1}}),target.terminal,now),null);
});
test("OpenCode direct identify and sends with fresh same-session lease; never force or retry",async()=>{
  const p=await provider();
  let active=fixture(), record={state:"live",status:"idle",address:target.terminal};
  const calls=[];
  p.setMocks({readTextFile(file){calls.push(["readTextFile",file]);return JSON.stringify(active)},hc(args){calls.push(args);return {code:0,stdout:JSON.stringify(args[0]==="get"?record:{started:true})}}});
  const direct=await p.identify(target);
  assert.equal(direct.session.id,id);
  assert.equal(direct.method,"registro OpenCode");
  assert.equal(direct.status,"idle");
  assert.ok(calls[1][1].endsWith("/data/jec-chat-opencode/t1y.json"));
  const session=direct.session;
  calls.length=0;
  assert.equal((await p.send(target,session,"Hola")).started,true);
  assert.deepEqual(calls.at(-1),["send","--if","idle","--json","--","t1y","Hola"]);
  record.status="done";await p.send(target,session,"Segundo");
  assert.deepEqual(calls.at(-1),["send","--json","--","t1y","Segundo"]);
  calls.length=0;
  for(const state of ["blocked","working",null]){
    record.status=state;
    await assert.rejects(p.send(target,session,"No"),/no está listo/);
  }
  record.status="idle";active.status="blocked";
  await assert.rejects(p.send(target,session,"No"),/no está listo/);
  active.status="idle";await assert.rejects(p.send(target,session,"No",()=>false),/Cambió/);
  active.id="ses_new";await assert.rejects(p.send(target,session,"No"),/cambió/);
  await assert.rejects(p.send({...target,machine:"remote"},session,"No"));
  assert.ok(calls.every(c=>c[0]!=="send"));
});
test("OpenCode interrupt and permission preview stay restricted to matching session/status",async()=>{
  const p=await provider();
  let active=fixture(), record={state:"live",status:"working",address:target.terminal};
  active.status="working";
  const calls=[];
  p.setMocks({readTextFile:()=>JSON.stringify(active),hc(args){calls.push(args);return {code:0,stdout:args[0]==="read"?"Permission request":JSON.stringify(args[0]==="get"?record:{outcome:"stopped"})}}});
  const session={id,generation};
  assert.equal((await p.interrupt(target,session)).outcome,"stopped");
  assert.deepEqual(calls.at(-1),["interrupt","t1y","--json"]);
  record.status="blocked";active.status="blocked";
  await assert.rejects(p.interrupt(target,session),/ya no está trabajando/);
  assert.equal(await p.blockedPreview(target,session),"Permission request");
  assert.ok(calls.every(c=>!["send","keys","kill"].includes(c[0])));
});
