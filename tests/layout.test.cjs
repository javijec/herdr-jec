"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const url=s=>"data:text/javascript;charset=utf-8,"+encodeURIComponent(s);
async function helpers(){
  const cat=url(read("mods/jec-chat/provider-catalog.js"));
  const session=url(read("mods/jec-chat/session.js").replace('"./provider-catalog.js"',JSON.stringify(cat)));
  return import(url(read("mods/jec-chat/native-pane.js").replace('"./session.js"',JSON.stringify(session)).replace('"./provider-catalog.js"',JSON.stringify(cat))));
}
function find(n,id){return n.id===id?n:(n.children??[]).map(c=>find(c,id)).find(Boolean);}
test("native layout retains original tabs, spaces and split tree without a global Chat stack",()=>{
 const l=JSON.parse(read("layouts/jec-chat-native.json"));
 for(const id of ["tabs","agents","spaces"]) assert.equal(find(l,id).content.mod,id);
 assert.equal(find(l,"panel-body").active,"files");
 assert.equal(find(l,"jec-view"),undefined); assert.equal(find(l,"jec-chat-view"),undefined);
 assert.deepEqual(find(l,"main").content.pane.header.content,{mod:"jec-chat-native",props:{paneHeader:true}});
 assert.equal(find(l,"main").content.tab,"active");
 const m=JSON.parse(read("mods/jec-chat/mod.json"));
 assert.equal(m.palette[0].args.name,"jec-chat-native");
});
test("two splits use exact per-pane identity, not focused terminal or cwd",async()=>{
 const {resolvePaneBody,paneBodyVisible,samePaneTarget,NATIVE_MOD,toggleArgs}=await helpers();
 const p1={pane:"p1",terminal:"t1",tab:"b1",cwd:"/same",program:{key:"codex"},body_mod:NATIVE_MOD,focused:true};
 const p2={pane:"p2",terminal:"t2",tab:"b1",cwd:"/same",program:{key:"opencode"},body_mod:NATIVE_MOD};
 const p3={pane:"p3",terminal:"t3",tab:"b2",cwd:"/same",program:{key:"pi"},body_mod:NATIVE_MOD};
 const panes=[p1,p2,p3];
 const spaces=[{id:"s1",active:true,tabs:[{id:"b1",active:true},{id:"b2",active:false}]}];
 const a=resolvePaneBody(p1,panes,spaces,[]), b=resolvePaneBody(p2,panes,spaces,[]);
 assert.equal(a.terminal,"t1");assert.equal(b.terminal,"t2");assert.equal(b.providerId,"opencode");
 assert.equal(samePaneTarget(a,b),false);
 assert.equal(paneBodyVisible(p1,panes,spaces),true);assert.equal(paneBodyVisible(p2,panes,spaces),true);
 assert.equal(paneBodyVisible(p3,panes,spaces),false);
 p1.zoomed=true;assert.equal(paneBodyVisible(p2,panes,spaces),false);p1.zoomed=false;
 p1.body_mod=null;assert.equal(paneBodyVisible(p1,panes,spaces),false);assert.equal(paneBodyVisible(p2,panes,spaces),true);
 assert.deepEqual(toggleArgs(p1),{pane:"p1",mod:NATIVE_MOD});assert.deepEqual(toggleArgs(p2),{pane:"p2"});
 assert.equal(toggleArgs({pane:"p1",terminal:"t1"}),null);
 assert.equal(toggleArgs({...p1,body_mod:"another-mod"}),null);
 spaces[0].tabs[0].active=false;spaces[0].tabs[1].active=true;
 assert.equal(paneBodyVisible(p2,panes,spaces),false);assert.equal(paneBodyVisible(p3,panes,spaces),true);
 assert.equal(resolvePaneBody({...p2,terminal:"replacement"},panes,spaces,[]),null);
 assert.equal(resolvePaneBody(p2,panes,[{...spaces[0],machine:"remote"}],[]),null);
});
test("one mod owns header/body roles and native pane commands, no stack switching",()=>{
 const chat=read("mods/jec-chat/main.js"), header=read("mods/jec-chat/pane-header.js"), toggle=read("mods/jec-chat/chat-toggle.js");
 assert.match(chat,/this\.headerRole = p\.paneHeader === true/);
 assert.match(chat,/this\.embedded = p\.paneBody === true/);
 assert.match(chat,/if \(this\.headerRole\) return this\.paneHeader\.render\(cx\)/);
 assert.match(chat,/\.when\(!this\.embedded, el => el\.child\(this\.header\(t,target\)\)\)/);
 assert.match(chat,/run\("pane\.view",\{pane:live\.pane\}\)/);
 assert.match(toggle,/run\("pane\.view",args\)/);
 assert.match(header,/\.when\(showChatToggle\(p\)/);
 assert.doesNotMatch(chat+header+toggle,/layout\.select|setShared|restoreChat/);
 assert.match(chat,/this\.isVisible\(\) && samePaneTarget\(this\.liveTarget\(\),target\)/);
});
test("installer is opt-in and leaves stable mod names untouched",()=>{
 const s=read("install.ps1");
 assert.match(s,/pane\\\.view/);assert.match(s,/mods\/jec-chat-native/);
 assert.match(s,/layouts\/jec-chat-native\.json/);
 assert.doesNotMatch(s,/install-hooks|SkipCodexHooks/);
});

test("official pane and main layout are the reproducible base; only JEC extension differs",()=>{
 const {deriveHeader,deriveLayout}=require("../scripts/sync-upstream-pane.cjs");
 assert.equal(read("mods/jec-chat/pane-header.js"),deriveHeader(read("native/upstream/pane.js")));
 assert.equal(read("layouts/jec-chat-native.json"),deriveLayout(read("native/upstream/main.json")));
 const stock=JSON.parse(read("native/upstream/main.json")), custom=JSON.parse(read("layouts/jec-chat-native.json"));
 find(custom,"main").content.pane.header.content={mod:"pane"};
 assert.deepEqual(custom,stock);
});
