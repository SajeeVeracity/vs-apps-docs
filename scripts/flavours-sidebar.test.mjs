import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { redirectTarget } from '../src/flavours/resolve.mjs';
import { mapSidebarHrefs, sidebarNeighbours } from '../src/flavours/sidebar.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const axes = { client: { react: 'React' }, server: { node: 'Node.js + TypeScript', nest: 'Nest.js' } };
const defaults = { client: 'react', server: 'node' };
const redirects = {
  '/recipes/list-members': { axes: ['client'] },
  '/guides/call-space': { axes: ['server'] },
};
const choice = { client: 'react', server: 'nest' };
const toTree = (href) => redirectTarget({ axes, defaults, redirects, baseUrl: '/docs', pathname: href, saved: choice });

const sidebar = () => [
  { type: 'link', label: 'Quickstart', href: '/docs/quickstart', docId: 'quickstart' },
  {
    type: 'category',
    label: 'Recipes',
    href: '/docs/category/recipes',
    items: [
      { type: 'link', label: 'List members', href: '/docs/recipes/list-members', docId: 'recipes/list-members' },
      { type: 'link', label: 'Neutral', href: '/docs/recipes/neutral', docId: 'recipes/neutral' },
    ],
  },
  { type: 'category', label: 'Guides', items: [{ type: 'link', label: 'Call Space', href: '/docs/guides/call-space', docId: 'guides/call-space' }] },
];

test('links in the sidebar move into the reader pair at every depth; other hrefs stay', () => {
  const items = mapSidebarHrefs(sidebar(), toTree);
  assert.equal(items[0].href, '/docs/quickstart');
  assert.equal(items[1].href, '/docs/category/recipes');
  assert.equal(items[1].items[0].href, '/docs/react/recipes/list-members');
  assert.equal(items[1].items[1].href, '/docs/recipes/neutral');
  assert.equal(items[2].items[0].href, '/docs/nest/guides/call-space');
  assert.equal(items[2].href, undefined);
});

test('mapping does not change the input', () => {
  const input = sidebar();
  mapSidebarHrefs(input, toTree);
  assert.deepEqual(input, sidebar());
});

test('a tree page is found in the mapped sidebar, with its neighbours, and the stub is not', () => {
  const items = mapSidebarHrefs(sidebar(), toTree);
  const found = sidebarNeighbours(items, '/docs/react/recipes/list-members/');
  assert.deepEqual(found.previous, { title: 'Recipes', permalink: '/docs/category/recipes' });
  assert.deepEqual(found.next, { title: 'Neutral', permalink: '/docs/recipes/neutral' });
  assert.equal(sidebarNeighbours(items, '/docs/recipes/list-members'), null);
  assert.equal(sidebarNeighbours(sidebar(), '/docs/react/recipes/list-members'), null);
});

test('the first and last entries have one neighbour', () => {
  const items = mapSidebarHrefs(sidebar(), toTree);
  assert.equal(sidebarNeighbours(items, '/docs/quickstart').previous, undefined);
  assert.equal(sidebarNeighbours(items, '/docs/nest/guides/call-space').next, undefined);
});

test('every flavoured page of the generated site is a sidebar entry whose tree address is the one a reader of that pair gets', () => {
  const { pages } = JSON.parse(readFileSync(join(root, 'docs-gen/flavours.json'), 'utf8'));
  const siteRedirects = Object.fromEntries(pages.map((page) => [page.url, { axes: page.axes }]));
  for (const page of pages) {
    for (const tree of page.trees) {
      const mapped = redirectTarget({ axes, defaults, redirects: siteRedirects, baseUrl: '/', pathname: page.url, saved: tree.flavours });
      assert.equal(mapped, tree.url, page.source);
    }
  }
});
