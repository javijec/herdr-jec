"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { samePath, scan, transcript, main } = require("../mods/jec-chat/providers/codex.cjs");

test("compara rutas normalizadas", () => {
  assert.equal(samePath("/tmp/project/..", "/tmp"), true);
  assert.equal(samePath("/tmp/uno", "/tmp/dos"), false);
});
test("lee la sesion de la carpeta y no mezcla conversaciones", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "jec-codex-"));
  const root = path.join(tmp, "sessions");
  const cwd = path.join(tmp, "repo");
  const other = path.join(tmp, "other");
  try {
    const dir = path.join(root, "2026", "11", "27");
    await fs.mkdir(dir, { recursive: true });
    const make = (name, folder, id) => [
      { type: "session_meta", payload: { id, cwd: folder } },
      { type: "event_msg", timestamp: "2026-11-27T10:00:00Z",
        payload: { type: "user_message", message: "Probá los tests" } },
      { type: "response_item", timestamp: "2026-11-27T10:00:01Z",
        payload: { type: "message", role: "assistant", phase: "final_answer",
          content: [{ type: "output_text", text: "## Listo\nTests aprobados." }] } },
      { type: "response_item", timestamp: "2026-11-27T10:00:02Z",
        payload: { type: "function_call", name: "shell_command", arguments: "{}" } },
    ].map(x => JSON.stringify(x)).join("\n") + "\n";
    const good = path.join(dir, "rollout-ok.jsonl");
    await fs.writeFile(good, make("ok", cwd, "session-one"));
    await fs.writeFile(path.join(dir, "rollout-other.jsonl"), make("other", other, "session-two"));
    const list = await scan(root, cwd);
    assert.equal(list.sessions.length, 1);
    assert.equal(list.sessions[0].id, "session-one");
    const t = await transcript(good);
    assert.deepEqual(t.messages.map(x => x.role), ["user", "assistant", "tool"]);
    assert.equal(t.messages[1].text, "## Listo\nTests aprobados.");
    assert.equal(t.messages[1].phase, "final_answer");
    const old = process.env.CODEX_HOME;
    process.env.CODEX_HOME = tmp;
    try {
      const result = await main(["read", "--cwd", cwd, "--file", good]);
      assert.equal(result.ok, true);
      await assert.rejects(
        () => main(["read", "--cwd", other, "--file", good]),
        /no coincide/
      );
    } finally {
      if (old === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = old;
    }
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test("oculta el contexto tecnico sin borrar prompts reales", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "jec-codex-context-"));
  try {
    const file = path.join(tmp, "rollout-context.jsonl");
    const context = "<environment_context>\\n<cwd>C:\\\\proyecto</cwd>\\n<shell>powershell</shell>\\n</environment_context>";
    const lines = [
      { type: "event_msg", payload: { type: "user_message", message: context } },
      { type: "event_msg", payload: { type: "user_message", message: context + "\\nHola, Codex" } },
      { type: "event_msg", payload: { type: "user_message", message: "Explicá la etiqueta <environment_context> sin ocultarla" } },
      { type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hola" }] } },
    ];
    await fs.writeFile(file, lines.map(x => JSON.stringify(x)).join("\\n") + "\\n");
    const t = await transcript(file);
    assert.deepEqual(t.messages.map(x => x.text), [
      "Hola, Codex", "Explicá la etiqueta <environment_context> sin ocultarla", "Hola"
    ]);
    assert.equal(t.total, 3);

    const itemFile = path.join(tmp, "rollout-context-item.jsonl");
    const items = [
      { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: context }] } },
      { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Mensaje real" }] } },
    ];
    await fs.writeFile(itemFile, items.map(x => JSON.stringify(x)).join("\\n") + "\\n");
    const itemsTranscript = await transcript(itemFile);
    assert.deepEqual(itemsTranscript.messages.map(x => x.text), ["Mensaje real"]);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
