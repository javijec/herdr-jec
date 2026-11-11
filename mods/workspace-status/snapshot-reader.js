import { exec, home, readTextFile } from "herdr";
import { selectWorkspaceSnapshot, sameDirectory } from "./model.js";

const PRESENCE_LIMIT = 64;
const MAX_ACTIVE_AGE_MS = 60_000;
const MAX_SNAPSHOT_BYTES = 1024 * 1024;
const SNAPSHOT_NAME = /^session-[A-Za-z0-9_-]+\.json$/;
const PRESENCE_NAME = /^presence-[A-Za-z0-9_-]+\.json$/;

function joinPath(directory, name) {
  const trimmed = String(directory).replace(/[\\/]+$/, "");
  const separator = String(directory).includes("\\") && !String(directory).includes("/") ? "\\" : "/";
  return `${trimmed}${trimmed.endsWith(":") && separator === "\\" ? "\\" : separator}${name}`;
}

function absolutePath(value) {
  return typeof value === "string" && /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(value);
}

function shellQuotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function shellOutput(target, command, args) {
  const result = await exec(command, args, { on: target.machine, cwd: target.cwd || undefined });
  if (result.code !== 0) throw new Error("Unable to inspect the bridge directory");
  return result.stdout.trim();
}

async function bridgeDirectory(target) {
  const sh = 'if [ -n "$GENTLE_HERDR_DIR" ]; then printf "%s\\n" "$GENTLE_HERDR_DIR"; else printf "%s/.gentle-herdr\\n" "$HOME"; fi';
  try {
    const directory = await shellOutput(target, "sh", ["-c", sh]);
    if (absolutePath(directory)) return directory;
  } catch {}

  const ps = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); if ($env:GENTLE_HERDR_DIR) { [IO.Path]::GetFullPath($env:GENTLE_HERDR_DIR) } else { Join-Path $HOME '.gentle-herdr' }";
  try {
    const directory = await shellOutput(target, "powershell", ["-NoProfile", "-Command", ps]);
    if (absolutePath(directory)) return directory;
  } catch {}

  if (!target.machine) return joinPath(home(), ".gentle-herdr");
  throw new Error("Cannot resolve the remote bridge directory");
}

async function listPresenceNames(target, directory) {
  const script = `& { param([string]$d) $items = @(Get-ChildItem -LiteralPath $d -File -Filter 'presence-*.json' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First ${PRESENCE_LIMIT} -ExpandProperty Name); ConvertTo-Json -InputObject $items -Compress } ${shellQuotePowerShell(directory)}`;
  try {
    const output = await shellOutput(target, "powershell", ["-NoProfile", "-Command", script]);
    const names = JSON.parse(output || "[]");
    return Array.isArray(names) ? names.filter((name) => typeof name === "string" && PRESENCE_NAME.test(name)) : [];
  } catch {
    const sh = 'ls -1t "$1"/presence-*.json 2>/dev/null | head -n "$2" | while IFS= read -r p; do printf "%s\\n" "${p##*/}"; done';
    const output = await shellOutput(target, "sh", ["-c", sh, "workspace-status", directory, String(PRESENCE_LIMIT)]);
    return output.split(/\r?\n/).filter((name) => PRESENCE_NAME.test(name));
  }
}

export async function readWorkspaceSnapshot(target, now = Date.now()) {
  if (!target || typeof target.cwd !== "string" || target.cwd.length === 0 || !Number.isFinite(now)) return undefined;
  const directory = await bridgeDirectory(target);
  const names = await listPresenceNames(target, directory);
  const records = await Promise.all(names.map(async (name) => {
    try {
      const raw = await readTextFile(joinPath(directory, name), { on: target.machine });
      if (typeof raw !== "string" || raw.length > 16_384) return undefined;
      const presence = JSON.parse(raw);
      if (!presence || typeof presence !== "object" || Array.isArray(presence)
        || typeof presence.sessionId !== "string" || !presence.sessionId || typeof presence.cwd !== "string") return undefined;
      if (!sameDirectory(presence.cwd, target.cwd)) return undefined;
      const updatedAt = Date.parse(presence.updatedAt);
      const age = now - updatedAt;
      if (!Number.isFinite(updatedAt) || age < 0 || age > MAX_ACTIVE_AGE_MS) return undefined;
      const snapshotName = name.replace(/^presence-/, "session-");
      if (!SNAPSHOT_NAME.test(snapshotName)) return undefined;
      return { name: snapshotName, sessionId: presence.sessionId, cwd: presence.cwd, updatedAt, updatedAtText: presence.updatedAt };
    } catch {
      return undefined;
    }
  }));

  const current = records.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const snapshots = await Promise.all(current.map(async (record) => {
    try {
      const raw = await readTextFile(joinPath(directory, record.name), { on: target.machine });
      if (typeof raw !== "string" || raw.length > MAX_SNAPSHOT_BYTES) return undefined;
      const snapshot = JSON.parse(raw);
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)
        || snapshot.sessionId !== record.sessionId || snapshot.updatedAt !== record.updatedAtText
        || !sameDirectory(snapshot.cwd, record.cwd)) return undefined;
      return snapshot;
    } catch {
      return undefined;
    }
  }));
  return selectWorkspaceSnapshot(snapshots.filter(Boolean), target.cwd, now);
}
