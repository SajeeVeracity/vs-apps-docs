import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const url = new URL('../.agents/provenance.md', import.meta.url);
const text = readFileSync(url, 'utf8');
const lostFolders = ['quickstart-review', 'quickstart-review-build', 'quickstart-revamp'];
const linkTargets = [...text.matchAll(/\]\(([^)]+)\)/g)].map(([, target]) => target);
const occurrences = (needle) => text.split(needle).length - 1;

test('no link points into a lost scratch folder', () => {
  for (const folder of lostFolders) {
    assert.ok(!linkTargets.some((target) => target.includes(`.scratch/${folder}/`)), folder);
  }
});

test('every relative link outside .scratch resolves', () => {
  const relative = linkTargets.filter((target) => !target.startsWith('#') && !target.includes('.scratch/') && !/^[a-z]+:/.test(target));
  assert.ok(relative.length > 0);
  for (const target of relative) assert.ok(existsSync(new URL(target.split('#')[0], url)), target);
});

test('lost citations are marked as not recoverable', () => {
  assert.match(text, /^## Not recoverable$/m);
  assert.match(text, /not recoverable\)/);
});

test('states the three clean-up notes once each', () => {
  for (const note of ['03bd8d0', 'Working with the npm registry', 'no recoverable source record']) {
    assert.equal(occurrences(note), 1, note);
  }
});
