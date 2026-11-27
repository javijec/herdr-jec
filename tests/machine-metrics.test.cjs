"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const load=()=>import("data:text/javascript;charset=utf-8,"+encodeURIComponent(fs.readFileSync(path.join(__dirname,"../mods/jec-workspace-status/machine-metrics.js"),"utf8")));
const fixture="JEC_METRICS_V1\ncpu=27.5\nmem=1024 4096\ndisk=2000 4000\ntemp=51.2\n";
test("valid, partial and malformed samples",async()=>{
 const {parseMetrics}=await load(), d=parseMetrics(fixture);
 assert.equal(d.cpu,27.5);assert.equal(d.ram.percent,25);assert.equal(d.disk.percent,50);assert.equal(d.temp,51.2);
 assert.deepEqual(parseMetrics("JEC_METRICS_V1\ncpu=0\nmem=\ndisk=\ntemp=\n"),{cpu:0,ram:null,disk:null,temp:null});
 assert.equal(parseMetrics("JEC_METRICS_V1\ncpu=101\nmem=99 1\ndisk=0 0\ntemp=999\n"),null);
 assert.equal(parseMetrics("unexpected"),null);
});
test("remote probe routes through Herdr and falls back to Windows when platform unknown",async()=>{
 const {probe}=await load(), calls=[];
 const exec=async(cmd,args,opts)=>{calls.push({cmd,opts});return cmd==="sh"?{code:42,stdout:""}:{code:0,stdout:fixture}};
 assert.equal((await probe(exec,"remote",null)).platform,"windows");
 assert.deepEqual(calls.map(c=>c.cmd),["sh","powershell.exe"]);
 assert.ok(calls.every(c=>c.opts.on==="remote"&&c.opts.timeout<=12000));
});
test("known local platform uses only its own probe; missing results fail safely",async()=>{
 const {probe}=await load(),calls=[];
 assert.equal(await probe(async(cmd)=>{calls.push(cmd);throw Error("offline")},null,"windows"),null);
 assert.deepEqual(calls,["powershell.exe"]);
});
test("no stale values shown and missing temperature not invented",async()=>{
 const {parseMetrics,describeMetrics,STALE_MS}=await load();
 const d=parseMetrics(fixture), entry={data:d,platform:"linux",at:1000};
 assert.match(describeMetrics(entry,2000,"pi").text,/CPU 28%.*RAM 25%.*Disk 50%.*51°C/);
 assert.equal(describeMetrics(entry,1001+STALE_MS,"pi").available,false);
 assert.equal(describeMetrics({failed:true},1000,"pi").text,"Metrics unavailable");
 const partial=parseMetrics("JEC_METRICS_V1\ncpu=0\n");
 assert.doesNotMatch(describeMetrics({data:partial,at:0},1000,"PC").text,/°C/);
});
