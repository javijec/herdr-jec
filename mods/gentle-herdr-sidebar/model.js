export const SNAPSHOT_SCHEMA = "gentle-herdr-bridge/v1";
export const SNAPSHOT_MAX_AGE_MS = 60_000;
export const AGENT_PROGRESS_NOTICE = "Herdr-reported terminal status and recent finished task history only; live Gentle Agents task progress is unavailable.";
export function agentProgressNotice() { return AGENT_PROGRESS_NOTICE; }
export function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function safeText(value, maxLength = 500) {
  if (typeof value !== "string" || !Number.isSafeInteger(maxLength) || maxLength < 1) return undefined;
  const cleaned = value.replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}
export function nonNegative(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined; }
export function normalizeHerdrAgents(value, scope) {
  if (!Array.isArray(value) || !isRecord(scope) || typeof scope.space !== "string" || typeof scope.tab !== "string") return [];
  const allowed = new Set(["working", "blocked", "done", "idle"]); const output = [];
  for (const agent of value.slice(0, 200)) {
    if (!isRecord(agent) || agent.space !== scope.space || agent.tab !== scope.tab || !allowed.has(agent.status)) continue;
    const program = isRecord(agent.program) ? agent.program : {};
    const name = safeText(program.name, 100) ?? safeText(agent.title, 100); if (!name) continue;
    const app = safeText(agent.app, 100); output.push({ name, status: agent.status, ...(app ? { app } : {}) });
  }
  return output;
}
export function previewTodos(items, expanded = false) {
  if (!Array.isArray(items)) return [];
  const valid = items.filter((item) => isRecord(item) && ["pending", "in_progress", "blocked", "done", "dropped"].includes(item.state));
  if (expanded) return valid.slice(0, 3);
  const next = valid.find((item) => item.state === "pending") ?? valid.find((item) => item.state === "in_progress"); return next ? [next] : [];
}
export function runningJobs(value) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((job) => isRecord(job) && Boolean(safeText(job.id, 200)) && nonNegative(job.startedAt) !== undefined && job.status === undefined && job.endedAt === undefined && (job.state === undefined || job.state === "running"));
}
function normalizedPath(value) {
  if (typeof value !== "string" || !value) return undefined;
  const windows = /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\"); let result = value.replace(/[\\/]+/g, "/");
  if (value.startsWith("\\\\") && result.startsWith("/")) result = `/${result}`;
  if (result.length > 1) result = result.replace(/\/$/, ""); return windows ? result.toLowerCase() : result;
}
export function sameDirectory(left, right) { const a = normalizedPath(left), b = normalizedPath(right); return Boolean(a && b && a === b); }
function normalizeSnapshot(value) {
  if (!isRecord(value) || value.schema !== SNAPSHOT_SCHEMA || !isRecord(value.status)) return undefined;
  const sessionId = safeText(value.sessionId, 256), cwd = typeof value.cwd === "string" && value.cwd.length > 0 && value.cwd.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(value.cwd) ? value.cwd : undefined;
  const updatedAt = safeText(value.updatedAt, 64); if (!sessionId || !cwd || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) return undefined;
  const normalized = { schema: SNAPSHOT_SCHEMA, sessionId, cwd, updatedAt, status: value.status }; const branch = safeText(value.branch, 500); if (branch) normalized.branch = branch; return normalized;
}
export function selectSnapshot(snapshots, cwd, now = Date.now()) {
  if (!Array.isArray(snapshots) || !Number.isFinite(now) || typeof cwd !== "string") return null;
  const target = normalizedPath(cwd); if (!target) return null;
  return snapshots.map(normalizeSnapshot).filter((item) => {
    if (!item || normalizedPath(item.cwd) !== target) return false; const age = now - Date.parse(item.updatedAt); return age >= 0 && age <= SNAPSHOT_MAX_AGE_MS;
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.sessionId.localeCompare(b.sessionId))[0] ?? null;
}
export function percentTone(value) { if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return undefined; if (value >= 95) return "danger"; if (value >= 80) return "warning"; return "normal"; }
export function formatPercent(value) { return percentTone(value) === undefined ? undefined : `${Math.round(value)}%`; }
