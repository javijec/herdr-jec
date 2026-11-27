"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const result = find(child, id);
    if (result) return result;
  }
  return null;
}
test("layout JEC conserva el Herdr original y cambia solo la vista central", () => {
  const data = JSON.parse(read("layouts/jec-chat.json"));
  assert.equal(find(data, "tabs").content.mod, "tabs");
  assert.equal(find(data, "agents").content.mod, "agents");
  assert.equal(find(data, "spaces").content.mod, "spaces");
  assert.equal(find(data, "panel-body").active, "files");
  const stage = find(data, "jec-view");
  assert.equal(stage.type, "stack");
  assert.equal(stage.active, "main");
  assert.equal(stage.children.length, 2);
  assert.equal(find(data, "main").content.tab, "active");
  assert.deepEqual(find(data, "main").content.pane.header.content, {mod:"jec-chat",props:{paneHeader:true}});
  assert.equal(find(data, "jec-chat-view").content.mod, "jec-chat");
  assert.equal(find(data, "jec-chat-view").content.props.embedded, true);
});
test("mods JEC no se acoplan al nombre de la terminal ni anulan el layout base", () => {
  for (const name of ["jec-chat"]) {
    const mod = JSON.parse(read(`mods/${name}/mod.json`));
    assert.equal(mod.place, "none");
  }
  const pane = read("mods/jec-chat/pane-header.js");
  assert.match(pane, /setShared\(VIEW_KEY, rememberChat/);
  assert.match(pane, /chatAvailable\(p\)/);
  assert.match(pane, /stack: "jec-view", child: "jec-chat-view"/);
  const chat = read("mods/jec-chat/main.js");
  assert.match(chat, /stack: "jec-view", child: "main"/);
  assert.match(chat, /candidate\.terminal === wanted\.terminal/);
});

test("Chat embebido replica el marco y el encabezado compacto del pane original", () => {
  const chat = read("mods/jec-chat/main.js");
  const pane = read("mods/jec-chat/pane-header.js");
  assert.match(chat, /this\.embedded \? 30 : 53/);
  assert.match(chat, /rounded\(10\)\.overflow_hidden\(\)\.border_1\(\)\.border_color\(t\.border\)/);
  assert.match(chat, /program\.tint \? svg\(program\.icon\)/);
  assert.match(chat, /this\.embedded \? "Terminal" : "← Terminal"/);
  assert.match(chat, /jec-choose-inline/);
  assert.match(chat, /jec-refresh-inline/);
  assert.match(pane, /this\.chatButton\(t, p\)/);
});

test("Chat view preferences are independent per tab and space", async () => {
  const source = read("mods/jec-chat/view-state.js");
  const {activeTab,rememberChat,forgetChat,wantedPane,activeView} =
    await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(source));
  const a={space:"s1",tab:"b1"}, b={space:"s1",tab:"b2"}, c={space:"s2",tab:"b3"};
  const p1={pane:"p1",terminal:"t1",tab:"b1"}, p2={pane:"p2",terminal:"t2",tab:"b2"}, p3={pane:"p3",terminal:"t3",tab:"b3"};
  const panes=[p1,p2,p3];
  let saved=rememberChat(null,a,p1);
  assert.equal(wantedPane(saved,a,panes),p1);
  assert.equal(wantedPane(saved,b,panes),null);
  saved=rememberChat(saved,b,p2);
  assert.equal(wantedPane(saved,b,panes),p2);
  assert.equal(wantedPane(saved,a,panes),p1);
  saved=forgetChat(saved,b);
  assert.equal(wantedPane(saved,b,panes),null);
  assert.equal(wantedPane(saved,a,panes),p1);
  saved=rememberChat(saved,c,p3);
  assert.equal(wantedPane(saved,c,panes),p3);
  assert.equal(wantedPane(saved,a,[{...p1,terminal:"replacement"}]),null);
  assert.equal(wantedPane(saved,{...a,space:"other"},panes),null);
  assert.equal(rememberChat(saved,b,p1),saved);
  assert.deepEqual(activeTab([{id:"s1",active:false,tabs:[{id:"b1",active:true}]},{id:"s2",active:true,tabs:[{id:"b3",active:true}]}]),c);
  assert.equal(activeView({id:"root",children:[{id:"jec-view",active:"main"}]}),"main");
});
test("explicit Terminal forgets only active tab; automatic fallback does not forget",()=>{
  const chat=read("mods/jec-chat/main.js"), pane=read("mods/jec-chat/pane-header.js");
  assert.match(chat,/back\(\) \{[\s\S]*?forgetChat\(shared\(VIEW_KEY\), active\)/);
  assert.match(chat,/live\.terminal !== this\.target\?\.terminal/);
  assert.doesNotMatch(chat,/if \(!next && view === "jec-chat-view"\) this\.back\(\)/);
  assert.match(pane,/cx\.timer\.every\(250, \(\) => this\.restoreChat\(\)\)/);
  assert.match(pane,/p\.terminal !== wanted\.terminal/);
});

test("archived Chat source keeps its unified roles; installer now selects Machines",()=>{
 const chat=read("mods/jec-chat/main.js"), header=read("mods/jec-chat/pane-header.js"), installer=read("install.ps1");
 assert.match(chat,/this\.headerRole = config\.paneHeader === true/);
 assert.match(chat,/if \(this\.headerRole\) return this\.paneHeader\.render\(cx\)/);
 assert.match(chat,/close\(\) \{ if \(this\.headerRole\) return/);
 assert.match(header,/Derived from herdrdev\/herdr-app/);
 assert.doesNotMatch(chat+header,/pane\.view/);
 assert.match(installer,/mods\/jec-machines/);
 assert.doesNotMatch(installer,/@\('jec-chat', 'jec-pane'\)/);
 assert.equal(fs.existsSync(path.join(root,"mods/jec-pane")),false);
});
