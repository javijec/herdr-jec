import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const installer = join(root, "install-layout.ps1");
const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const available = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"], { encoding: "utf8" }).status === 0;

function runInstall(appHome, extra = []) {
  return spawnSync(shell, ["-NoProfile", "-NonInteractive", "-File", installer, "-HerdrAppHome", appHome, ...extra], {
    cwd: root,
    encoding: "utf8",
    timeout: 60000,
  });
}

function psLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function filesBelow(folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return filesBelow(path);
    return entry.name !== "jsconfig.json" && !entry.name.toLowerCase().endsWith(".d.ts") ? [path] : [];
  });
}

test("installer copies the layout, mods, and themes into an empty app home", { skip: !available }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "herdr-layout-install-"));
  try {
    const appHome = join(scratch, "app");
    const result = runInstall(appHome);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(appHome, "mods", "better-changes", "jsconfig.json")), false);
    for (const folder of ["layouts", "mods", "themes"]) {
      if (!existsSync(join(root, folder))) continue;
      const sources = filesBelow(join(root, folder));
      if (["layouts", "mods"].includes(folder)) assert.ok(sources.length > 0, `expected package files in ${folder}`);
      for (const source of sources) {
        const target = join(appHome, folder, relative(join(root, folder), source));
        assert.equal(readFileSync(target, "utf8"), readFileSync(source, "utf8"), `${folder}/${relative(join(root, folder), source)}`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("installer skips differing existing files unless replacement is requested, then backs them up", { skip: !available }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "herdr-layout-conflict-"));
  try {
    const appHome = join(scratch, "app");
    const target = join(appHome, "mods", "better-changes", "mod.json");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "user-owned content\n");

    const skipped = runInstall(appHome);
    assert.equal(skipped.status, 0, skipped.stderr || skipped.stdout);
    assert.equal(readFileSync(target, "utf8"), "user-owned content\n");
    assert.match(`${skipped.stdout}\n${skipped.stderr}`, /skipp?ed|conflict/i);

    const replaced = runInstall(appHome, ["-ReplaceExisting"]);
    assert.equal(replaced.status, 0, replaced.stderr || replaced.stdout);
    assert.notEqual(readFileSync(target, "utf8"), "user-owned content\n");
    const backups = filesBelow(join(appHome, ".herdr-layout-backups"));
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(backups[0], "utf8"), "user-owned content\n");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("installer WhatIf mode does not create app-home files", { skip: !available }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "herdr-layout-whatif-"));
  try {
    const appHome = join(scratch, "app");
    const command = `$env:PATH = ''; & ${psLiteral(installer)} -HerdrAppHome ${psLiteral(appHome)} -WhatIf -Activate`;
    const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], { cwd: root, encoding: "utf8", timeout: 60000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(appHome, "layouts", "javijec.json")), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("installer refuses to target its own package directory", { skip: !available }, () => {
  const result = runInstall(root);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /must be outside the layout package/i);
});

test("installer rejects destination junctions before writing outside app home", { skip: !available || process.platform !== "win32" }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "herdr-layout-junction-"));
  try {
    const appHome = join(scratch, "app");
    const outside = join(scratch, "outside");
    mkdirSync(appHome, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(appHome, "mods"), "junction");

    const result = runInstall(appHome);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /reparse point/i);
    assert.equal(existsSync(join(outside, "better-changes", "mod.json")), false);
    assert.equal(existsSync(join(appHome, "layouts", "javijec.json")), false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
