import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { default: sidebars } = await import(join(root, 'sidebars.ts'));
const items = sidebars.docs;

const pageIds = readdirSync(join(root, 'docs'), { recursive: true })
  .filter((file) => /\.mdx?$/.test(file))
  .map((file) => file.replace(/\.mdx?$/, '').split('\\').join('/'));
const idOf = (item) => (typeof item === 'string' ? item : item.id);
const categories = items.filter((item) => item.type === 'category');
const listed = [
  ...items.filter((item) => item.type !== 'category').map(idOf),
  ...categories.flatMap((category) => category.items.map(idOf)),
];

test('every page in the docs folder appears exactly once', () => {
  assert.deepEqual([...listed].sort(), [...pageIds].sort());
});

test('sections run Get started, Guides, Recipes, Reference', () => {
  assert.deepEqual(
    categories.map((category) => category.label),
    ['Get started', 'Guides', 'Recipes', 'Reference'],
  );
});

test('Quickstart is the first docs item after the landing page', () => {
  assert.deepEqual(categories[0].items.map(idOf).slice(0, 2), ['index', 'quickstart']);
});

test('Glossary is the last Reference item', () => {
  assert.equal(idOf(categories[3].items.at(-1)), 'glossary');
});

test('Guides, Recipes and Reference open on a generated-index page with a description', () => {
  for (const label of ['Guides', 'Recipes', 'Reference']) {
    const { link } = categories.find((category) => category.label === label);
    assert.equal(link?.type, 'generated-index', label);
    assert.ok(link.description?.length > 0, label);
    assert.equal(link.slug, `/category/${label.toLowerCase()}`, label);
  }
});
