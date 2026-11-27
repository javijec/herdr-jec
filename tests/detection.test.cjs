"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function matcher() {
  const text = await fs.readFile(path.join(__dirname, "../mods/jec-chat/providers/match.js"), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(text));
}
const A = "01a21c73-5584-4b01-99fb-91910bb771b6";
const B = "01a1f521-b737-42e1-91f6-8dcc61759900";
test("identifica Codex resume por UUID sin confundir otros procesos", async () => {
  const { resumedId } = await matcher();
  assert.equal(resumedId({foreground:{argv:["C:\\Tools\\codex.exe","resume",A]}}),A);
  assert.equal(resumedId({foreground:{argv:["pwsh","resume",A]}}),null);
  assert.equal(resumedId({foreground:{argv:["codex","resume","--last"]}}),null);
  assert.equal(resumedId({foreground:{argv:["codex","--no-daemon"]}}),null);
});
test("detecta la respuesta única visible en la terminal y evita adivinar", async () => {
  const { visibleMatch } = await matcher();
  const sessions=[
    {id:A,messages:[{role:"user",text:"hola"},{role:"assistant",phase:"final_answer",text:"¡Hola! ¿En qué te puedo ayudar?"}]},
    {id:B,messages:[{role:"user",text:"consulta pasada"},{role:"assistant",phase:"final_answer",text:"La ejecución terminó y devolvió un resultado diferente."}]},
  ];
  const screen="› hola\n\n• ¡Hola! ¿En qué te puedo\n ayudar?\n\n› ";
  assert.deepEqual(visibleMatch(screen,sessions),{id:A,method:"respuesta visible"});
  assert.equal(visibleMatch("› hola",sessions),null);
  const duplicate=[...sessions,{id:"other",messages:[{role:"assistant",phase:"final_answer",text:"¡Hola! ¿En qué te puedo ayudar?"}]}];
  assert.equal(visibleMatch(screen,duplicate),null);
});
test("no coincide por contexto técnico ni solo carpeta", async () => {
  const { visibleMatch } = await matcher();
  assert.equal(visibleMatch("Codex: proyecto herdr-jec",[{id:A,messages:[]}]),null);
  assert.deepEqual(visibleMatch("› Corregí la aplicación y ejecutá las pruebas de integración completas.",[
    {id:A,messages:[{role:"user",text:"Corregí la aplicación y ejecutá las pruebas de integración completas."}]},
    {id:B,messages:[{role:"user",text:"Otra solicitud no relacionada."}]}
  ]),{id:A,method:"mensaje visible"});
});
