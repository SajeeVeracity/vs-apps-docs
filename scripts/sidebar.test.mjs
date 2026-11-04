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

test('no Nest section and no page in a nest folder remain', () => {
  assert.ok(!categories.some((category) => category.label === 'Nest'));
  assert.deepEqual(pageIds.filter((id) => id.startsWith('nest/')), []);
});

test('every page in the docs folder appears exactly once', () => {
  assert.deepEqual([...listed].sort(), [...pageIds].sort());
});

test('sections run Get started, Recipes, Guides, Reference', () => {
  assert.deepEqual(
    categories.map((category) => category.label),
    ['Get started', 'Recipes', 'Guides', 'Reference'],
  );
});

test('Quickstart is the first docs item after the landing page', () => {
  assert.deepEqual(categories[0].items.map(idOf).slice(0, 2), ['index', 'quickstart']);
});

test('Glossary is the last Reference item', () => {
  assert.equal(idOf(categories.at(-1).items.at(-1)), 'glossary');
});

test('the Guides section lists the open-route, connector-events, call-a-model and Call Space guides', () => {
  const guides = categories.find((category) => category.label === 'Guides').items.map(idOf);
  for (const id of [
    'guides/open-route-and-read-caller',
    'guides/handle-connector-events',
    'guides/call-a-model-from-your-server',
    'guides/call-space-from-your-server',
  ]) {
    assert.ok(guides.includes(id), id);
  }
});

test('Recipes, Guides and Reference open on a generated-index page with a description', () => {
  for (const label of ['Recipes', 'Guides', 'Reference']) {
    const { link } = categories.find((category) => category.label === label);
    assert.equal(link?.type, 'generated-index', label);
    assert.ok(link.description?.length > 0, label);
    assert.equal(link.slug, `/category/${label.toLowerCase()}`, label);
  }
});

test('the Guides section lists the A2A guide', () => {
  const guides = categories.find((category) => category.label === 'Guides').items.map(idOf);
  assert.ok(guides.includes('guides/expose-app-as-a2a-agent'));
});

test('the Recipes section lists the five client recipes in the Next-step chain order', () => {
  const recipes = categories.find((category) => category.label === 'Recipes').items.map(idOf);
  assert.deepEqual(recipes, [
    'recipes/add-page-and-capability',
    'recipes/gate-by-capability',
    'recipes/read-app-context',
    'recipes/list-members',
    'recipes/expose-agent-actions',
  ]);
});
