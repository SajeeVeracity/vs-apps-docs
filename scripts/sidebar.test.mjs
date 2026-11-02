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

test('sections run Get started, Recipes, Guides, Nest, Reference', () => {
  assert.deepEqual(
    categories.map((category) => category.label),
    ['Get started', 'Recipes', 'Guides', 'Nest', 'Reference'],
  );
});

test('Quickstart is the first docs item after the landing page', () => {
  assert.deepEqual(categories[0].items.map(idOf).slice(0, 2), ['index', 'quickstart']);
});

test('Glossary is the last Reference item', () => {
  assert.equal(idOf(categories.at(-1).items.at(-1)), 'glossary');
});

test('the Nest section holds the nest-adapter recipe first', () => {
  const nest = categories.find((category) => category.label === 'Nest');
  assert.equal(idOf(nest.items[0]), 'nest/nest-adapter');
});

test('the Nest section lists the open-route guide after nest-adapter', () => {
  const nest = categories.find((category) => category.label === 'Nest');
  assert.deepEqual(nest.items.map(idOf).slice(0, 2), ['nest/nest-adapter', 'nest/open-route-and-read-caller']);
});

test('the Nest section lists the connector-events guide after the open-route guide', () => {
  const nest = categories.find((category) => category.label === 'Nest');
  assert.equal(idOf(nest.items[2]), 'nest/handle-connector-events');
});

test('the Guides and Nest sections each list a call-a-model guide', () => {
  for (const [label, id] of [['Guides', 'guides/call-a-model-from-your-server'], ['Nest', 'nest/call-a-model-from-your-server']]) {
    const category = categories.find((c) => c.label === label);
    assert.ok(category.items.map(idOf).includes(id), label);
  }
});

test('Recipes, Guides, Nest and Reference open on a generated-index page with a description', () => {
  for (const label of ['Recipes', 'Guides', 'Nest', 'Reference']) {
    const { link } = categories.find((category) => category.label === label);
    assert.equal(link?.type, 'generated-index', label);
    assert.ok(link.description?.length > 0, label);
    assert.equal(link.slug, `/category/${label.toLowerCase()}`, label);
  }
});

test('the Nest section lists the Call Space guide and the Guides section lists its plain twin', () => {
  const ids = (label) => categories.find((category) => category.label === label).items.map(idOf);
  assert.ok(ids('Nest').includes('nest/call-space-from-your-server'));
  assert.ok(ids('Guides').includes('guides/call-space-from-your-server'));
});
