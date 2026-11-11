const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../mods/jec-changes/views/diff.js'), 'utf8')
  .replace(/^import[\s\S]*?;\s*/gm, '')
  .replace('export const diffMethods =', 'globalThis.diffMethods =');
const context = vm.createContext({});
vm.runInContext(source, context);
const methods = context.diffMethods;
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

const patchFile = { path: 'src/a.go', add: 1, del: 1, patch: '@@ -1 +1 @@\n-old\n+new' };

test('patch scope renders the GitHub patch without reading a local Git diff', async () => {
  let gitReads = 0;
  const result = await methods.readDiffContent.call({
    scope: 'patch',
    readDiffLines: async () => { gitReads++; return ['local diff']; },
  }, patchFile, patchFile.path, '/repo', null);

  same(result, { lines: ['@@ -1 +1 @@', '-old', '+new'] });
  assert.equal(gitReads, 0);
});

test('patch scope explains when GitHub omits a text patch', async () => {
  const result = await methods.readDiffContent.call({ scope: 'patch' }, {
    ...patchFile,
    patch: null,
  }, patchFile.path, '/repo', null);

  same(result, { lines: ['No text diff: GitHub leaves out binary and very large files.'] });
});

test('patch selection uses its supplied file and labels the header with the PR', () => {
  const file = methods.diffFile.call({ scope: 'patch', commitFile: patchFile, files: [] });
  assert.equal(file, patchFile);
  const head = methods.head.call({
    path: patchFile.path,
    scope: 'patch',
    commitRef: { short: 'PR #5' },
    diffFile: () => file,
  });
  same(head, {
    title: 'a.go',
    detail: 'src · PR #5',
    icon: 'mods/jec-changes/icons/file.svg',
    add: 1,
    del: 1,
  });
});

test('existing commit-scope selection still uses its selected file', () => {
  const file = methods.diffFile.call({ scope: 'commit', commitFile: patchFile, files: [] });
  assert.equal(file, patchFile);
});
