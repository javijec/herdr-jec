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
changes.push(...[
  [
    "import { spaces, agents, machines, theme, run, window, keys } from \"herdr\";",
    "import { spaces, agents, terminals, machines, theme, run, window, keys } from \"herdr\";\nimport { agentSummary, summaryLabel } from \"./agent-summary.js\";"
  ],
  [
    "    const list = agents();\n    const needs = list.filter(a => a.status === \"blocked\").length;",
    "    const summary = agentSummary(agents(), terminals());\n    const needs = summary.blocked;"
  ],
  [
    ".child(h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} ${list.length === 1 ? \"agent\" : \"agents\"}`)",
    ".child(h_flex().gap(6).items_center().flex_none().tooltip(summaryLabel(summary)).child(div().size(6).rounded(3).bg(summary.working ? t.working : t.dim)).child(`${summary.total} ${summary.total === 1 ? \"agent\" : \"agents\"}`)"
  ]
]);
changes.push(...[
  [
    "import { spaces, agents, terminals, machines, theme, run, window, keys } from \"herdr\";",
    "import { spaces, agents, terminals, machines, theme, run, window, keys, exec, checking } from \"herdr\";\nimport { probe, describeMetrics, REFRESH_MS, RETRY_MS } from \"./machine-metrics.js\";"
  ],
  [
    "export default class WorkspaceStatus extends View {",
    "export default class WorkspaceStatus extends View {\n  init(_props, cx) {\n    this.metrics = new Map();\n    this.metricsBusy = false;\n    if (checking()) return;\n    // One job at a time, active visible machine only. Never poll from render().\n    this.refreshMetrics(cx);\n    cx.timer.every(5000, cx => this.refreshMetrics(cx));\n  }\n\n  refreshMetrics(cx) {\n    if (checking() || !window()?.visible || !window()?.active || this.metricsBusy) return;\n    const space = spaces().find(s => s.active);\n    if (!space) return;\n    const on = space.machine ?? null;\n    if (machines().find(m => m.name === on)?.layout !== \"ready\") return;\n    const now = Date.now();\n    const prev = this.metrics.get(on);\n    if (prev && now < prev.next) return;\n    this.metricsBusy = true;\n    cx.spawn(async cx => {\n      try {\n        const platform = on === null ? window()?.platform : null;\n        const preferred = platform === \"windows\" || platform === \"linux\" ? platform : (prev?.platform ?? null);\n        const result = await probe(exec, on, preferred);\n        const at = Date.now();\n        this.metrics.set(on, result\n          ? { ...result, at, next: at + REFRESH_MS }\n          : { failed: true, at, next: at + RETRY_MS });\n      } finally {\n        this.metricsBusy = false;\n        cx.notify();\n      }\n    });\n  }\n"
  ],
  [
    "    const needs = summary.blocked;",
    "    const needs = summary.blocked;\n    const machineMetrics = describeMetrics(this.metrics?.get(space?.machine ?? null), Date.now(), context.machineName);"
  ],
  [
    "      .child(div().flex_1())\n      .child(div().id(\"palette\")",
    "      .child(div().flex_1().min_w(0))\n      .when(Boolean(space) && context.state === \"ready\", el => el.child(div().id(\"jec-metrics\").min_w(0).max_w(260).truncate().text_color(machineMetrics.available ? t.muted : t.dim).tooltip(machineMetrics.hint).child(machineMetrics.text)))\n      .child(div().id(\"palette\")"
  ]
]);
changes.push(...[
  [
    "import { spaces, agents, terminals, machines, theme, run, window, keys, exec, checking } from \"herdr\";",
    "import { spaces, agents, terminals, machines, theme, run, window, keys, exec, checking, props } from \"herdr\";\nimport { statusOptions } from \"./preferences.js\";"
  ],
  [
    "import { probe, describeMetrics, REFRESH_MS, RETRY_MS } from \"./machine-metrics.js\";",
    "import { probe, describeMetrics, RETRY_MS } from \"./machine-metrics.js\";"
  ],
  [
    "    if (checking()) return;",
    "    if (checking()) return;\n    const options = statusOptions(props());\n    if (!options.metrics || !(options.cpu || options.ram || options.disk || options.temperature)) return;"
  ],
  [
    "    if (checking() || !window()?.visible || !window()?.active || this.metricsBusy) return;",
    "    const options = statusOptions(props());\n    if (!options.metrics || !(options.cpu || options.ram || options.disk || options.temperature) || checking() || !window()?.visible || !window()?.active || this.metricsBusy) return;"
  ],
  [
    "at + REFRESH_MS",
    "at + options.refreshMs"
  ],
  [
    "    const machineMetrics = describeMetrics(this.metrics?.get(space?.machine ?? null), Date.now(), context.machineName);",
    "    const options = statusOptions(props());\n    const machineMetrics = describeMetrics(this.metrics?.get(space?.machine ?? null), Date.now(), context.machineName, options);"
  ],
  [
    ".when(Boolean(space), el => el.child(h_flex().min_w(0).gap(5)",
    ".when(options.space && Boolean(space), el => el.child(h_flex().min_w(0).gap(5)"
  ],
  [
    ".when(Boolean(space?.branch), el => el.child(h_flex()",
    ".when(options.branch && Boolean(space?.branch), el => el.child(h_flex()"
  ],
  [
    "      .child(h_flex().gap(6).items_center().flex_none().tooltip(summaryLabel(summary))",
    "      .when(options.agentSummary, el => el.child(h_flex().gap(6).items_center().flex_none().tooltip(summaryLabel(summary))"
  ],
  [
    ".when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} ${needs === 1 ? \"needs\" : \"need\"} you`))))",
    ".when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} ${needs === 1 ? \"needs\" : \"need\"} you`)))))"
  ],
  [
    ".when(Boolean(space) && context.state === \"ready\", el => el.child(div().id(\"jec-metrics\")",
    ".when(options.metrics && (options.cpu || options.ram || options.disk || options.temperature) && Boolean(space) && context.state === \"ready\", el => el.child(div().id(\"jec-metrics\")"
  ]
]);
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
