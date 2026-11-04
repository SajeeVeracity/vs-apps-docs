import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { combinations } from '../generate.mjs';
import { indexedUrls } from './search-indexes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(readFileSync(join(root, 'flavours.config.json'), 'utf8'));
const { pages } = JSON.parse(readFileSync(join(root, config.outDir, 'flavours.json'), 'utf8'));
const build = join(root, 'build');
const pairs = combinations(config.axes, Object.keys(config.axes));
const trees = pages.flatMap((page) => page.trees.map((tree) => ({ ...tree, axes: page.axes })));
const agrees = (pair, flavours) => Object.entries(flavours).every(([axis, flavour]) => pair[axis] === flavour);

for (const pair of pairs) {
  const name = Object.values(pair).join('/');
  const urls = () => indexedUrls(build, name);
  const kind = (axis) => trees.filter((t) => t.axes.length === 1 && t.axes[0] === axis && agrees(pair, t.flavours));

  test(`the ${name} index holds the neutral glossary`, () => assert.ok(urls().includes('/glossary')));

  test(`the ${name} index holds every tree page of the pair and none of another pair`, () => {
    for (const { flavours, url } of trees) assert.equal(urls().includes(url), agrees(pair, flavours), url);
  });

  for (const axis of Object.keys(config.axes)) {
    const known = kind(axis)[0];
    test(`the ${name} index holds a known ${axis}-only page`, { skip: known ? false : `no ${axis}-only page in the site yet` }, () => {
      assert.ok(urls().includes(known.url), known.url);
    });
  }
}
