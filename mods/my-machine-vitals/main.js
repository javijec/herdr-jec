// Read-only metrics, restricted to this Windows computer and the explicitly authorised javipi.
import { View, div } from 'gpui-kit';
import { v_flex, h_flex } from 'gpui-base';
import { exec, theme, layout, window } from 'herdr';
import { parseMetrics, gb } from './metrics.js';

const MACHINES = [{ id: 'local', label: 'This computer', on: null }, { id: 'javipi', label: 'javipi', on: 'javipi' }];
const WINDOWS = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding $false; $os=Get-CimInstance Win32_OperatingSystem; $cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; if($null -eq $cpu){throw 'Metrics unavailable'}; @{cpu=[double]$cpu;memUsed=([double]$os.TotalVisibleMemorySize-[double]$os.FreePhysicalMemory)*1024;memTotal=[double]$os.TotalVisibleMemorySize*1024} | ConvertTo-Json -Compress`;
const LINUX = `export LC_ALL=C; a=$(awk '/^cpu / {t=0; for(i=2;i<=9 && i<=NF;i++)t+=$i; print t,$5+$6; exit}' /proc/stat); sleep 1; b=$(awk '/^cpu / {t=0; for(i=2;i<=9 && i<=NF;i++)t+=$i; print t,$5+$6; exit}' /proc/stat); set -- $a $b; cpu=$(awk -v a="$1" -v b="$2" -v c="$3" -v d="$4" 'BEGIN { if(c<=a) exit 1; printf "%.2f", 100*(1-(d-b)/(c-a)) }') || exit 1; mem=$(awk '/^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2} END {if(!t || !a) exit 1; printf "%.0f %.0f",(t-a)*1024,t*1024}' /proc/meminfo) || exit 1; set -- $mem; [ "$#" -eq 2 ] || exit 1; printf '{"cpu":%s,"memUsed":%s,"memTotal":%s}\\n' "$cpu" "$1" "$2"`;
function find(n,id) { if(n?.id===id)return n; for(const c of n?.children??[]){const r=find(c,id);if(r)return r;} return null; }
export default class MachineVitals extends View {
 init(_props,cx) { this.state={}; this.busy={}; this.last=0; this.sample(cx); cx.timer.every(10000,(cx)=>{ if(Date.now()-this.last >= (window().active ? 10000 : 30000)-100) this.sample(cx); }); }
 sample(cx) {
  this.last=Date.now();
  for(const machine of MACHINES) {
   if(this.busy[machine.id]) continue;
   this.busy[machine.id]=true;
   cx.spawn(async(cx)=>{
    try {
      const result=machine.on ? await exec('sh',['-c',LINUX],{on:machine.on}) : await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',WINDOWS],{});
      const data=result.code===0 ? parseMetrics(result.stdout) : null;
      this.state[machine.id]=data ? {data} : {error:'Unavailable'};
    } catch { this.state[machine.id]={error:'Unavailable'}; }
    finally { this.busy[machine.id]=false; cx.notify(); }
   });
  }
 }
 render() {
  const t=theme(); const narrow=(find(layout(),'sidebar')?.size?.px ?? 240)<160;
  const color=p=>p>=95?t.ansi1:p>=85?t.ansi3:t.accent;
  const line=(label,value,pct)=>h_flex().h(17).gap(6).items_center().child(div().w(29).flex_none().text_size(10).text_color(t.dim).child(label)).child(div().flex_1().h(4).rounded(2).bg(t.border).overflow_hidden().child(div().h_full().w(`${Math.max(0,Math.min(100,pct))}%`).bg(color(pct)))).child(div().w(82).flex_none().text_right().text_size(10.5).text_color(t.foreground).child(value));
  const compactMetric=(label,pct)=>h_flex().h(14).w_full().flex_none().items_center().justify_between().overflow_hidden().child(div().flex_none().text_size(7).text_color(t.dim).child(label)).child(div().flex_none().text_size(8).text_color(color(pct)).child(`${Math.round(pct)}%`));
  return v_flex().id('my-machine-vitals').size_full().bg(t.chrome).border_t(1).border_b(1).border_color(t.border).px(narrow?4:12).py(4).children(MACHINES.map(m=>{const s=this.state[m.id];const d=s?.data;const mp=d?100*d.memUsed/d.memTotal:0;return v_flex().flex_1().min_h(0).child(h_flex().h(narrow?16:20).items_center().child(div().flex_1().min_w(0).truncate().text_size(narrow?9:11).font_semibold().text_color(t.muted).child(narrow?(m.on?m.label:'Local'):m.label)).when(!d,e=>e.child(div().text_size(10).text_color(s?.error?t.ansi1:t.dim).child(s?.error?(narrow?'!':'Offline'):'…')))).when(Boolean(d),e=>narrow?e.child(compactMetric('CPU',d.cpu)).child(compactMetric('MEM',mp)):e.child(line('CPU',`${Math.round(d.cpu)}%`,d.cpu)).child(line('Mem',`${gb(d.memUsed)}/${gb(d.memTotal)} GB`,mp))); }));
 }
}
