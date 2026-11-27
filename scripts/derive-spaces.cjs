"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const changes=[
  [
    "  grouped(t, collapsed) {\n    const rows = this.ordered();",
    "  grouped(t, collapsed) {\n    const rows = this.ordered();\n    // JEC: counts use the live snapshot, including rows awaiting Git discovery.\n    const allSpaces = spaces();"
  ],
  [
    "      const mine = rows.filter((r) => (r.w.machine ?? null) === m);",
    "      const mine = rows.filter((r) => (r.w.machine ?? null) === m);\n      const summary = machineSummary(allSpaces, m);"
  ],
  [
    "const icon = svg(`mods/workspace-chrome/${m ? \"server\" : \"monitor\"}.svg`).size(13).flex_none();",
    "const icon = svg(`mods/workspace-chrome/${m ? \"server\" : \"monitor\"}.svg`).size(13).flex_none().when(summary.active, el => el.text_color(t.accent));"
  ],
  [
    ".gap(7).items_center().text_size(11).text_color(t.dim)\n        .when(collapsed, el => el.mt(4)",
    ".gap(7).items_center().text_size(11).text_color(summary.active ? t.accent : t.dim)\n        .when(collapsed, el => el.mt(4)"
  ],
  [
    ".tooltip(login ? `${m} needs a login: run ${login}. Click for Copy.` : m ? `${m} · ${connected ? \"connected\" : (machine?.state ?? \"asleep\").replace(/_/g, \" \")}` : \"This computer\"))",
    ".tooltip(`${login ? `${m} needs a login: run ${login}. Click for Copy.` : m ? `${m} · ${connected ? \"connected\" : (machine?.state ?? \"asleep\").replace(/_/g, \" \")}` : \"This computer\"} · ${summary.label}`))"
  ],
  [
    ".when(!collapsed, el => el.child(div().flex_1().truncate().child(m ?? \"This computer\"))",
    ".when(!collapsed, el => el.child(div().flex_1().truncate().tooltip(summary.label).child(m ?? \"This computer\"))\n          .child(div().flex_none().text_size(10).text_color(summary.active ? t.accent : t.dim).tooltip(summary.label).child(String(summary.count)))"
  ],
  [
    ".when(!collapsed, el => el.child(\"Spaces\"))",
    ".when(!collapsed, el => el.child(`Spaces · ${sp.length}`))"
  ],
  [
    "import { v_flex, h_flex, ScrollHandle } from \"gpui-base\";",
    "import { v_flex, h_flex, ScrollHandle } from \"gpui-base\";\nimport { machineSummary } from \"./machine-summary.js\";"
  ]
];
const prefix="// Based on official Herdr Spaces @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa; Apache-2.0 (LICENSE.herdr).\n// JEC v0.1: counts and active machine indication only.\n";
function derive(source){
 let s=source.replace(/\r\n/g,"\n");
 for(const [a,b] of changes){
   if(s.indexOf(a)<0||s.indexOf(a)!==s.lastIndexOf(a))throw Error("Upstream changed: "+a);
   s=s.replace(a,b);
 }
 return prefix+s;
}
function deriveLayout(source){
 const data=JSON.parse(source);
 function find(n,id){return n.id===id?n:(n.children??[]).map(x=>find(x,id)).find(Boolean);}
 const block=find(data,"spaces");
 if(block?.content?.mod!=="spaces")throw Error("Upstream spaces block changed");
 block.content.mod="jec-spaces";
 const agents=find(data,"agents");
 if(agents?.content?.mod!=="agents")throw Error("Upstream agents block changed");
 agents.content.mod="jec-agents";
 const status=find(data,"status");
 if(status?.content?.mod!=="workspace-status")throw Error("Upstream status block changed");
 status.content.mod="jec-workspace-status";
 for(const id of ["brand","sidebar-footer"]){
   const chrome=find(data,id);
   if(chrome?.content?.mod!=="workspace-chrome")throw Error("Upstream chrome block changed: "+id);
   chrome.content.mod="jec-workspace-chrome";
   if(id==="sidebar-footer"){
     if(!Number.isFinite(chrome.size?.px))throw Error("Upstream footer size changed");
     chrome.size.px+=28;
   }
 }
 return JSON.stringify(data,null,2)+"\n";
}
if(require.main===module){
 const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
 const outputs={"mods/jec-spaces/main.js":derive(read("upstream/herdr-app/defaults/mods/spaces/main.js")),"layouts/jec.json":deriveLayout(read("upstream/herdr-app/defaults/layouts/main.json"))};
 for(const [p,s] of Object.entries(outputs)){
   if(process.argv.includes("--check")){if(read(p)!==s)throw Error(p+" differs from official baseline + JEC changes");}
   else fs.writeFileSync(path.join(root,p),s);
 }
}
module.exports={derive,deriveLayout};
