"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const changes=[
  [
    "import { spaces, agents, theme, run, window, keys } from \"herdr\";",
    "import { spaces, agents, machines, theme, run, window, keys } from \"herdr\";\nimport { workspaceContext } from \"./workspace-context.js\";"
  ],
  [
    "    const space = spaces().find(s => s.active);",
    "    const space = spaces().find(s => s.active);\n    const context = workspaceContext(space, machines());"
  ],
  [
    "      .child(label(space?.machine ? \"server\" : \"monitor\", space?.machine ?? \"This computer\"))",
    "      .child(h_flex().id(\"jec-machine-status\").gap(6).items_center().min_w(0)\n        .cursor_pointer().hover(el => el.text_color(t.foreground))\n        .tooltip(context.machineHint)\n        .on_click(() => run(\"app.settings\", { section: \"machines\" }))\n        .child(svg(`mods/workspace-chrome/${space?.machine ? \"server\" : \"monitor\"}.svg`).size(13).flex_none())\n        .child(div().min_w(0).max_w(130).truncate().child(context.machineName))\n        .child(div().size(6).rounded(3).flex_none().bg(context.state === \"ready\" ? t.ansi2 : context.state === \"unavailable\" ? t.blocked : t.dim)))\n      .when(Boolean(space), el => el.child(h_flex().min_w(0).gap(5).items_center().tooltip(context.spaceHint)\n        .child(div().min_w(0).max_w(130).truncate().child(context.spaceName))\n        .child(div().flex_none().text_color(t.dim).child(`· ${context.tabs} ${context.tabs === 1 ? \"tab\" : \"tabs\"}`))))"
  ],
  [
    "      .when(Boolean(space?.branch), el => el.child(label(\"branch\", space.branch)))",
    "      .when(Boolean(space?.branch), el => el.child(h_flex().gap(6).items_center().min_w(0).tooltip(space.branch)\n        .child(svg(\"mods/workspace-chrome/branch.svg\").size(13).flex_none())\n        .child(div().min_w(0).max_w(120).truncate().child(space.branch))))"
  ],
  [
    "      .child(div().id(\"palette\").text_color(t.dim)",
    "      .child(div().id(\"palette\").flex_none().text_color(t.dim)"
  ],
  [
    "    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);\n",
    ""
  ]
];
const prefix="// Based on official Herdr Workspace Status @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa; Apache-2.0 (LICENSE.herdr).\n// JEC v0.3: active machine availability and workspace context.\n";
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
 const p="mods/jec-workspace-status/main.js",s=derive(read("upstream/herdr-app/defaults/mods/workspace-status/main.js"));
 if(process.argv.includes("--check")){if(read(p)!==s)throw Error(p+" differs from official baseline + JEC changes");}
 else fs.writeFileSync(path.join(root,p),s);
}
module.exports={derive};
