// Codex session identification without guessing by mtime or folder alone.
// The only strong signals are an explicit 'codex resume <id>' command line,
// or a distinctive transcript message visible in this exact terminal.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;

export function resumedId(terminalInfo) {
  const info = terminalInfo?.terminal ?? terminalInfo?.record ?? terminalInfo ?? {};
  const commands = [info.foreground?.argv, info.argv];
  const ids = new Set();
  for (const argv of commands) {
    if (!Array.isArray(argv)) continue;
    // Only a Codex command has authority to name its active thread.
    const program = argv.some(a => typeof a === "string" &&
      /(?:^|[\\/])codex(?:\.exe|\.cmd)?$/i.test(a));
    if (!program) continue;
    const ix = argv.findIndex(x => x === "resume");
    if (ix < 0 || !UUID.test(argv[ix + 1] ?? "")) continue;
    ids.add(argv[ix + 1].toLowerCase());
  }
  return ids.size === 1 ? [...ids][0] : null;
}

export function compact(text) {
  return String(text ?? "").replace(ANSI, "").normalize("NFKC").toLowerCase()
    .replace(/[\p{P}\p{S}\s\u200b-\u200d]+/gu, "");
}

export function visibleMatch(screen, sessions) {
  const visible = compact(screen);
  if (visible.length < 20 || !Array.isArray(sessions)) return null;
  const hits = [];
  for (const session of sessions) {
    const messages = session.messages ?? [];
    // Prefer a complete reply. Only the last two replies count, never a
    // random older phrase that might also exist in the current TUI screen.
    const replies = messages.filter(m => m.role === "assistant" &&
      (m.phase === "final_answer" || m.phase == null)).slice(-2);
    const matchesReply = replies.some(m => {
      const value = compact(m.text);
      return value.length >= 20 && value.length <= 5000 && visible.includes(value);
    });
    // If an agent has not replied yet, a long *user* prompt can identify the
    // session. Short generic prompts such as 'hola' are never evidence.
    const prompt = [...messages].reverse().find(m => m.role === "user");
    const user = compact(prompt?.text);
    const matchesPrompt = user.length >= 40 && user.length <= 5000 && visible.includes(user);
    if (matchesReply || matchesPrompt) hits.push({ id: session.id, method: matchesReply ? "respuesta visible" : "mensaje visible" });
  }
  // No recency tie-break: two matches are ambiguous.
  return hits.length === 1 ? hits[0] : null;
}
