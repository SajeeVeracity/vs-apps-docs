import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generate } from '../generate.mjs';
import { indexedUrls } from './search-indexes.mjs';

const site = join(dirname(fileURLToPath(import.meta.url)), 'search-fixture');
const build = join(site, 'build');

before(() => {
  const config = JSON.parse(readFileSync(join(site, 'flavours.config.json'), 'utf8'));
  generate({ root: site, config });
  rmSync(build, { recursive: true, force: true });
  execFileSync('pnpm', ['exec', 'docusaurus', 'build', site, '--out-dir', build], { stdio: 'inherit' });
}, { timeout: 300_000 });

const pairs = {
  'react/node': { own: ['/react/node/both-page', '/node/server-page', '/react/client-page'], other: ['/react/nest/both-page', '/nest/server-page'] },
  'react/nest': { own: ['/react/nest/both-page', '/nest/server-page', '/react/client-page'], other: ['/react/node/both-page', '/node/server-page'] },
};

for (const [pair, { own, other }] of Object.entries(pairs)) {
  test(`the ${pair} index holds neutral, client-only and server-only pages and none of the other pair`, () => {
    const urls = indexedUrls(build, pair);
    for (const url of ['/neutral-page', ...own]) assert.ok(urls.includes(url), `${url} missing from ${urls}`);
    for (const url of other) assert.ok(!urls.includes(url), `${url} must not be in ${urls}`);
  });
}

test('a flavourless stub is in the root index and in no pair index', () => {
  assert.ok(indexedUrls(build, '').includes('/server-page'));
  for (const pair of Object.keys(pairs)) assert.ok(!indexedUrls(build, pair).includes('/server-page'));
});

test('a context that names one axis holds the pages of every flavour of the other axis', () => {
  const react = indexedUrls(build, 'react');
  for (const url of ['/neutral-page', '/react/client-page', '/react/node/both-page', '/react/nest/both-page', '/node/server-page', '/nest/server-page']) {
    assert.ok(react.includes(url), `${url} missing from ${react}`);
  }
  const node = indexedUrls(build, 'node');
  assert.ok(node.includes('/react/node/both-page') && node.includes('/node/server-page'));
  assert.ok(!node.includes('/react/nest/both-page') && !node.includes('/nest/server-page'));
});

test('the root index, for a reader on a neutral page, holds every page', () => {
  const root = indexedUrls(build, '');
  for (const url of ['/neutral-page', '/react/node/both-page', '/react/nest/both-page', '/node/server-page', '/nest/server-page', '/react/client-page']) {
    assert.ok(root.includes(url), `${url} missing from ${root}`);
  }
});
