import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";

const GIT_OPTIONS = { encoding: "buffer", timeout: 5000, maxBuffer: 4 * 1024 * 1024, windowsHide: true };
const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  const { stdout } = await execFileAsync("git", args, { cwd, ...GIT_OPTIONS });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

function normalizedPath(value) {
  const resolved = path.normalize(path.resolve(value));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function repositoryInfo(cwd) {
  const root = path.resolve(cwd, (await git(cwd, ["rev-parse", "--show-toplevel"])).toString("utf8").trim());
  const commonDir = path.resolve(cwd, (await git(cwd, ["rev-parse", "--git-common-dir"])).toString("utf8").trim());
  return { root, commonDir };
}

function parseNumstat(buffer) {
  const counts = new Map();
  for (const record of buffer.toString("utf8").split("\0")) {
    if (!record) continue;
    const first = record.indexOf("\t");
    const second = record.indexOf("\t", first + 1);
    if (first < 0 || second < 0) continue;
    const additions = record.slice(0, first);
    const deletions = record.slice(first + 1, second);
    const file = record.slice(second + 1);
    if (additions === "-" || deletions === "-") {
      counts.set(file, { countsUnavailable: true });
      continue;
    }
    const added = Number(additions);
    const deleted = Number(deletions);
    if (Number.isFinite(added) && Number.isFinite(deleted)) counts.set(file, { additions: added, deletions: deleted });
  }
  return counts;
}

function parseStatus(buffer) {
  const records = buffer.toString("utf8").split("\0");
  const statuses = new Map();
  for (const record of records) {
    if (record.length < 4) continue;
    statuses.set(record.slice(3), record.slice(0, 2));
  }
  return statuses;
}

async function countUntrackedLines(filePath) {
  try {
    const info = await lstat(filePath);
    if (!info.isFile()) return { countsUnavailable: true };
    let newlines = 0;
    let lastByte;
    let hasBytes = false;
    let binary = false;
    for await (const chunk of createReadStream(filePath)) {
      hasBytes ||= chunk.length > 0;
      lastByte = chunk.at(-1);
      for (const byte of chunk) {
        if (byte === 0) binary = true;
        if (byte === 10) newlines += 1;
      }
    }
    if (binary) return { countsUnavailable: true };
    return { additions: newlines + (hasBytes && lastByte !== 10 ? 1 : 0), deletions: 0 };
  } catch {
    return { countsUnavailable: true };
  }
}

async function readRoot(root) {
  const statuses = parseStatus(await git(root, ["status", "--porcelain=v1", "--untracked-files=all", "--no-renames", "-z"]));
  if (!statuses.size) return null;
  const counts = parseNumstat(await git(root, ["diff", "--numstat", "--no-renames", "-z", "HEAD"]));
  const files = [];
  for (const [file, status] of [...statuses].sort(([a], [b]) => a.localeCompare(b))) {
    let lineCounts = counts.get(file);
    if (!lineCounts) {
      if (status === "??") lineCounts = await countUntrackedLines(path.join(root, file));
      else lineCounts = { additions: 0, deletions: 0 };
    }
    files.push({ path: file, status, ...lineCounts });
  }
  return {
    root,
    files,
    additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
    deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
    ...(files.some((file) => file.countsUnavailable) ? { countsUnavailable: true } : {}),
  };
}

export async function readChanges(cwd, associatedWorktrees = []) {
  if (typeof cwd !== "string" || cwd.length === 0) throw new TypeError("cwd must be a non-empty string");
  if (!Array.isArray(associatedWorktrees) || associatedWorktrees.some((root) => typeof root !== "string" || root.length === 0)) {
    throw new TypeError("associatedWorktrees must be an array of non-empty paths");
  }

  const base = await repositoryInfo(cwd);
  const roots = new Map([[normalizedPath(base.root), base.root]]);
  for (const candidate of associatedWorktrees) {
    try {
      const info = await repositoryInfo(candidate);
      if (normalizedPath(info.commonDir) !== normalizedPath(base.commonDir)) continue;
      roots.set(normalizedPath(info.root), info.root);
    } catch {
      // Missing, removed, or non-Git task roots are not change roots.
    }
  }

  const groups = [];
  for (const root of [...roots.values()].sort((a, b) => a.localeCompare(b))) {
    const group = await readRoot(root);
    if (group) groups.push(group);
  }
  return {
    roots: groups,
    additions: groups.reduce((sum, root) => sum + root.additions, 0),
    deletions: groups.reduce((sum, root) => sum + root.deletions, 0),
    ...(groups.some((root) => root.countsUnavailable) ? { countsUnavailable: true } : {}),
  };
}
