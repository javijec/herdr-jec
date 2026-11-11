import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const TODO_STATUSES = new Set(["pending", "in_progress", "blocked", "done", "dropped"]);
const FINISHED_TASKS = new Set(["completed", "failed", "cancelled", "timed_out"]);
const ACTIVE_AGENT_STATUSES = new Set(["queued", "running", "waiting"]);
const LIVE_AGENT_STATUSES = new Set([...ACTIVE_AGENT_STATUSES, "completed", "failed", "cancelled", "timed_out"]);
const SAFE_TASK_ID = /^[a-z0-9_-]{1,128}$/i;
// Read one bounded private history file at a time; threads can approach their configured item/output limits.
const HISTORY_MAX_BYTES = 16 * 1024 * 1024;
const MAX_HISTORY_FILES = 200;
const FINISHED_TTL_MS = 5 * 60_000;
const VISIBLE_FINISHED_LIMIT = 3;

function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeText(value, maxLength = 1000) {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, maxLength);
}

function normalizedTodo(value) {
  if (!record(value) || !Array.isArray(value.tasks) || value.tasks.length > 500) return undefined;
  const tasks = [];
  for (const task of value.tasks) {
    if (!record(task)) return undefined;
    const title = safeText(task.title);
    if (!Number.isSafeInteger(task.id) || task.id <= 0 || !title || !TODO_STATUSES.has(task.status)) return undefined;
    if (task.note !== undefined && typeof task.note !== "string") return undefined;
    const note = typeof task.note === "string" ? safeText(task.note) : undefined;
    tasks.push({ id: task.id, title, status: task.status, ...(note ? { note } : {}) });
  }
  const updatedTurn = value.updatedTurn === null || value.updatedTurn === undefined ? null : nonNegativeNumber(value.updatedTurn);
  if (value.updatedTurn !== null && value.updatedTurn !== undefined && updatedTurn === undefined) return undefined;
  return { tasks, updatedTurn };
}

export function countUserMessages(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.filter((entry) => entry?.type === "message" && entry.message?.role === "user").length;
}

function legacyTodo(details) {
  if (!Array.isArray(details.tasks) || details.tasks.length > 500) return undefined;
  const aliases = { completed: "done", complete: "done", doing: "in_progress", todo: "pending", cancelled: "dropped", canceled: "dropped", abandoned: "dropped" };
  const tasks = [];
  for (const task of details.tasks) {
    if (!record(task) || task.status === "deleted" || !Number.isSafeInteger(task.id) || task.id <= 0) continue;
    const status = task.status === undefined || task.status === null || task.status === "" ? "pending" : aliases[task.status] ?? task.status;
    const title = safeText(task.subject);
    if (!title || !TODO_STATUSES.has(status)) continue;
    const note = status === "in_progress" ? safeText(task.activeForm) : undefined;
    tasks.push({ id: task.id, title, status, ...(note ? { note } : {}) });
  }
  return { tasks, updatedTurn: null };
}

export function extractTodos(entries, currentTurn) {
  if (!Array.isArray(entries)) return undefined;
  let state;
  for (const entry of entries) {
    const message = entry?.type === "message" ? entry.message : undefined;
    if (message?.role !== "toolResult" || message.toolName !== "todo" || message.isError === true) continue;
    const details = message.details;
    if (!record(details)) continue;
    const next = normalizedTodo(details.gentleTodo) ?? legacyTodo(details);
    if (next) state = next;
  }
  if (!state) return undefined;

  const actionable = state.tasks.some((task) => task.status === "pending" || task.status === "in_progress");
  let staleTurns;
  if (state.updatedTurn === null || !actionable) staleTurns = 0;
  else if (Number.isSafeInteger(currentTurn) && currentTurn >= 0) staleTurns = Math.max(0, currentTurn - state.updatedTurn);
  return {
    items: state.tasks.map((task) => ({ id: task.id, text: task.title, state: task.status, ...(task.note ? { note: task.note } : {}) })),
    ...(staleTurns === undefined ? {} : { staleTurns }),
  };
}

function finishedTask(task, sessionId, now) {
  if (!record(task) || task.parentSessionId !== sessionId || !SAFE_TASK_ID.test(task.id ?? "")) return undefined;
  const agent = safeText(task.agent, 200);
  const label = safeText(task.label, 500);
  if (!FINISHED_TASKS.has(task.status) || !agent || !label) return undefined;
  const endedAt = nonNegativeNumber(task.endedAt);
  if (endedAt === undefined || now - endedAt < 0 || now - endedAt > FINISHED_TTL_MS) return undefined;
  const item = {
    id: task.id,
    agent,
    label,
    state: task.status === "completed" ? "done" : task.status === "cancelled" ? "aborted" : "failed",
  };
  const model = safeText(task.model, 200);
  if (model) item.model = model;
  const tokens = nonNegativeNumber(task.tokens);
  if (tokens !== undefined) item.tokens = tokens;
  const costUsd = nonNegativeNumber(task.cost);
  if (costUsd !== undefined) item.costUsd = costUsd;
  const startedAt = nonNegativeNumber(task.startedAt);
  if (startedAt !== undefined && endedAt >= startedAt) item.elapsedMs = endedAt - startedAt;
  return { item, endedAt, createdAt: nonNegativeNumber(task.createdAt) ?? endedAt };
}

/** Read the current private Gentle Agents history format defensively; thread and prompt data never leave this function. */
export async function readAgentHistory(directory, sessionId, now = Date.now()) {
  if (typeof directory !== "string" || directory.length === 0 || typeof sessionId !== "string" || sessionId.length === 0 || !Number.isFinite(now)) {
    throw new TypeError("directory, sessionId, and finite now are required");
  }
  let names;
  try {
    names = await readdir(directory);
  } catch {
    return { items: [], liveAvailable: false, historyAvailable: false };
  }

  const taskFiles = names.filter((name) => SAFE_TASK_ID.test(name.replace(/\.json$/i, "")) && name.endsWith(".json"));
  const boundedTaskFiles = taskFiles.slice(0, MAX_HISTORY_FILES);
  const sessionTasks = [];
  let historyPartial = taskFiles.length > boundedTaskFiles.length;
  for (const name of boundedTaskFiles) {
    const filePath = path.join(directory, name);
    try {
      const info = await lstat(filePath);
      if (!info.isFile() || info.size > HISTORY_MAX_BYTES) {
        historyPartial = true;
        continue;
      }
      const parsed = JSON.parse(await readFile(filePath, "utf8"));
      const task = record(parsed) ? parsed.task : undefined;
      if (!record(task) || task.parentSessionId !== sessionId || !SAFE_TASK_ID.test(task.id ?? "")) continue;
      const finished = FINISHED_TASKS.has(task.status);
      const tokens = finished ? nonNegativeNumber(task.tokens) : undefined;
      const cost = finished ? nonNegativeNumber(task.cost) : undefined;
      const endedAt = nonNegativeNumber(task.endedAt);
      const cwd = typeof task.cwd === "string" && task.cwd.length > 0 && task.cwd.length <= 4096 && !task.cwd.includes("\0") ? task.cwd : undefined;
      const visible = finishedTask(task, sessionId, now);
      if (finished && (tokens === undefined || cost === undefined || endedAt === undefined)) historyPartial = true;
      if (finished && endedAt !== undefined && now - endedAt >= 0 && now - endedAt <= FINISHED_TTL_MS && !visible) historyPartial = true;
      const label = ACTIVE_AGENT_STATUSES.has(task.status) ? safeText(task.label, 500) : undefined;
      sessionTasks.push({ id: task.id, finished, tokens, cost, cwd, visible, ...(label ? { liveLabel: label } : {}) });
    } catch {
      historyPartial = true;
    }
  }

  const completed = sessionTasks.filter((entry) => entry.finished);
  const visible = completed.filter((entry) => entry.visible)
    .sort((a, b) => b.visible.endedAt - a.visible.endedAt || b.visible.createdAt - a.visible.createdAt)
    .slice(0, VISIBLE_FINISHED_LIMIT)
    .map((entry) => entry.visible.item);
  return {
    items: visible,
    liveTasks: sessionTasks.flatMap((entry) => entry.liveLabel ? [{ id: entry.id, label: entry.liveLabel }] : []),
    liveAvailable: false,
    historyAvailable: true,
    ...(historyPartial ? { historyPartial: true } : {}),
    worktreeCwds: [...new Set(sessionTasks.flatMap((entry) => entry.cwd ? [entry.cwd] : []))],
    ...(!historyPartial ? { subagents: {
      runs: completed.length,
      tokens: completed.reduce((sum, entry) => sum + entry.tokens, 0),
      cost: completed.reduce((sum, entry) => sum + entry.cost, 0),
    } } : {}),
  };
}

function count(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function modelLabel(value) {
  if (typeof value !== "string") return "unknown";
  const cleaned = safeText(value, 500) ?? "";
  return cleaned.slice(cleaned.lastIndexOf("/") + 1) || "unknown";
}

export function parseJobsEvent(value, sessionId) {
  try {
    if (!record(value) || value.sessionId !== sessionId || !record(value.snapshot) || !Array.isArray(value.snapshot.jobs) || value.snapshot.jobs.length > 100) return undefined;
    const jobs = [];
    for (const job of value.snapshot.jobs) {
      if (!record(job) || typeof job.id !== "string" || job.id.length === 0 || job.id.length > 200 || typeof job.label !== "string" || job.label.length > 500 || !Number.isFinite(job.startedAt)) return undefined;
      if (job.status !== undefined && !["exited", "stopped", "failed"].includes(job.status)) return undefined;
      if (job.endedAt !== undefined && !Number.isFinite(job.endedAt)) return undefined;
      if (job.exitCode !== undefined && job.exitCode !== null && !Number.isFinite(job.exitCode)) return undefined;
      if (job.status === undefined) {
        const id = safeText(job.id, 200);
        const label = safeText(job.label, 500);
        if (!id) return undefined;
        jobs.push({ id, label: label ?? "", startedAt: job.startedAt });
      }
    }
    return jobs;
  } catch {
    return undefined;
  }
}

const FINISHED_AGENT_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"]);

export function parseGentleAgentStatusEvent(value, sessionId) {
  if (!record(value) || value.source !== "subagent" || value.sessionId !== sessionId || value.parentSessionId !== sessionId) return undefined;
  if (typeof value.taskId !== "string" || !SAFE_TASK_ID.test(value.taskId) || !LIVE_AGENT_STATUSES.has(value.status)) return undefined;
  if (value.event !== `subagent.${value.status}` || typeof value.producerId !== "string" || value.producerId.length === 0 || value.producerId.length > 512) return undefined;
  if (typeof value.runId !== "string" || value.runId.length === 0 || value.runId.length > 512
    || !Number.isSafeInteger(value.sequence) || value.sequence < 1 || typeof value.occurredAt !== "number" || !Number.isFinite(value.occurredAt) || value.occurredAt < 0) return undefined;
  return { id: value.taskId, status: value.status };
}

export function applyGentleAgentStatus(current, event) {
  if (!Array.isArray(current)) return [];
  if (!record(event) || typeof event.id !== "string" || !SAFE_TASK_ID.test(event.id) || !LIVE_AGENT_STATUSES.has(event.status)) return current;
  const next = current.filter((task) => task?.id !== event.id);
  if (FINISHED_AGENT_STATUSES.has(event.status)) return next;
  next.push({ id: event.id, status: event.status });
  return next.slice(-100);
}

const USAGE_PROVIDER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function parseUsageSource(value) {
  try {
    if (!record(value) || value.schema !== "gentle-pi.usage-source/v1" || typeof value.provider !== "string" || !USAGE_PROVIDER.test(value.provider) || typeof value.fetch !== "function") return undefined;
    if (value.pendingNote !== undefined && typeof value.pendingNote !== "string") return undefined;
    return { schema: value.schema, provider: value.provider, fetch: value.fetch, ...(typeof value.pendingNote === "string" ? { pendingNote: safeText(value.pendingNote, 500) } : {}) };
  } catch {
    return undefined;
  }
}

export function normalizeProviderUsage(value, expectedProvider) {
  if (typeof expectedProvider !== "string" || !record(value) || value.provider !== expectedProvider || !USAGE_PROVIDER.test(expectedProvider) || !Number.isFinite(value.fetchedAt) || !Array.isArray(value.limits) || value.limits.length > 100) return undefined;
  if (value.plan !== undefined && typeof value.plan !== "string") return undefined;
  const limits = [];
  for (const raw of value.limits) {
    if (!record(raw) || typeof raw.name !== "string" || typeof raw.limitReached !== "boolean" || !Array.isArray(raw.windows) || raw.windows.length > 20) return undefined;
    if (raw.scope !== undefined && raw.scope !== "provider") return undefined;
    const windows = [];
    for (const window of raw.windows) {
      if (!record(window) || typeof window.label !== "string" || !Number.isFinite(window.usedPercent) || !Number.isFinite(window.windowSeconds) || (window.resetAt !== null && !Number.isFinite(window.resetAt))) return undefined;
      if (window.used !== undefined && !Number.isFinite(window.used)) return undefined;
      if (window.budget !== undefined && !Number.isFinite(window.budget)) return undefined;
      windows.push({ label: safeText(window.label, 200), usedPercent: window.usedPercent, windowSeconds: window.windowSeconds, resetAt: window.resetAt,
        ...(window.used !== undefined ? { used: window.used } : {}), ...(window.budget !== undefined ? { budget: window.budget } : {}) });
    }
    limits.push({ name: safeText(raw.name, 200), limitReached: raw.limitReached, ...(raw.scope === "provider" ? { scope: "provider" } : {}), windows });
  }
  return { provider: expectedProvider, ...(typeof value.plan === "string" ? { plan: safeText(value.plan, 200) } : {}), limits, fetchedAt: value.fetchedAt };
}

export function collectSessionStats(entries, subagents) {
  const stats = {
    cost: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    turns: 0,
    toolCalls: 0,
    toolErrors: 0,
    spanMs: 0,
    models: [],
  };
  const models = new Map();
  let first = Infinity;
  let last = -Infinity;

  for (const entry of Array.isArray(entries) ? entries : []) {
    const at = typeof entry?.timestamp === "string" ? Date.parse(entry.timestamp) : count(entry?.timestamp) || Number.NaN;
    if (Number.isFinite(at)) {
      first = Math.min(first, at);
      last = Math.max(last, at);
    }
    if (entry?.type !== "message") continue;
    const message = entry.message;
    if (message?.role === "toolResult") {
      stats.toolCalls += 1;
      if (message.isError === true) stats.toolErrors += 1;
      continue;
    }
    if (message?.role !== "assistant") continue;
    const usage = message.usage ?? {};
    const input = count(usage.input);
    const output = count(usage.output);
    const cacheRead = count(usage.cacheRead);
    const cacheWrite = count(usage.cacheWrite);
    const cost = count(usage.cost?.total);
    stats.turns += 1;
    stats.input += input;
    stats.output += output;
    stats.cacheRead += cacheRead;
    stats.cacheWrite += cacheWrite;
    stats.cost += cost;
    const model = modelLabel(message.model);
    const current = models.get(model) ?? { model, turns: 0, tokens: 0, cost: 0 };
    current.turns += 1;
    current.tokens += input + output + cacheRead + cacheWrite;
    current.cost += cost;
    models.set(model, current);
  }

  const promptTokens = stats.input + stats.cacheRead + stats.cacheWrite;
  stats.cacheHitRate = promptTokens > 0 ? stats.cacheRead / promptTokens : undefined;
  stats.spanMs = last > first ? last - first : 0;
  stats.models = [...models.values()].sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
  if (subagents && Number.isFinite(subagents.runs) && Number.isFinite(subagents.tokens) && Number.isFinite(subagents.cost)) {
    stats.subagents = { runs: subagents.runs, tokens: subagents.tokens, cost: subagents.cost };
  }
  return stats;
}
