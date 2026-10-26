import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkSnippets } from './check-snippets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = [
  { file: 'src/examples/sdr.definition.ts', export: 'sdrDefinition' },
  { file: 'src/examples/csr.definition.ts', export: 'csrDefinition' },
];

for (const { file, export: name } of examples) {
  const source = readFileSync(join(root, file), 'utf8');

  test(`${file} is a standalone definition`, async () => {
    assert.doesNotMatch(source, /contract|packages\/|\.\.\/|\.\.\.|csr-agents|csr:agents|acts:|agents:/);
    assert.deepEqual(
      [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]),
      ['@vectoragents/vs-apps'],
    );
  });

  test(`${file} passes defineApp with consistent keys`, async () => {
    const def = (await import(join(root, file)))[name];
    const capabilities = new Set(def.capabilities.map((c) => c.key));
    for (const page of def.pages) assert.ok(capabilities.has(page.capability), page.key);
    assert.ok(def.pages.some((p) => p.key === def.defaultPageKey));
    assert.ok(def.resources.models.length > 0);
  });
}

test('sdr shows several pages and csr shows connector eventHandlers', async () => {
  const sdr = (await import(join(root, examples[0].file))).sdrDefinition;
  const csr = (await import(join(root, examples[1].file))).csrDefinition;
  assert.ok(sdr.pages.length > 1 && sdr.capabilities.length > 1);
  assert.ok(csr.resources.connectors.every((c) => c.eventHandlers.length > 0));
});

test('a file-embedded fence is typechecked as pasted', () => {
  const root2 = mkdtempSync(join(tmpdir(), 'emb-'));
  mkdirSync(join(root2, 'docs'));
  writeFileSync(join(root2, 'bad.ts'), `const n: number = 'x';\n`);
  writeFileSync(join(root2, 'docs', 'p.md'), '```ts file="bad.ts"\n```\n');
  const result = checkSnippets({ docsDir: join(root2, 'docs'), stampFile: join(root2, 's.json'), baseDir: root2 });
  assert.equal(result.ok, false);
});

test('the examples page embeds both files and the build check covers them', () => {
  const page = readFileSync(join(root, 'docs/examples.md'), 'utf8');
  for (const { file } of examples) assert.match(page, new RegExp(`file="${file}"`));
  assert.equal(checkSnippets({ stampFile: join(mkdtempSync(join(tmpdir(), 'st-')), 's.json') }).ok, true);
});
