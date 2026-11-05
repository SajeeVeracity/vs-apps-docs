import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { treesOf } from './page-helpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = join(root, 'docs-gen');
const { pages } = JSON.parse(readFileSync(join(gen, 'flavours.json'), 'utf8'));

// Pages whose body is React-specific. reference/client stays neutral: the /client subpath has no React code.
const clientOnly = [
  'recipes/add-page-and-capability',
  'recipes/read-app-context',
  'recipes/list-members',
  'guides/filter-navigation-by-capability',
  'reference/react',
  'reference/agent-react',
];
const neutral = ['reference/client', 'reference/root', 'glossary', 'app-definition', 'examples'];

for (const name of clientOnly) {
  test(`${name} is client-only: one react tree, a stub at the old address`, () => {
    const page = pages.find((p) => p.source === `${name}.md`);
    assert.deepEqual(page?.axes, ['client']);
    assert.deepEqual(page.trees, [{ flavours: { client: 'react' }, url: `/react/${name}` }]);
    assert.equal(page.url, `/${name}`);
    const trees = treesOf(`${name}.md`);
    assert.deepEqual(trees.map((t) => t.tree), ['react']);
    assert.doesNotMatch(trees[0].text, /<!-- \/?flavour/);
    const stub = readFileSync(join(gen, `${name}.md`), 'utf8');
    assert.match(stub, /\]\((\.\/)?[./\w-]*react\/[\w/-]+\.md\)/);
    assert.doesNotMatch(stub, /^## /m);
  });

  test(`${name} stays out of the server trees`, () => {
    for (const server of ['node', 'nest']) assert.equal(existsSync(join(gen, server, `${name}.md`)), false, server);
    assert.equal(existsSync(join(gen, 'react', 'node', `${name}.md`)), false);
  });
}

for (const name of neutral) {
  test(`${name} stays neutral`, () => {
    assert.equal(pages.some((p) => p.source === `${name}.md`), false);
  });
}

const anchorOf = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
const anchorsOf = (text) =>
  new Set([...text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6} (.+)$/gm)].map(([, h]) => h.match(/\{#([\w-]+)\}\s*$/)?.[1] ?? anchorOf(h)));
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [join(dir, e.name)] : []));

test('every anchored link in the generated site lands on a heading of the generated target', () => {
  const bad = [];
  for (const file of walk(gen)) {
    const text = readFileSync(file, 'utf8');
    for (const [, target, anchor] of text.matchAll(/\]\((\.[^)#]*\.mdx?)#([^)]+)\)/g)) {
      const path = join(dirname(file), target);
      if (!existsSync(path) || !anchorsOf(readFileSync(path, 'utf8')).has(anchor)) bad.push(`${file.slice(gen.length + 1)}: ${target}#${anchor}`);
    }
  }
  assert.deepEqual(bad, []);
});
