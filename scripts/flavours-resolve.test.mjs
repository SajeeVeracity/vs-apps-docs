import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import vm from 'node:vm';
import { generate } from './generate.mjs';
import { headScript, storageKey } from '../src/flavours/head-script.mjs';
import { loadFlavourSite } from '../src/flavours/site.mjs';
import { choiceInUrl, redirectTarget, shortLabel, switchTarget } from '../src/flavours/resolve.mjs';

const axes = { client: { react: 'React' }, server: { node: 'Node.js + TypeScript', nest: 'Nest.js' } };
const defaults = { client: 'react', server: 'node' };
const redirects = {
  '/quickstart': { axes: ['client', 'server'] },
  '/recipes/list-members': { axes: ['client'] },
  '/guides/expose-app-as-a2a-agent': { axes: ['server'] },
};
const site = { axes, defaults, redirects, baseUrl: '/' };

test('a stub with no saved choice redirects to the default pair', () => {
  assert.equal(redirectTarget({ ...site, pathname: '/quickstart', saved: null }), '/react/node/quickstart');
});

test('a saved choice picks the pair', () => {
  const saved = { client: 'react', server: 'nest' };
  assert.equal(redirectTarget({ ...site, pathname: '/quickstart', saved }), '/react/nest/quickstart');
});

test('a saved flavour that is not known falls back to the default of its axis', () => {
  const saved = { client: 'vue', server: 'nest' };
  assert.equal(redirectTarget({ ...site, pathname: '/quickstart', saved }), '/react/nest/quickstart');
  assert.equal(redirectTarget({ ...site, pathname: '/quickstart', saved: 'nest' }), '/react/node/quickstart');
});

test('a stub carries only the axes its page varies on', () => {
  const saved = { client: 'react', server: 'nest' };
  assert.equal(redirectTarget({ ...site, pathname: '/guides/expose-app-as-a2a-agent', saved }), '/nest/guides/expose-app-as-a2a-agent');
  assert.equal(redirectTarget({ ...site, pathname: '/recipes/list-members', saved }), '/react/recipes/list-members');
});

test('an address that is not a stub gets no redirect', () => {
  assert.equal(redirectTarget({ ...site, pathname: '/glossary', saved: null }), null);
  assert.equal(redirectTarget({ ...site, pathname: '/react/node/quickstart', saved: null }), null);
  assert.equal(redirectTarget({ ...site, pathname: '/constructor', saved: null }), null);
});

test('a trailing slash and a base URL are handled', () => {
  const docs = { ...site, baseUrl: '/docs/' };
  assert.equal(redirectTarget({ ...docs, pathname: '/docs/quickstart/', saved: null }), '/docs/react/node/quickstart');
  assert.equal(redirectTarget({ ...docs, pathname: '/quickstart', saved: null }), '/docs/react/node/quickstart');
});

test('an old address redirects to the page it names, with its pinned flavour', () => {
  const old = {
    ...site,
    redirects: {
      ...redirects,
      '/nest/call-space-from-your-server': { to: '/guides/call-space-from-your-server', axes: ['server'], fixed: { server: 'nest' } },
    },
  };
  const saved = { client: 'react', server: 'node' };
  assert.equal(
    redirectTarget({ ...old, pathname: '/nest/call-space-from-your-server', saved }),
    '/nest/guides/call-space-from-your-server',
  );
});

test('the flavours of a tree address are read in axis order', () => {
  assert.deepEqual(choiceInUrl({ pathname: '/react/nest/quickstart', baseUrl: '/', axes }), {
    choice: { client: 'react', server: 'nest' },
    rest: '/quickstart',
  });
  assert.deepEqual(choiceInUrl({ pathname: '/nest/guides/x/', baseUrl: '/', axes }), { choice: { server: 'nest' }, rest: '/guides/x' });
  assert.deepEqual(choiceInUrl({ pathname: '/react/recipes/list-members', baseUrl: '/', axes }), {
    choice: { client: 'react' },
    rest: '/recipes/list-members',
  });
});

test('a flavourless address has no flavours', () => {
  assert.deepEqual(choiceInUrl({ pathname: '/quickstart', baseUrl: '/', axes }), { choice: {}, rest: '/quickstart' });
  assert.deepEqual(choiceInUrl({ pathname: '/', baseUrl: '/', axes }), { choice: {}, rest: '/' });
});

test('flavours out of axis order or repeated are not flavours', () => {
  assert.deepEqual(choiceInUrl({ pathname: '/node/react/quickstart', baseUrl: '/', axes }), { choice: { server: 'node' }, rest: '/react/quickstart' });
  assert.deepEqual(choiceInUrl({ pathname: '/node/nest/quickstart', baseUrl: '/', axes }), { choice: { server: 'node' }, rest: '/nest/quickstart' });
});

test('a tree address under a base URL is read after the base', () => {
  assert.deepEqual(choiceInUrl({ pathname: '/docs/react/node/quickstart', baseUrl: '/docs/', axes }), {
    choice: { client: 'react', server: 'node' },
    rest: '/quickstart',
  });
});

test('a tree page opens in the new pair when it varies on the axis', () => {
  const pick = (pathname, axis, flavour) => switchTarget({ pathname, baseUrl: '/', axes, axis, flavour });
  assert.equal(pick('/react/node/quickstart', 'server', 'nest'), '/react/nest/quickstart');
  assert.equal(pick('/node/guides/x', 'server', 'nest'), '/nest/guides/x');
});

test('a page that does not vary on the axis stays', () => {
  const pick = (pathname, axis, flavour) => switchTarget({ pathname, baseUrl: '/', axes, axis, flavour });
  assert.equal(pick('/node/guides/x', 'client', 'react'), null);
  assert.equal(pick('/glossary', 'server', 'nest'), null);
  assert.equal(pick('/react/node/quickstart', 'server', 'node'), null);
});

test('the base URL stays on a switched address', () => {
  assert.equal(switchTarget({ pathname: '/docs/react/node/quickstart', baseUrl: '/docs/', axes, axis: 'server', flavour: 'nest' }), '/docs/react/nest/quickstart');
});

/** Runs the head script against a fake page and returns where it sent the reader, or null. */
function runHeadScript({ pathname, search = '', hash = '', stored, baseUrl = '/' }) {
  let sent = null;
  const context = {
    location: { pathname, search, hash, replace: (to) => (sent = to) },
    localStorage: { getItem: (key) => (key === storageKey ? stored : null) },
  };
  vm.runInNewContext(headScript({ ...site, baseUrl, storageKey }), context);
  return sent;
}

test('the head script sends a stub to the saved choice and keeps the query and hash', () => {
  const stored = JSON.stringify({ client: 'react', server: 'nest' });
  assert.equal(runHeadScript({ pathname: '/quickstart', search: '?a=1', hash: '#step-2', stored }), '/react/nest/quickstart?a=1#step-2');
});

test('the head script sends a first visit to the default pair', () => {
  assert.equal(runHeadScript({ pathname: '/quickstart', stored: null }), '/react/node/quickstart');
});

test('the head script survives damaged storage', () => {
  assert.equal(runHeadScript({ pathname: '/quickstart', stored: '{not json' }), '/react/node/quickstart');
});

test('the head script leaves a tree address and a neutral page alone', () => {
  assert.equal(runHeadScript({ pathname: '/react/nest/quickstart', stored: null }), null);
  assert.equal(runHeadScript({ pathname: '/glossary', stored: null }), null);
});

const sandboxes = [];
after(() => sandboxes.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Generates a tiny project and loads its flavour site. */
function siteOf(pages, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'flavour-site-'));
  sandboxes.push(root);
  for (const [path, text] of Object.entries(pages)) {
    mkdirSync(dirname(join(root, 'docs', path)), { recursive: true });
    writeFileSync(join(root, 'docs', path), text);
  }
  const config = { docsRoot: 'docs', outDir: 'docs-gen', todoCap: 5, axes, defaults, ...extra };
  generate({ root, config });
  return loadFlavourSite({ root, config });
}

const both = '<!-- flavour react -->\nR\n<!-- /flavour -->\n<!-- flavour node -->\nN\n<!-- /flavour -->\n<!-- flavour nest -->\nT\n<!-- /flavour -->\n';
const serverOnly = '<!-- flavour node -->\nN\n<!-- /flavour -->\n<!-- flavour nest -->\nT\n<!-- /flavour -->\n';

test('the site table lists each stub with the axes of its page, and nothing else', () => {
  const site = siteOf({ 'quickstart.md': both, 'guides/call.md': serverOnly, 'glossary.md': '# Glossary\n' });
  assert.deepEqual(site.redirects, {
    '/quickstart': { axes: ['client', 'server'] },
    '/guides/call': { axes: ['server'] },
  });
  assert.deepEqual(site.axes, axes);
  assert.deepEqual(site.defaults, defaults);
});

test('the site table adds old addresses from the config', () => {
  const legacy = [{ from: '/nest/call-space', to: '/guides/call', fixed: { server: 'nest' } }];
  const site = siteOf({ 'guides/call.md': serverOnly }, { legacyRedirects: legacy });
  assert.deepEqual(site.redirects['/nest/call-space'], { to: '/guides/call', axes: ['server'], fixed: { server: 'nest' } });
});

test('an old address that names no flavoured page is an error', () => {
  const legacy = [{ from: '/nest/x', to: '/guides/missing' }];
  assert.throws(() => siteOf({ 'guides/call.md': serverOnly }, { legacyRedirects: legacy }), /\/guides\/missing/);
});

test('a trigger label is the part of the flavour name before the plus', () => {
  assert.equal(shortLabel('Node.js + TypeScript'), 'Node.js');
  assert.equal(shortLabel('Nest.js'), 'Nest.js');
});
