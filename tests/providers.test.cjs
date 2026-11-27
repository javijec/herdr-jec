"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root,name),"utf8");
const moduleUrl = text => "data:text/javascript;charset=utf-8," + encodeURIComponent(text);
const catalogSource = read("mods/jec-chat/provider-catalog.js");
const catalogUrl = moduleUrl(catalogSource);
async function load() {
  const catalog = await import(catalogUrl);
  const target = await import(moduleUrl(read("mods/jec-chat/session.js").replace('"./provider-catalog.js"',JSON.stringify(catalogUrl))));
  const calls = [];
  const codex = [
    "registeredSession","listSessions","resolveCurrentSession","readSession","terminalStatus",
    "sendPrompt","interruptPrompt","blockedScreen"
  ].map(name => 'export const '+name+' = (...args)=>globalThis.__jecProviderCalls.push(['+JSON.stringify(name)+',...args]);').join("\n");
  globalThis.__jecProviderCalls = calls;
  const registry = await import(moduleUrl(read("mods/jec-chat/providers/index.js")
    .replace('"./codex.js"',JSON.stringify(moduleUrl(codex)))
    .replace('"../provider-catalog.js"',JSON.stringify(catalogUrl))));
  return { catalog, target, registry, calls };
}
const local = (providerId) => ({providerId,terminal:"t1y",cwd:"/work",machine:null});
test("catalog is synchronized and identifies only explicit program metadata", async ()=>{
  assert.equal(read("mods/jec-pane/provider-catalog.js"),catalogSource);
  const {catalog} = await load();
  for (const [program,app,id] of [
    [{key:"codex"},null,"codex"],[{name:"OpenCode"},null,"opencode"],
    [{key:"pi"},null,"pi"],[{key:"gentle-shell"},null,"pi"],
    [{key:"shell"},"pi","pi"],[{name:"pipeline"},null,null],
    [{name:"Raspberry Pi"},null,null], [{key:"opencode"},"codex","opencode"],
  ]) assert.equal(catalog.detectAgent(program,app),id);
  assert.equal(catalog.targetMachine("server/t1y"),"server");
  assert.equal(catalog.targetMachine("t1y"),null);
});
test("target resolution never trusts terminal names, distinguishes machines and agents", async ()=>{
  const {target} = await load();
  const resolve=(address,program,space={})=>target.resolveTarget({
    focus:{terminal:address,pane:"p1",space:"s1"},
    allPanes:[{terminal:address,pane:"p1",tab:"b1",cwd:"/work",program}],
    allSpaces:[{id:"s1",tabs:[{id:"b1"}],...space}],
    allTerminals:[{address,name:"codex"}]
  });
  assert.equal(resolve("t1y",{key:"opencode"}).providerId,"opencode");
  assert.equal(resolve("t1y",{key:"shell"}).providerId,null);
  assert.equal(resolve("server/t1y",{key:"codex"}).machine,"server");
  assert.equal(resolve("t1y",{key:"codex"},{machine:"server"}).machine,"server");
});
test("registry does not fall back to Codex for known unsupported agents or remotes", async ()=>{
  const {registry} = await load();
  const provider=registry.providerFor(local("codex"));
  assert.equal(provider.id,"codex");
  assert.equal(registry.providerFor(local("opencode")),null);
  assert.equal(registry.providerFor(local("pi"),true),null);
  assert.equal(registry.providerFor(local("opencode"),true),null);
  assert.equal(registry.providerFor({...local("codex"),terminal:"server/t1y"},true),null);
  assert.equal(registry.providerFor({...local(null),machine:"remote"},true),null);
  assert.equal(registry.providerFor(local(null),true).id,"codex");
  const session={id:"session-1",file:"rollout.jsonl"};
  assert.equal(registry.allowsAction(local("codex"),provider,session,true,"send"),true);
  assert.equal(registry.allowsAction(local("codex"),provider,session,false,"send"),false);
  assert.equal(registry.allowsAction(local("codex"),provider,session,true,"approval"),false);
  assert.equal(registry.allowsAction(local(null),provider,session,true,"send"),false);
  assert.equal(registry.allowsAction(local("opencode"),provider,session,true,"send"),false);
  assert.notEqual(registry.sessionKey(local("codex"),provider,session),
    registry.sessionKey({...local("codex"),terminal:"remote/t1y"},provider,session));
  assert.notEqual(registry.sessionKey(local("codex"),provider,session),
    registry.sessionKey(local("pi"),{id:"pi"},session));
});
test("Codex adapter preserves target and delegates existing v0.7 operations", async ()=>{
  const {registry,calls} = await load();
  const target=local("codex"), provider=registry.providerFor(target), session={id:"id",file:"file"};
  await provider.identify(target);
  await provider.list(target);
  await provider.match(target,[session]);
  await provider.read(target,session);
  await provider.send(target,session,"hello");
  await provider.interrupt(target,session);
  await provider.blockedPreview(target,session);
  assert.deepEqual(calls.slice(0,4),[
    ["registeredSession","/work","t1y"],["listSessions","/work"],
    ["resolveCurrentSession","/work","t1y",[session]],["readSession","/work","file","id"]
  ]);
  assert.deepEqual(calls[4].slice(0,4),["sendPrompt",{...target,isCodex:true},session,"hello"]);
  assert.equal(calls[5][0],"interruptPrompt");
  assert.equal(calls[6][0],"blockedScreen");
});
test("view depends on the registry, not on a concrete agent", ()=>{
  const main=read("mods/jec-chat/main.js");
  assert.match(main,/from "\.\/providers\/index\.js"/);
  assert.doesNotMatch(main,/from "\.\/providers\/codex\.js"/);
  assert.match(main,/provider\.identify\(target\)/);
  assert.match(main,/provider\.send\(target, session, prompt, current\)/);
});
