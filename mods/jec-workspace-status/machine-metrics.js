// v0.6: read-only, fixed commands; no external agent or installation.
export const LINUX_SCRIPT = "export LC_ALL=C\n[ -r /proc/stat ] && [ -r /proc/meminfo ] || exit 42\ncpu_sample() {\n  awk '/^cpu / { total=0; for(i=2;i<=9;i++) total+=$i; print total, $5+$6; exit }' /proc/stat\n}\na=$(cpu_sample)\nsleep 1\nb=$(cpu_sample)\ncpu=$(awk -v a=\"$a\" -v b=\"$b\" 'BEGIN {split(a,x,\" \");split(b,y,\" \");d=y[1]-x[1];if(d>0 && y[2]>=x[2] && y[2]-x[2]<=d) printf \"%.1f\",100*(d-y[2]+x[2])/d}')\nmem=$(awk '/^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2;ok=1} END {if(t>0 && ok && a>=0 && a<=t) printf \"%.0f %.0f\", (t-a)*1024,t*1024}' /proc/meminfo)\ndisk=$(df -Pk / 2>/dev/null | awk 'NR==2 && $2>0 {printf \"%.0f %.0f\",$3*1024,$2*1024}')\ntemp=\"\"\n# Only sensors explicitly identifying CPU/package temperature.\nfor z in /sys/class/thermal/thermal_zone*; do\n  [ -r \"$z/type\" ] && [ -r \"$z/temp\" ] || continue\n  type=$(cat \"$z/type\" 2>/dev/null)\n  case \"$type\" in cpu*|CPU*|x86_pkg_temp|soc_thermal|soc-thermal|bcm2835_thermal)\n    temp=$(awk 'NR==1 && $1 ~ /^-?[0-9]+$/ && $1>=-40000 && $1<=150000 {printf \"%.1f\",$1/1000}' \"$z/temp\" 2>/dev/null)\n    [ -n \"$temp\" ] && break ;;\n  esac\ndone\nif [ -z \"$temp\" ]; then\n  for l in /sys/class/hwmon/hwmon*/temp*_label; do\n    [ -r \"$l\" ] || continue\n    case \"$(cat \"$l\" 2>/dev/null)\" in \"Package id \"*|Tdie|\"CPU Temp\")\n      temp=$(awk 'NR==1 && $1 ~ /^-?[0-9]+$/ && $1>=-40000 && $1<=150000 {printf \"%.1f\",$1/1000}' \"${l%_label}_input\" 2>/dev/null)\n      [ -n \"$temp\" ] && break ;;\n    esac\n  done\nfi\nprintf 'JEC_METRICS_V1\\ncpu=%s\\nmem=%s\\ndisk=%s\\ntemp=%s\\n' \"$cpu\" \"$mem\" \"$disk\" \"$temp\"";
export const WINDOWS_SCRIPT = "$ErrorActionPreference='Stop'\n$c=[Globalization.CultureInfo]::InvariantCulture\nfunction Num($v) { if ($null -eq $v) { return '' }; return ([double]$v).ToString('0.###',$c) }\n$cpu=''; $mem=''; $disk=''\ntry { $p=Get-CimInstance Win32_Processor | Where-Object { $null -ne $_.LoadPercentage }; if ($p) { $cpu=Num (($p | Measure-Object -Property LoadPercentage -Average).Average) } } catch {}\ntry { $o=Get-CimInstance Win32_OperatingSystem; if ($o.TotalVisibleMemorySize -gt 0 -and $null -ne $o.FreePhysicalMemory) { $mem=(Num (($o.TotalVisibleMemorySize-$o.FreePhysicalMemory)*1024))+' '+(Num ($o.TotalVisibleMemorySize*1024)) } } catch {}\ntry { $d=Get-CimInstance Win32_LogicalDisk -Filter (\"DeviceID='\"+$env:SystemDrive+\"'\"); if ($d.Size -gt 0 -and $null -ne $d.FreeSpace) { $disk=(Num ($d.Size-$d.FreeSpace))+' '+(Num $d.Size) } } catch {}\n'JEC_METRICS_V1'\n'cpu='+$cpu\n'mem='+$mem\n'disk='+$disk\n'temp='";
export const REFRESH_MS = 15000;
export const RETRY_MS = 60000;
export const STALE_MS = 45000;
const num = value => typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
function pair(raw) {
  const p = (raw ?? "").trim().split(/\s+/).map(num);
  if (p.length !== 2 || p.some(v => v === null) || p[1] <= 0 || p[0] < 0 || p[0] > p[1]) return null;
  return { used: p[0], total: p[1], percent: 100 * p[0] / p[1] };
}
export function parseMetrics(stdout) {
  const lines = String(stdout ?? "").replace(/^\uFEFF/,"").split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === "JEC_METRICS_V1");
  if (start < 0) return null;
  const fields = {};
  for (const line of lines.slice(start+1)) {
    const m = /^(cpu|mem|disk|temp)=(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2].trim();
  }
  const cpu = num(fields.cpu), temp = num(fields.temp);
  const result = { cpu: cpu !== null && cpu >= 0 && cpu <= 100 ? cpu : null,
    ram: pair(fields.mem), disk: pair(fields.disk), temp: temp !== null && temp >= -40 && temp <= 150 ? temp : null };
  return Object.values(result).some(v => v !== null) ? result : null;
}
export async function probe(exec, on, preferred) {
  const order = preferred === "windows" ? ["windows"] : preferred === "linux" ? ["linux"] : ["linux","windows"];
  for (const platform of order) {
    try {
      const r = platform === "linux"
        ? await exec("sh", ["-c",LINUX_SCRIPT], {on,timeout:8000})
        : await exec("powershell.exe", ["-NoLogo","-NoProfile","-NonInteractive","-Command",WINDOWS_SCRIPT], {on,timeout:12000});
      const data = r.code === 0 ? parseMetrics(r.stdout) : null;
      if (data) return {platform,data};
    } catch {}
  }
  return null;
}
const pct = n => n === null || n === undefined ? "—" : Math.round(n)+"%";
const gib = n => (n / 1073741824).toFixed(1)+" GiB";
export function describeMetrics(entry, now, name) {
  if (!entry?.data || now-entry.at > STALE_MS) {
    const state = entry?.failed ? "Metrics unavailable" : "Metrics pending";
    return {text:state, hint:name+" · "+state+" · No current sample", available:false};
  }
  const d=entry.data;
  const text = "CPU "+pct(d.cpu)+" · RAM "+pct(d.ram?.percent)+" · Disk "+pct(d.disk?.percent)+(d.temp===null?"":" · "+Math.round(d.temp)+"°C");
  const detail = (label,p) => p ? label+" "+gib(p.used)+" / "+gib(p.total) : label+" unavailable";
  return {text, hint:[name, "CPU "+pct(d.cpu), detail("RAM",d.ram), detail(entry.platform==="windows"?"System drive":"Root /",d.disk), d.temp===null?"CPU temperature unavailable":"CPU temperature "+d.temp.toFixed(1)+"°C", "Sample "+Math.max(0,Math.floor((now-entry.at)/1000))+"s ago"].join(" · "),available:true};
}
