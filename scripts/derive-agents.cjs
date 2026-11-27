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
changes.push(...[
  [
    "import { agentSummary, summaryLabel } from \"./agent-summary.js\";",
    "import { agentSummary, summaryLabel } from \"./agent-summary.js\";\nimport { activitySnapshot, trackActivity, observedDuration, activityHint, descendants, groupActivity, machineName } from \"./activity.js\";"
  ],
  [
    "  { id: \"grouped\", label: \"Grouped by space\", icon: \"layers\" },",
    "  { id: \"grouped\", label: \"Grouped by space\", icon: \"layers\" },\n  { id: \"machine\", label: \"Grouped by machine\", icon: \"server\" },"
  ],
  [
    "    this.folded = new Set();",
    "    this.folded = new Set();\n    this.activity = new Map();"
  ],
  [
    "  tree(all, addr, lead = []) {\n    const kids = all.filter((k) => k.parent === addr && k.state === \"live\");\n    return kids.flatMap((k, i) => {\n      const last = i === kids.length - 1;\n      return [\n        { t: k, lines: [...lead, last ? \"└\" : \"├\"] },\n        ...this.tree(all, k.address, [...lead, last ? \"\" : \"│\"]),\n      ];\n    });\n  }",
    "  tree(_all, addr) {\n    return descendants(this.snapshot.children, addr);\n  }"
  ],
  [
    "    const on = k.address === shown;",
    "    const on = k.address === shown;\n    const elapsed = this.activity.get(k.address);\n    const parent = this.snapshot.terminalByAddress.get(k.parent);\n    const parentName = parent?.name || parent?.program?.name || k.parent || \"Unknown\";"
  ],
  [
    "      .on_click(() => (this.listed.has(k.address) ? run(\"pane.focus\", { terminal: k.address }) : this.peek(k.address)))",
    "      .tooltip(`${k.name || k.template || k.program?.name || k.address} · Parent: ${parentName}${elapsed ? \" · \"+activityHint(elapsed,this.now) : \"\"}`)\n      .on_click(() => (this.listed.has(k.address) ? run(\"pane.focus\", { terminal: k.address }) : this.peek(k.address)))"
  ],
  [
    "      .child(this.status(t, { status: st }, compact));",
    "      .when(Boolean(elapsed), el => el.child(div().ml(4).mr(4).flex_none().text_size(10).text_color(st===\"blocked\"?t.blocked:t.dim).child(observedDuration(elapsed,this.now))))\n      .child(this.status(t, { status: st }, compact));"
  ],
  [
    "    this.track(list, now);",
    "    this.track(list, now);\n    this.now = now;\n    this.snapshot = activitySnapshot(list, all, kidStatus);\n    this.activity = trackActivity(this.activity, this.snapshot.states, now);\n    const sp = spaces();\n    const spaceById = new Map(sp.map(s=>[s.id,s]));"
  ],
  [
    "    const byPriority = sort.id === \"priority\";",
    "    const byPriority = sort.id === \"priority\";\n    const byMachine = sort.id === \"machine\";"
  ],
  [
    "    const rest = list.filter((a) => !a.pinned);",
    "    const rest = list.filter((a) => !a.pinned);\n    if (byMachine) rest.sort((a,b) => (machineName(a,spaceById)??\"\").localeCompare(machineName(b,spaceById)??\"\"));"
  ],
  [
    "    const tabs = new Map(spaces().flatMap(s => s.tabs).map(tab => [tab.id, tab]));",
    "    const tabs = new Map(sp.flatMap(s => s.tabs).map(tab => [tab.id, tab]));"
  ],
  [
    "        .text_color(open ? t.dim : (t[top] ?? t.dim))",
    "        .text_color(top === \"blocked\" ? t.blocked : open ? t.dim : (t[top] ?? t.dim))"
  ],
  [
    "      const machine = a.address.includes(\"/\") ? a.address.split(\"/\")[0] : null;",
    "      const machine = machineName(a,spaceById);\n      const elapsed = this.activity.get(a.address);\n      const inheritedBlocked = a.status !== \"blocked\" && rankOf(a) === RANK.blocked;\n      const rowHint = [a.space_name, label(a), machine ?? \"This computer\", activityHint(elapsed,now), inheritedBlocked ? \"Subagent needs attention\" : \"\"].filter(Boolean).join(\" · \");"
  ],
  [
    "          .on_click(() => run(\"pane.focus\", { pane: a.pane }))\n          .child(div().flex_1()",
    "          .tooltip(rowHint)\n          .on_click(() => run(\"pane.focus\", { pane: a.pane }))\n          .child(div().flex_1()"
  ],
  [
    ".child(this.status(t, a, true)));",
    ".child(this.status(t, inheritedBlocked ? {status:\"blocked\"} : a, true)));"
  ],
  [
    "      const full = byPriority || isPinned;",
    "      const full = byPriority || byMachine || isPinned;"
  ],
  [
    "        .on_click(() => run(\"pane.focus\", { pane: a.pane }))\n        .when(Boolean(pic)",
    "        .tooltip(rowHint)\n        .on_click(() => run(\"pane.focus\", { pane: a.pane }))\n        .when(Boolean(pic)"
  ],
  [
    "        .when(Boolean(machine), el => el.child(div().text_size(10).text_color(t.dim).child(machine)))",
    "        .when(Boolean(machine) && (!byMachine || isPinned), el => el.child(div().max_w(55).truncate().text_size(10).text_color(t.dim).child(machine)))"
  ],
  [
    "        .when(this.hovered !== a.address && Boolean(when), el => el.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(now - when))))",
    "        .when(this.hovered !== a.address && (Boolean(elapsed) || Boolean(when)), el => el.child(div().flex_none().text_size(10).text_color(elapsed?.status===\"blocked\"?t.blocked:t.dim).child(elapsed?observedDuration(elapsed,now):duration(Math.max(0,now-when)))))"
  ],
  [
    "        .child(this.status(t, a, byPriority && !isPinned));",
    "        .child(this.status(t, inheritedBlocked ? {status:\"blocked\"} : a, byPriority && !isPinned));"
  ],
  [
    "      const id = byPriority ? `sec-${r}` : `sp-${a.space}`;",
    "      const machine = machineName(a,spaceById);\n      const id = byPriority ? `sec-${r}` : byMachine ? `machine-${JSON.stringify(machine)}` : `sp-${a.space}`;"
  ],
  [
    "label: byPriority ? SECTION[r] : a.space_name || \"\"",
    "label: byPriority ? SECTION[r] : byMachine ? machine ?? \"This computer\" : a.space_name || \"\""
  ],
  [
    "      const top = g.members.reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);",
    "      const stats = groupActivity(g.members,this.snapshot);\n      const top = stats.blocked ? \"blocked\" : stats.working ? \"working\" : g.members.reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);"
  ],
  [
    "        .child(div().text_color(t.dim).child(String(g.members.length)))\n        .child(div().flex_1())",
    "        .child(div().text_color(t.dim).child(String(g.members.length)))\n        .tooltip(`${g.label} · ${stats.total} agents including subagents · ${stats.working} working · ${stats.blocked} need you`)\n        .child(div().flex_1())\n        .when(!byPriority && stats.blocked > 0, el => el.child(div().flex_none().text_color(t.blocked).child(`!${stats.blocked}`)))\n        .when(!byPriority && stats.working > 0, el => el.child(div().flex_none().text_color(t.working).child(`▶${stats.working}`)))"
  ],
  [
    "width: 200, height: 140, props: { sortMenu: true }",
    "width: 220, height: 170, props: { sortMenu: true }"
  ]
]);
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
