import { mkdir as defaultMkdir, rename as defaultRename, rm as defaultRm, writeFile as defaultWriteFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const SNAPSHOT_SCHEMA = "gentle-herdr-bridge/v1";
const RENAME_RETRY_DELAYS_MS = [25, 50, 100];

export function snapshotFileName(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new TypeError("sessionId must be a non-empty string");
  }
  const encodedId = Buffer.from(sessionId, "utf8").toString("base64url");
  return `session-${encodedId}.json`;
}

export function presenceFileName(sessionId) {
  return snapshotFileName(sessionId).replace(/^session-/, "presence-");
}

export function buildSnapshot({ sessionId, cwd, branch, updatedAt = new Date().toISOString(), status = {} }) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new TypeError("sessionId must be a non-empty string");
  }
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw new TypeError("cwd must be a non-empty string");
  }
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    throw new TypeError("status must be an object");
  }

  return {
    schema: SNAPSHOT_SCHEMA,
    sessionId,
    cwd,
    ...(typeof branch === "string" && branch.length > 0 ? { branch } : {}),
    updatedAt,
    status: { ...status },
  };
}

async function renameWithRetry(rename, source, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      const delay = error?.code === "EPERM" ? RENAME_RETRY_DELAYS_MS[attempt] : undefined;
      if (delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function atomicWriteJson(targetPath, value, { mkdir, writeFile, rename, rm }) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
    await renameWithRetry(rename, temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function publishSnapshot(directory, snapshot, options = {}) {
  if (typeof directory !== "string" || directory.length === 0) {
    throw new TypeError("directory must be a non-empty string");
  }
  if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA) {
    throw new TypeError(`snapshot schema must be ${SNAPSHOT_SCHEMA}`);
  }

  const io = {
    mkdir: options.mkdir ?? defaultMkdir,
    writeFile: options.writeFile ?? defaultWriteFile,
    rename: options.rename ?? defaultRename,
    rm: options.rm ?? defaultRm,
  };
  const snapshotPath = path.join(directory, snapshotFileName(snapshot.sessionId));
  const presencePath = path.join(directory, presenceFileName(snapshot.sessionId));
  await atomicWriteJson(snapshotPath, snapshot, io);
  await atomicWriteJson(presencePath, {
    sessionId: snapshot.sessionId,
    cwd: snapshot.cwd,
    pid: options.pid ?? process.pid,
    updatedAt: snapshot.updatedAt,
  }, io);
  return { snapshotPath, presencePath };
}

export async function removePresence(directory, sessionId, { rm = defaultRm } = {}) {
  await rm(path.join(directory, presenceFileName(sessionId)), { force: true });
}
