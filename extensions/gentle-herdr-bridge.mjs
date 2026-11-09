import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  collectSessionStats,
  countUserMessages,
  extractTodos,
  normalizeProviderUsage,
  applyGentleAgentStatus,
  parseGentleAgentStatusEvent,
  parseJobsEvent,
  parseUsageSource,
  readAgentHistory,
} from "../bridge/session-data.mjs";
import { readChanges } from "../bridge/changes.mjs";
import { buildSnapshot, publishSnapshot, removePresence } from "../bridge/snapshot.mjs";
import { emitHerdrStatus } from "../bridge/osc-status.mjs";

const execFileAsync = promisify(execFile);
const UPDATE_DELAY_MS = 250;
const POLL_INTERVAL_MS = 15_000;
const USAGE_REFRESH_MS = 5 * 60_000;
const USAGE_TIMEOUT_MS = 3_000;
const MAX_CHANGE_WORKTREES = 20;
const VISUAL_SCHEMA = "gentle-pi.visual-customization/v1";
const VISIBILITY_KEYS = ["changes", "rdd", "agents", "todo", "usageCost", "modelDetails", "contextWarning", "stats"];
const REQUIRED_VISIBILITY_KEYS = ["changes", "agents", "todo", "usageCost", "modelDetails"];

function errorCode(error) {
  return typeof error?.code === "string" ? error.code : "UNKNOWN";
}

function sessionCost(entries) {
  let total = 0;
  let found = false;
  for (const entry of entries ?? []) {
    if (entry?.type !== "message" || entry.message?.role !== "assistant") continue;
    const cost = entry.message.usage?.cost?.total;
    if (!Number.isFinite(cost)) continue;
    total += cost;
    found = true;
  }
  return found ? total : undefined;
}

function modelName(model) {
  if (!model || typeof model.provider !== "string" || typeof model.id !== "string") return undefined;
  return `${model.provider}/${model.id}`;
}

function contextPercent(ctx) {
  const tokens = ctx.getContextUsage?.()?.tokens;
  const capacity = ctx.model?.contextWindow;
  if (!Number.isFinite(tokens) || !Number.isFinite(capacity) || capacity <= 0) return undefined;
  return Math.min(100, Math.max(0, Math.round((tokens / capacity) * 100)));
}

function configHome(env = process.env) {
  if (typeof env.GENTLE_SHELL_PREFIX === "string" && path.isAbsolute(env.GENTLE_SHELL_PREFIX)) {
    return path.join(env.GENTLE_SHELL_PREFIX, "config", "gentle-ai");
  }
  if (typeof env.GENTLE_PI_CONFIG_HOME === "string" && env.GENTLE_PI_CONFIG_HOME.length > 0) return env.GENTLE_PI_CONFIG_HOME;
  if (typeof env.GENTLE_SHELL_CONFIG_HOME === "string" && path.isAbsolute(env.GENTLE_SHELL_CONFIG_HOME)) return env.GENTLE_SHELL_CONFIG_HOME;
  return path.join(homedir(), ".pi", "gentle-ai");
}

function agentHome(env = process.env) {
  if (typeof env.GENTLE_PI_AGENT_HOME === "string" && env.GENTLE_PI_AGENT_HOME.length > 0) return env.GENTLE_PI_AGENT_HOME;
  if (typeof env.PI_CODING_AGENT_DIR === "string" && env.PI_CODING_AGENT_DIR.length > 0) return env.PI_CODING_AGENT_DIR;
  return path.join(homedir(), ".pi", "agent");
}

async function statsVisible() {
  try {
    const raw = JSON.parse(await readFile(path.join(configHome(), "visual-customization.json"), "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.schema !== VISUAL_SCHEMA || Object.keys(raw).some((key) => !["schema", "statusPlacement", "headerPlacement", "density", "surface", "visibility"].includes(key))) return false;
    if (!["auto", "right", "bottom", "hidden"].includes(raw.statusPlacement) || !["top", "below-input", "split"].includes(raw.headerPlacement) || !["comfortable", "compact", "minimal"].includes(raw.density)) return false;
    if (raw.surface !== undefined && !["tinted", "transparent"].includes(raw.surface)) return false;
    const visibility = raw.visibility;
    if (!visibility || typeof visibility !== "object" || Array.isArray(visibility)) return false;
    const keys = Object.keys(visibility);
    if (keys.some((key) => !VISIBILITY_KEYS.includes(key)) || REQUIRED_VISIBILITY_KEYS.some((key) => !Object.hasOwn(visibility, key))) return false;
    if (keys.some((key) => typeof visibility[key] !== "boolean")) return false;
    return visibility.stats === true;
  } catch {
    return false;
  }
}

function contextEntries(ctx) {
  try {
    return ctx.sessionManager.getEntries?.() ?? [];
  } catch {
    return [];
  }
}

function branchEntries(ctx) {
  try {
    return ctx.sessionManager.getBranch?.() ?? contextEntries(ctx);
  } catch {
    return contextEntries(ctx);
  }
}

async function currentBranch(cwd) {
  try {
    const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
      cwd,
      timeout: 1000,
      maxBuffer: 4096,
      windowsHide: true,
    });
    const branch = stdout.trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

async function fetchUsage(source, ctx) {
  const controller = new AbortController();
  let timeout;
  const timeoutResult = new Promise((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(undefined);
    }, USAGE_TIMEOUT_MS);
  });
  const boundedFetch = (input, init = {}) => {
    const signal = init.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal;
    return globalThis.fetch(input, { ...init, signal });
  };
  const work = (async () => {
    const apiKey = await ctx.modelRegistry?.getApiKeyForProvider?.(source.provider).catch(() => undefined);
    if (controller.signal.aborted) return undefined;
    const value = await source.fetch(apiKey, boundedFetch, Date.now());
    return normalizeProviderUsage(value, source.provider);
  })();
  try {
    return await Promise.race([work, timeoutResult]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function snapshotFor(ctx, state) {
  const sessionId = ctx.sessionManager.getSessionId();
  const cwd = ctx.sessionManager.getCwd();
  if (typeof sessionId !== "string" || sessionId.length === 0) return undefined;
  if (typeof cwd !== "string" || cwd.length === 0) return undefined;

  const status = {};
  const model = modelName(ctx.model);
  if (model) status.model = model;
  if (typeof ctx.thinkingLevel === "string" && ctx.thinkingLevel.length > 0) status.effort = ctx.thinkingLevel;
  const pct = contextPercent(ctx);
  if (pct !== undefined) status.context = { pct };
  const cost = sessionCost(state.entries);
  if (cost !== undefined) status.cost = { usd: cost };
  if (typeof state.agentState === "string") status.agentState = state.agentState;
  const sessionName = ctx.sessionManager.getSessionName?.();
  if (typeof sessionName === "string" && sessionName.length > 0) status.sessionName = sessionName;

  const todos = extractTodos(state.branch, state.currentTurn);
  if (todos) status.todos = todos;
  const labelsByTaskId = new Map((state.agentHistory?.liveTasks ?? []).map((task) => [task.id, task.label]));
  status.agents = {
    items: state.agentHistory?.items ?? [],
    liveAvailable: state.liveAgentStatusAvailable === true,
    liveTasks: (state.liveAgentTasks ?? []).map((task) => {
      const label = labelsByTaskId.get(task.id);
      return label ? { ...task, label } : task;
    }),
    historyAvailable: state.agentHistory?.historyAvailable === true,
    ...(state.agentHistory?.historyPartial ? { historyPartial: true } : {}),
  };
  if (state.jobs?.length) status.jobs = state.jobs;
  if (state.usage.size > 0) status.usage = [...state.usage.values()];
  return { sessionId, cwd, status, entries: state.entries, worktreeCwds: state.worktreeCwds ?? [] };
}

export default function gentleHerdrBridge(pi, oscOptions) {
  const outputDirectory = path.resolve(process.env.GENTLE_HERDR_DIR || path.join(homedir(), ".gentle-herdr"));
  const usageSources = new Map();
  const usage = new Map();
  const usageFetchedAt = new Map();
  const usageInFlight = new Set();
  let active = false;
  let agentState;
  let currentTurn = 0;
  let latestJobs = [];
  let liveAgentTasks = [];
  let liveAgentStatusSeen = false;
  let pendingJobs;
  let latestContext;
  let timer;
  let pollTimer;
  let pendingContext;
  let writeQueue = Promise.resolve();

  function enqueueSnapshot(ctx) {
    const sessionId = ctx.sessionManager.getSessionId();
    const entries = contextEntries(ctx);
    const branch = branchEntries(ctx);
    const prepared = {
      entries,
      branch,
      currentTurn,
      agentState,
      jobs: latestJobs,
      liveAgentTasks,
      liveAgentStatusAvailable: liveAgentStatusSeen,
      usage,
      worktreeCwds: [],
    };
    writeQueue = writeQueue.then(async () => {
      const cwd = ctx.sessionManager.getCwd();
      if (typeof sessionId !== "string" || !sessionId || typeof cwd !== "string" || !cwd) return;
      const history = await readAgentHistory(path.join(agentHome(), "gentle-agents", "tasks"), sessionId);
      prepared.agentHistory = history;
      prepared.worktreeCwds = history?.worktreeCwds?.slice(0, MAX_CHANGE_WORKTREES) ?? [];
      const [showStats, changes, branchName] = await Promise.all([
        statsVisible(),
        readChanges(cwd, prepared.worktreeCwds).catch(() => undefined),
        currentBranch(cwd),
      ]);
      const current = snapshotFor(ctx, prepared);
      if (!current) return;
      if (showStats) {
        const subagents = history?.subagents?.runs > 0 ? history.subagents : undefined;
        current.status.stats = collectSessionStats(entries, subagents);
      }
      if (changes) current.status.changes = changes;
      const snapshot = buildSnapshot({
        sessionId: current.sessionId,
        cwd: current.cwd,
        branch: branchName,
        status: current.status,
        updatedAt: new Date().toISOString(),
      });
      await publishSnapshot(outputDirectory, snapshot);
    });
    writeQueue = writeQueue.catch((error) => {
      console.warn("gentle-herdr-bridge: snapshot update failed", errorCode(error));
    });
    return writeQueue;
  }

  function scheduleSnapshot(ctx) {
    if (!active) return;
    latestContext = ctx;
    pendingContext = ctx;
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      const latest = pendingContext;
      pendingContext = undefined;
      if (latest) void enqueueSnapshot(latest);
    }, UPDATE_DELAY_MS);
    timer.unref?.();
  }

  function refreshUsage(ctx, forceProvider) {
    if (!active) return;
    const now = Date.now();
    for (const [provider, source] of usageSources) {
      if (forceProvider && provider !== forceProvider) continue;
      if (usageInFlight.has(provider) || (!forceProvider && now - (usageFetchedAt.get(provider) ?? 0) < USAGE_REFRESH_MS)) continue;
      usageFetchedAt.set(provider, now);
      usageInFlight.add(provider);
      void fetchUsage(source, ctx).then((result) => {
        if (result) usage.set(provider, result);
      }).catch(() => {}).finally(() => {
        usageInFlight.delete(provider);
        scheduleSnapshot(latestContext ?? ctx);
      });
    }
  }

  function schedulePoll(ctx) {
    if (!active || pollTimer) return;
    pollTimer = setTimeout(() => {
      pollTimer = undefined;
      const latest = latestContext ?? ctx;
      if (!active || !latest) return;
      scheduleSnapshot(latest);
      refreshUsage(latest);
      schedulePoll(latest);
    }, POLL_INTERVAL_MS);
    pollTimer.unref?.();
  }

  const unsubscribe = [];
  const subscribe = (name, handler) => {
    const stop = pi.events?.on?.(name, handler);
    if (typeof stop === "function") unsubscribe.push(stop);
  };

  subscribe("gentle-ai:jobs-sidebar", (value) => {
    try {
      const eventSessionId = value?.sessionId;
      if (typeof eventSessionId !== "string") return;
      const jobs = parseJobsEvent(value, eventSessionId);
      if (jobs === undefined) return;
      if (!active) {
        pendingJobs = { sessionId: eventSessionId, jobs };
        return;
      }
      const sessionId = latestContext?.sessionManager?.getSessionId?.();
      if (sessionId !== eventSessionId) return;
      latestJobs = jobs;
      scheduleSnapshot(latestContext);
    } catch {
      // A malformed event from another extension must not break this session.
    }
  });
  subscribe("gentle-pi:notification:source", (value) => {
    if (!active || !latestContext) return;
    const sessionId = latestContext.sessionManager.getSessionId();
    const event = parseGentleAgentStatusEvent(value, sessionId);
    if (!event) return;
    liveAgentStatusSeen = true;
    liveAgentTasks = applyGentleAgentStatus(liveAgentTasks, event);
    scheduleSnapshot(latestContext);
  });
  subscribe("gentle-pi:usage-source/v1", (value) => {
    const source = parseUsageSource(value);
    if (!source) return;
    usageSources.set(source.provider, source);
    if (active && latestContext) refreshUsage(latestContext, source.provider);
  });

  pi.on("session_start", (_event, ctx) => {
    active = true;
    latestContext = ctx;
    const sessionId = ctx.sessionManager.getSessionId();
    latestJobs = pendingJobs?.sessionId === sessionId ? pendingJobs.jobs : [];
    liveAgentTasks = [];
    liveAgentStatusSeen = false;
    pendingJobs = undefined;
    currentTurn = countUserMessages(branchEntries(ctx));
    agentState = ctx.isIdle?.() === false ? "working" : "idle";
    emitHerdrStatus(agentState, oscOptions);
    scheduleSnapshot(ctx);
    refreshUsage(ctx);
    schedulePoll(ctx);
  });
  pi.on("model_select", (_event, ctx) => scheduleSnapshot(ctx));
  pi.on("thinking_level_select", (_event, ctx) => scheduleSnapshot(ctx));
  pi.on("session_info_changed", (_event, ctx) => scheduleSnapshot(ctx));
  pi.on("turn_end", (_event, ctx) => scheduleSnapshot(ctx));
  pi.on("tool_execution_end", (_event, ctx) => scheduleSnapshot(ctx));
  pi.on("before_agent_start", (_event, ctx) => {
    currentTurn += 1;
    scheduleSnapshot(ctx);
  });
  pi.on("session_tree", (_event, ctx) => {
    currentTurn = countUserMessages(branchEntries(ctx));
    scheduleSnapshot(ctx);
  });
  pi.on("agent_start", (_event, ctx) => {
    agentState = "working";
    emitHerdrStatus(agentState, oscOptions);
    scheduleSnapshot(ctx);
  });
  pi.on("agent_settled", (_event, ctx) => {
    agentState = "idle";
    emitHerdrStatus(agentState, oscOptions);
    scheduleSnapshot(ctx);
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    active = false;
    emitHerdrStatus("done", oscOptions);
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
    const latest = pendingContext ?? ctx;
    pendingContext = undefined;
    if (latest) await enqueueSnapshot(latest);
    await writeQueue;
    const sessionId = latest?.sessionManager?.getSessionId?.();
    if (typeof sessionId === "string" && sessionId.length > 0) {
      await removePresence(outputDirectory, sessionId).catch((error) => {
        console.warn("gentle-herdr-bridge: presence cleanup failed", errorCode(error));
      });
    }
    latestContext = undefined;
    latestJobs = [];
    liveAgentTasks = [];
    liveAgentStatusSeen = false;
  });
}
