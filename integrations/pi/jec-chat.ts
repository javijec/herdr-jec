// JEC Chat — Pi extension, also loaded by Gentle Shell.
// Only interactive sessions in the owning Herdr terminal; no session-file scans.
import { mkdirSync, writeFileSync, renameSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TERMINAL = /^t[0-9a-z]+$/i;
const MAX_ROWS = 80, MAX_TEXT = 12000, MAX_BYTES = 500000;

export function normalizeMessages(branch) {
  const rows = [];
  let clipped = false;
  function push(role, value, time, phase) {
    if (typeof value !== "string" || !value.trim()) return;
    if (value.length > MAX_TEXT) clipped = true;
    rows.push({role, text:value.slice(0,MAX_TEXT), time:Number.isFinite(time)?time:null, ...(phase?{phase}:{})});
  }
  for (const entry of Array.isArray(branch) ? branch : []) {
    if (entry?.type !== "message") continue;
    const m = entry.message;
    if (m?.role !== "user" && m?.role !== "assistant" && m?.role !== "toolResult") continue;
    const time = typeof m.timestamp === "number" ? m.timestamp : Date.parse(entry.timestamp ?? "");
    if (m.role === "toolResult") {
      if (typeof m.toolName === "string") push("tool",m.toolName.slice(0,160)+(m.isError?" · error":" · completed"),time);
      continue;
    }
    if (m.role === "user" && typeof m.content === "string") push("user",m.content,time);
    for (const part of Array.isArray(m.content) ? m.content : []) {
      if (part?.type === "text") push(m.role,part.text,time,m.role==="assistant"?"final_answer":null);
      if (m.role === "assistant" && part?.type === "toolCall" && typeof part.name === "string")
        push("tool",part.name.slice(0,160)+" · requested",time);
    }
  }
  const total = rows.length, messages = rows.slice(-MAX_ROWS);
  while (messages.length && Buffer.byteLength(JSON.stringify(messages),"utf8")>MAX_BYTES) messages.shift();
  return {messages,total,truncated:clipped||messages.length<total};
}
export function capture(ctx) {
  if (ctx?.hasUI !== true) return {reason:"session_loading"};
  const manager=ctx.sessionManager;
  const id=manager.getSessionId(), cwd=manager.getCwd();
  if (!ID.test(id??"") || typeof cwd!=="string" || !cwd) return {reason:"session_loading"};
  const branch=manager.getBranch();
  if (!Array.isArray(branch)) return {reason:"session_loading"};
  const idle=ctx.isIdle();
  const queued=typeof ctx.hasPendingMessages==="function" ? ctx.hasPendingMessages() : false;
  return {id,cwd,status:idle===true&&!queued?"idle":idle===false||queued?"working":null,data:normalizeMessages(branch)};
}

export default function jecChat(pi) {
  const terminal=process.env.HC_TERMINAL_ID;
  // Print/RPC/subagent processes must never publish over the interactive TUI.
  if (!TERMINAL.test(terminal??"") || !process.stdin.isTTY || !process.stdout.isTTY) return;
  const directory=join(process.env.HERDR_APP_HOME||join(homedir(),".config","herdr-app"),"data","jec-chat-pi");
  const file=join(directory,terminal+".json");
  let current=null, timer=null, generation=null, temp=null;
  function cleanup() {
    if (timer) clearInterval(timer);
    timer=null; current=null;
    try { if(temp) unlinkSync(temp); } catch {}
    try { if(generation&&JSON.parse(readFileSync(file,"utf8")).generation===generation) unlinkSync(file); } catch {}
    generation=null; temp=null;
  }
  function publish() {
    if (!current||!generation) return;
    let payload;
    try { payload=capture(current); } catch { payload={reason:"api_unavailable"}; }
    try {
      writeFileSync(temp,JSON.stringify({version:1,provider:"pi",terminal,generation,at:Date.now(),...payload}),{encoding:"utf8",mode:0o600});
      renameSync(temp,file);
    } catch { /* Expired records never authorize actions. */ }
  }
  pi.on("session_start",(_event,ctx)=>{
    cleanup();
    if(ctx?.hasUI!==true) return;
    try { mkdirSync(directory,{recursive:true,mode:0o700}); } catch { return; }
    generation=randomUUID(); temp=join(directory,terminal+"."+generation+".tmp"); current=ctx;
    publish(); timer=setInterval(publish,1000); timer.unref?.();
  });
  // Pi 1.x replaces the extension runtime on new/resume/fork/reload.
  pi.on("session_shutdown",cleanup);
}
