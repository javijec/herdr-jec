"use strict";
// Preserve unrelated hooks and never bypass Codex's user trust workflow.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const EVENTS = ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"];
function legacyCommandFor(script, platform = process.platform) {
  if (platform === "win32") {
    const p = script.replace(/\\/g, "/");
    if (/["%!&|<>\r\n]/.test(p)) throw Error("Unsupported character in Windows hook path");
    return 'node "' + p + '"';
  }
  return "node '" + script.replace(/'/g, "'\\''") + "'";
}
function previousWindowsCommand(script, executable = process.execPath) {
  const quote = value => {
    if (/["%!&|<>\r\n]/.test(value)) throw Error("Unsupported character in Windows hook path");
    return '"' + value.replace(/\//g, "\\") + '"';
  };
  return quote(executable) + " " + quote(script);
}
function commandFor(script, platform = process.platform, executable = process.execPath) {
  if (platform !== "win32") return legacyCommandFor(script, platform);
  // Codex 0.172 uses the environment's shell (normally PowerShell).
  // A quoted executable is a string expression in PowerShell, not a command.
  // Explicitly read the JSON on stdin and pipe it to Node as UTF-8.
  const quote = value => "'" + value.replace(/\//g, "\\").replace(/'/g, "''") + "'";
  return "$OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::In.ReadToEnd() | & "
    + quote(executable) + " " + quote(script) + "; exit $LASTEXITCODE";
}
function merge(config, command, legacyCommand = null) {
  const legacy = Array.isArray(legacyCommand) ? legacyCommand : [legacyCommand];
  if (!config || typeof config !== "object" || Array.isArray(config)) throw Error("Invalid hooks.json");
  config.hooks ??= {};
  if (typeof config.hooks !== "object" || Array.isArray(config.hooks)) throw Error("Invalid hooks object");
  let changed = false;
  for (const event of EVENTS) {
    if (!Object.hasOwn(config.hooks, event)) config.hooks[event] = [];
    const groups = config.hooks[event];
    if (!Array.isArray(groups)) throw Error("Invalid hook list: " + event);
    // Migrate only the exact old JEC command, preserving every other hook.
    if (legacy.some(old => old && old !== command)) {
      for (const group of groups) {
        if (!Array.isArray(group?.hooks)) continue;
        for (const handler of group.hooks) {
          if (handler?.type === "command" && handler.command !== command && legacy.includes(handler.command)) {
            handler.command = command;
            changed = true;
          }
        }
      }
    }
    if (groups.some(g => Array.isArray(g?.hooks) && g.hooks.some(h => h?.type === "command" && h.command === command))) continue;
    groups.push({ hooks: [{ type: "command", command, timeout: event === "SessionEnd" ? 3 : 5 }] });
    changed = true;
  }
  return changed;
}
function install(home, script) {
  const file = path.join(home, "hooks.json");
  const original = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const config = original === null ? {} : JSON.parse(original.replace(/^\uFEFF/, ""));
  const old = [legacyCommandFor(script)];
  if (process.platform === "win32") old.push(previousWindowsCommand(script));
  if (!merge(config, commandFor(script), old)) return false;
  fs.mkdirSync(home, { recursive: true });
  if (original !== null) {
    const backup = path.join(home, "hooks.json.jec-backup-" + Date.now());
    fs.writeFileSync(backup, original, { flag: "wx" });
  }
  const temp = file + ".jec-" + process.pid + ".tmp";
  try {
    fs.writeFileSync(temp, JSON.stringify(config, null, 2) + "\n", { flag: "wx" });
    if ((fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null) !== original) throw Error("hooks.json changed during install");
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  return true;
}
if (require.main === module) {
  try {
    const home = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
    const changed = install(home, path.join(__dirname, "session-hook.cjs"));
    console.log(changed ? "JEC hooks added. Review and trust them in Codex /hooks." : "JEC hooks already installed. Review trust in Codex /hooks.");
  } catch (error) { console.error("JEC hooks not installed: " + error.message); process.exitCode = 1; }
}
module.exports = { merge, commandFor, legacyCommandFor, previousWindowsCommand, install };
