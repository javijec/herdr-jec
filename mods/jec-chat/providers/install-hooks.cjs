"use strict";
// Preserve unrelated hooks and never bypass Codex's user trust workflow.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const EVENTS = ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"];
function commandFor(script, platform = process.platform) {
  if (platform === "win32") {
    // Windows command shell: use a quoted forward-slash absolute path.
    const p = script.replace(/\\/g, "/");
    if (/["%!&|<>\r\n]/.test(p)) throw Error("Unsupported character in Windows hook path");
    return 'node "' + p + '"';
  }
  return "node '" + script.replace(/'/g, "'\\''") + "'";
}
function merge(config, command) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw Error("Invalid hooks.json");
  config.hooks ??= {};
  if (typeof config.hooks !== "object" || Array.isArray(config.hooks)) throw Error("Invalid hooks object");
  let changed = false;
  for (const event of EVENTS) {
    if (!Object.hasOwn(config.hooks, event)) config.hooks[event] = [];
    const groups = config.hooks[event];
    if (!Array.isArray(groups)) throw Error("Invalid hook list: " + event);
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
  if (!merge(config, commandFor(script))) return false;
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
module.exports = { merge, commandFor, install };
