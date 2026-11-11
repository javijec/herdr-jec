export const SNAPSHOT_SCHEMA = "gentle-herdr-bridge/v1";
export const SNAPSHOT_MAX_AGE_MS = 60_000;

function isRecord(value) {
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

function normalizedPath(value) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const windowsPath = /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
  let normalized = value.replace(/[\\/]+/g, "/");
  if (value.startsWith("\\\\") && normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1) normalized = normalized.replace(/\/$/, "");
  return windowsPath ? normalized.toLowerCase() : normalized;
}

export function sameDirectory(left, right) {
  const a = normalizedPath(left);
  const b = normalizedPath(right);
  return Boolean(a && b && a === b);
}

function normalizeSnapshot(value) {
  if (!isRecord(value) || value.schema !== SNAPSHOT_SCHEMA || !isRecord(value.status)) return undefined;
  const sessionId = safeText(value.sessionId, 256);
  const cwd = typeof value.cwd === "string" && value.cwd.length > 0 && value.cwd.length <= 4096
    && !/[\u0000-\u001f\u007f]/.test(value.cwd) ? value.cwd : undefined;
  const updatedAt = safeText(value.updatedAt, 64);
  if (!sessionId || !cwd || !updatedAt || !Number.isFinite(Date.parse(updatedAt))) return undefined;
  return { value, cwd, updatedAt: Date.parse(updatedAt), sessionId };
}

export function selectWorkspaceSnapshot(snapshots, cwd, now = Date.now()) {
  if (!Array.isArray(snapshots) || !Number.isFinite(now) || typeof cwd !== "string") return undefined;
  const targetPath = normalizedPath(cwd);
  if (!targetPath) return undefined;
  return snapshots.map(normalizeSnapshot).filter((snapshot) => {
    if (!snapshot || normalizedPath(snapshot.cwd) !== targetPath) return false;
    const age = now - snapshot.updatedAt;
    return age >= 0 && age <= SNAPSHOT_MAX_AGE_MS;
  }).sort((a, b) => b.updatedAt - a.updatedAt || a.sessionId.localeCompare(b.sessionId))[0]?.value;
}

export function footerTelemetry(snapshot) {
  if (!isRecord(snapshot?.status)) return undefined;
  const status = snapshot.status;
  const model = [safeText(status.model, 120), safeText(status.effort, 60)].filter(Boolean).join(" · ") || undefined;
  const pct = status.context?.pct;
  const contextPct = typeof pct === "number" && Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : undefined;
  if (!model && contextPct === undefined) return undefined;
  return { ...(model ? { model } : {}), ...(contextPct === undefined ? {} : { contextPct }) };
}
