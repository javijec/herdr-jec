export const SNAPSHOT_SCHEMA = "gentle-herdr-bridge/v1";
export const SNAPSHOT_MAX_AGE_MS = 60_000;
const LIVE_AGENT_STATUSES = new Set(["queued", "running", "waiting", "completed", "failed", "cancelled", "timed_out"]);
const SAFE_AGENT_TASK_ID = /^[a-z0-9_-]{1,128}$/i;

export function combineModelEffort(model, effort) {
  const combined = [safeText(model, 1000), safeText(effort, 1000)].filter(Boolean).join(" · ");
  return combined || undefined;
}

export function normalizeGentleAgentTasks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((task) => {
    if (!isRecord(task) || typeof task.id !== "string" || !SAFE_AGENT_TASK_ID.test(task.id) || !LIVE_AGENT_STATUSES.has(task.status)) return [];
    const label = safeText(task.label, 500);
    return [{ id: task.id, status: task.status, ...(label ? { label } : {}) }];
  });
}

export function isSectionExpanded(collapsedSections, sectionId) {
  return !(collapsedSections instanceof Set && collapsedSections.has(sectionId));
}

export function resolveSectionChildren(expanded, buildChildren) {
  if (!expanded || typeof buildChildren !== "function") return [];
  const children = buildChildren();
  return Array.isArray(children) ? children.filter(Boolean) : [];
}

export function toggleCollapsedSection(collapsedSections, sectionId) {
  const next = new Set(collapsedSections instanceof Set ? collapsedSections : []);
  if (next.has(sectionId)) next.delete(sectionId);
  else next.add(sectionId);
  return next;
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeText(value, maxLength = 500) {
  if (typeof value !== "string" || !Number.isSafeInteger(maxLength) || maxLength < 1) return undefined;
  const cleaned = value
    .replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function nonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function retainHerdrAgentSnapshot(previous, value, scope) {
  if (value === undefined) return Array.isArray(previous) ? previous : [];
  return normalizeHerdrAgents(value, scope);
}

export function agentProgressNotice() {
  return "The live Gentle Agents task progress is unavailable.";
}

export function normalizeHerdrAgents(value, scope) {
  if (!Array.isArray(value) || !isRecord(scope) || typeof scope.space !== "string" || typeof scope.tab !== "string") return [];
  const allowedStates = new Set(["working", "blocked", "done", "idle"]);
  const output = [];
  for (const agent of value.slice(0, 200)) {
    if (!isRecord(agent) || agent.space !== scope.space || agent.tab !== scope.tab || !allowedStates.has(agent.status)) continue;
    const program = isRecord(agent.program) ? agent.program : {};
    const name = safeText(program.name, 100) ?? safeText(agent.title, 100);
    if (!name) continue;
    const app = safeText(agent.app, 100);
    if (name.toLowerCase() === "gentle-shell" && app?.toLowerCase() === "gentle-shell") continue;
    output.push({ name, status: agent.status, ...(app ? { app } : {}) });
  }
  return output;
}

export function previewTodos(items, expanded = false) {
  if (!Array.isArray(items)) return [];
  const valid = items.filter((item) => isRecord(item) && ["pending", "in_progress", "blocked", "done", "dropped"].includes(item.state));
  if (expanded) return valid;
  const next = valid.find((item) => item.state === "pending") ?? valid.find((item) => item.state === "in_progress");
  return next ? [next] : [];
}

export function runningJobs(value) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((job) => isRecord(job)
    && Boolean(safeText(job.id, 200))
    && nonNegative(job.startedAt) !== undefined
    && job.status === undefined
    && job.endedAt === undefined
    && (job.state === undefined || job.state === "running"));
}

function normalizedPath(value) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const raw = value;
  const windowsPath = /^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("\\\\");
  let normalized = raw.replace(/[\\/]+/g, "/");
  if (raw.startsWith("\\\\") && normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  if (windowsPath) normalized = normalized.toLowerCase();
  return normalized;
}

export function sameDirectory(left, right) {
  const a = normalizedPath(left);
  const b = normalizedPath(right);
  return Boolean(a && b && a === b);
}

function normalizeSnapshot(value) {
  if (!isRecord(value) || value.schema !== SNAPSHOT_SCHEMA || !isRecord(value.status)) return undefined;
  const sessionId = safeText(value.sessionId, 256);
  const cwd = typeof value.cwd === "string" && value.cwd.length <= 4096 && value.cwd.length > 0
    && !/[\u0000-\u001f\u007f]/.test(value.cwd) ? value.cwd : undefined;
  const updatedAt = safeText(value.updatedAt, 64);
  if (!sessionId || !cwd || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) return undefined;
  const normalized = { schema: SNAPSHOT_SCHEMA, sessionId, cwd, updatedAt, status: value.status };
  const branch = safeText(value.branch, 500);
  if (branch) normalized.branch = branch;
  return normalized;
}

export function selectSnapshot(snapshots, cwd, now = Date.now()) {
  if (!Array.isArray(snapshots) || !Number.isFinite(now) || typeof cwd !== "string") return null;
  const targetPath = normalizedPath(cwd);
  if (!targetPath) return null;
  const candidates = snapshots.map(normalizeSnapshot).filter((snapshot) => {
    if (!snapshot || normalizedPath(snapshot.cwd) !== targetPath) return false;
    const age = now - Date.parse(snapshot.updatedAt);
    return age >= 0 && age <= SNAPSHOT_MAX_AGE_MS;
  });
  candidates.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.sessionId.localeCompare(b.sessionId));
  return candidates[0] ?? null;
}

export function retainFreshSnapshot(previous, next, cwd, now = Date.now()) {
  return next ?? selectSnapshot(previous ? [previous] : [], cwd, now);
}

export function percentTone(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return undefined;
  if (value >= 95) return "danger";
  if (value >= 80) return "warning";
  return "normal";
}

export function formatPercent(value) {
  if (percentTone(value) === undefined) return undefined;
  return `${Math.round(value)}%`;
}

export function contextProgressBar(value) {
  const tone = percentTone(value);
  if (tone === undefined) return undefined;
  return { width: Math.round(90 * value / 100), label: formatPercent(value), tone };
}
