import test from "node:test";
import assert from "node:assert/strict";
import { isMarkdown, markdownBlocks, resolvePath } from "../mods/better-files/files/model.js";

test("recognizes Markdown extensions without case sensitivity", () => {
  assert.equal(isMarkdown("/docs/guide.MD"), true);
  assert.equal(isMarkdown("/docs/guide.markdown"), true);
  assert.equal(isMarkdown("/docs/guide.md.txt"), false);
});

test("resolves local Markdown links relative to the document and rejects URLs", () => {
  assert.equal(resolvePath("/docs/chapters", "../intro.md#start"), "/docs/intro.md");
  assert.equal(resolvePath("/docs", "file:///tmp/note.md"), "/tmp/note.md");
  assert.equal(resolvePath("/docs", "https://example.com"), null);
  assert.equal(resolvePath("/docs", "#section"), null);
});

test("extracts only standalone local image lines outside fenced code", () => {
  assert.deepEqual(markdownBlocks("# Guide\n\n![Map](images/map.png)\n\n```md\n![literal](x.png)\n```", "/docs"), [
    { type: "text", text: "# Guide\n\n" },
    { type: "image", alt: "Map", path: "/docs/images/map.png" },
    { type: "text", text: "\n```md\n![literal](x.png)\n```" },
  ]);
});
