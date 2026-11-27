"use strict";
// Derive JEC from the exact upstream pane header and default layout.
// No network access or implicit upgrade; update pinned snapshots explicitly.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function once(s,a,b){
  if(s.indexOf(a)<0 || s.indexOf(a)!==s.lastIndexOf(a)) throw Error("Upstream anchor changed: "+a);
  return s.replace(a,b);
}
function deriveHeader(source){
  let s=once(source,'import { View, div, svg, image } from "gpui-kit";','import { div, svg, image } from "gpui-kit";');
  s=once(s,'import { panes, props, run, theme, home, layout } from "herdr";','import { panes, props, run, theme, home, layout } from "herdr";\nimport { showChatToggle, chatToggle } from "./chat-toggle.js";');
  s=once(s,'export default class Pane extends View {\n  init() { this.hovered = false; }','export class PaneHeader {\n  constructor() { this.hovered = false; }');
  s=once(s,'      .when(this.hovered, el => el','      .when(showChatToggle(p), el => el.child(chatToggle(t, p)))\n      .when(this.hovered, el => el');
  return "// Based on herdrdev/herdr-app defaults/mods/pane/main.js @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa\n// Modified for JEC: header role and one Chat/Terminal action. See native/upstream/LICENSE.\n"+s;
}
function deriveLayout(source){
  return once(source,'"mod": "pane"','"mod": "jec-chat-native",\n                      "props": {\n                        "paneHeader": true\n                      }');
}
if(require.main===module){
  const check=process.argv.includes("--check");
  const outputs={"mods/jec-chat/pane-header.js":deriveHeader(read("native/upstream/pane.js")),"layouts/jec-chat-native.json":deriveLayout(read("native/upstream/main.json"))};
  for(const [p,s] of Object.entries(outputs)){
    if(check){if(read(p)!==s) throw Error(p+" differs from generated upstream baseline");}
    else fs.writeFileSync(path.join(root,p),s);
  }
}
module.exports={deriveHeader,deriveLayout};
