import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const url = new URL('../.agents/provenance.md', import.meta.url);
const text = readFileSync(url, 'utf8');
const lostFolders = ['quickstart-review', 'quickstart-review-build', 'quickstart-revamp'];
const linkTargets = [...text.matchAll(/\]\(([^)]+)\)/g)].map(([, target]) => target);

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
