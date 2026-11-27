"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const changes=[
  [
    "import { v_flex, h_flex } from \"gpui-base\";",
    "import { v_flex, h_flex } from \"gpui-base\";\nimport { agentSummary, summaryLabel } from \"./agent-summary.js\";"
  ],
  [
    "    const all = terminals();\n    this.migratePins(all);",
    "    const all = terminals();\n    const summary = agentSummary(list, all, kidStatus);\n    this.migratePins(all);"
  ],
  [
    "        .when(!open, (el) => el.child(String(subs.length)));",
    "        .tooltip(`${subs.length} subagents · ${sts.filter(s => s === \"working\").length} working · ${sts.filter(s => s === \"blocked\").length} need you`)\n        .child(String(subs.length));"
  ],
  [
    "        .when(byPriority || !open, (el) => el.child(div().text_color(t.dim).child(String(g.members.length))))",
    "        .child(div().text_color(t.dim).child(String(g.members.length)))"
  ],
  [
    "            .child(div().text_size(11.5).font_medium().text_color(t.dim).child(\"Agents\"))",
    "            .child(h_flex().items_center().gap(7).min_w(0)\n              .child(div().text_size(11.5).font_medium().text_color(t.dim).tooltip(summaryLabel(summary)).child(`Agents · ${summary.total}`))\n              .when(summary.blocked > 0, el => el.child(div().flex_none().text_size(10).text_color(t.blocked).tooltip(\"Agents needing attention, including subagents\").child(`! ${summary.blocked}`)))\n              .when(summary.working > 0, el => el.child(div().flex_none().text_size(10).text_color(t.working).tooltip(\"Working agents, including subagents\").child(`▶ ${summary.working}`))))"
  ],
  [
    "openOverlay({ mod: \"agents\", kind: \"popup\", width: 200, height: 140, props: { sortMenu: true } })",
    "openOverlay({ mod: \"jec-agents\", kind: \"popup\", width: 200, height: 140, props: { sortMenu: true } })"
  ]
];
const prefix="// Based on official Herdr Agents @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa; Apache-2.0 (LICENSE.herdr).\n// JEC v0.2: deduplicated activity counts and visible group/subagent counts.\n";
function derive(source){
 let s=source.replace(/\r\n/g,"\n");
 for(const [a,b] of changes){
   if(s.indexOf(a)<0||s.indexOf(a)!==s.lastIndexOf(a))throw Error("Upstream changed: "+a);
   s=s.replace(a,b);
 }
 return prefix+s;
}
if(require.main===module){
 const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
 const p="mods/jec-agents/main.js",s=derive(read("upstream/herdr-app/defaults/mods/agents/main.js"));
 if(process.argv.includes("--check")){if(read(p)!==s)throw Error(p+" differs from official baseline + JEC changes");}
 else fs.writeFileSync(path.join(root,p),s);
}
module.exports={derive};
