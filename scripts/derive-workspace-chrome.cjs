"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const changes=[
  [
    "import { theme, run, props, window, shared, setShared, updates, layout } from \"herdr\";",
    "import { theme, run, props, window, shared, setShared, updates, layout, machines } from \"herdr\";\nimport { machineOverview } from \"./machine-overview.js\";"
  ],
  [
    "  button(id, label, action) {",
    "  button(id, label, action, hint) {"
  ],
  [
    "      .on_mouse_down(\"left\", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);",
    "      .tooltip(hint).on_mouse_down(\"left\", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);"
  ],
  [
    "      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(8)\n        .when(collapsed, el => el.relative().w(32).px(0).justify_center().tooltip(label))",
    "      const overview = machineOverview(machines());\n      const row = (id, icon, label, dim, action, hint = label) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(8).tooltip(hint)\n        .when(collapsed, el => el.relative().w(32).px(0).justify_center())"
  ],
  [
    "        .child(row(\"machine\", \"plus\", \"Add machine\", true, () => run(\"mod.open\", { name: \"machine-add\" })));",
    "        .child(row(\"jec-machines-settings\", \"server\", \"Machines\", false, () => run(\"app.settings\", { section: \"machines\" }), overview.hint)\n          .when(!collapsed && overview.total > 0, el => el.child(div().flex_1()).child(div().flex_none().text_size(10).text_color(t.dim).child(`${overview.ready}/${overview.total}`)))\n          .when(collapsed && overview.unavailable > 0, el => el.child(div().absolute().right(4).top(4).size(6).rounded_full().bg(t.blocked))))\n        .child(row(\"machine\", \"plus\", \"Add machine\", true, () => run(\"mod.open\", { name: \"machine-add\" })));"
  ],
  [
    "() => run(\"mod.open\", { name: \"picker\" }))))",
    "() => run(\"mod.open\", { name: \"picker\" }), \"Find spaces and terminals\")))"
  ],
  [
    ".size(15), toggleSidebar)));",
    ".size(15), toggleSidebar, collapsed ? \"Expand sidebar\" : \"Collapse sidebar\")));"
  ]
];
changes.push(...[
  [
    "import { machineOverview } from \"./machine-overview.js\";",
    "import { machineOverview } from \"./machine-overview.js\";\nimport { chromeOptions } from \"./preferences.js\";"
  ],
  [
    "      const overview = machineOverview(machines());",
    "      const options = chromeOptions(props());\n      const overview = machineOverview(machines());"
  ],
  [
    "        .child(row(\"jec-machines-settings\",",
    "        .when(options.machines, el => el.child(row(\"jec-machines-settings\","
  ],
  [
    ".bg(t.blocked))))\n        .child(row(\"machine\"",
    ".bg(t.blocked)))))\n        .child(row(\"machine\""
  ]
]);
const prefix="// Based on official Herdr Workspace Chrome @ 1180a5cec3b8bd4dfebf4a9b217ab8cb59a96ffa; Apache-2.0 (LICENSE.herdr).\n// JEC v0.4: direct machine settings, layout readiness and navigation hints.\n";
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
 const p="mods/jec-workspace-chrome/main.js",s=derive(read("upstream/herdr-app/defaults/mods/workspace-chrome/main.js"));
 if(process.argv.includes("--check")){if(read(p)!==s)throw Error(p+" differs from official baseline + JEC changes");}
 else fs.writeFileSync(path.join(root,p),s);
}
module.exports={derive};
