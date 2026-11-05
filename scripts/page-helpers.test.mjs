import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { generate } from './generate.mjs';
import { treesOf } from './page-helpers.mjs';

const config = {
  docsRoot: 'docs',
  outDir: 'docs-gen',
  todoCap: 5,
  axes: { client: { react: 'React' }, server: { node: 'Node.js + TypeScript', nest: 'Nest.js' } },
  defaults: { client: 'react', server: 'node' },
};

const root = mkdtempSync(join(tmpdir(), 'helpers-'));
after(() => rmSync(root, { recursive: true, force: true }));
const pages = {
  'plain.md': 'PLAIN\n',
  'guides/call.md': '<!-- flavour node -->\nNODE\n<!-- /flavour -->\n<!-- flavour nest -->\nNEST\n<!-- /flavour -->\n',
  'quickstart.md':
    '<!-- flavour react -->\nREACT\n<!-- /flavour -->\n<!-- flavour node -->\nNODE\n<!-- /flavour -->\n<!-- flavour nest -->\nNEST\n<!-- /flavour -->\n',
};
for (const [path, body] of Object.entries(pages)) {
  mkdirSync(dirname(join(root, 'docs', path)), { recursive: true });
  writeFileSync(join(root, 'docs', path), body);
}
generate({ root, config });
const genDir = join(root, 'docs-gen');

test('treesOf returns one entry per tree of a flavoured page, labelled by its tree path', () => {
  const trees = treesOf('guides/call.md', { genDir });
  assert.deepEqual(trees.map(({ tree }) => tree), ['node', 'nest']);
  assert.match(trees[0].text, /NODE/);
  assert.match(trees[1].text, /NEST/);
});

test('treesOf names both axes for a both-axis page', () => {
  const trees = treesOf('quickstart.md', { genDir });
  assert.deepEqual(trees.map(({ tree }) => tree), ['react/node', 'react/nest']);
  assert.ok(trees.every(({ text }) => /REACT/.test(text)));
});

test('treesOf returns the single copy of a neutral page', () => {
  const trees = treesOf('plain.md', { genDir });
  assert.deepEqual(trees, [{ tree: '', text: 'PLAIN\n' }]);
});

test('treesOf names the generator when the trees are missing', () => {
  assert.throws(() => treesOf('plain.md', { genDir: join(root, 'absent') }), /pnpm generate/);
});
