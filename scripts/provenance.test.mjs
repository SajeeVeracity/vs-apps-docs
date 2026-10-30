import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../.agents/provenance.md', import.meta.url), 'utf8');
const lostFolders = ['quickstart-review', 'quickstart-review-build', 'quickstart-revamp'];

test('no link points into a lost scratch folder', () => {
  for (const folder of lostFolders) {
    assert.doesNotMatch(text, new RegExp(`\\]\\([^)]*\\.scratch/${folder}/`), folder);
  }
});

test('each lost citation is marked as not recoverable', () => {
  const marks = text.match(/\(not recoverable\)|, not recoverable\)/g) ?? [];
  assert.equal(marks.length, 9);
});

test('states the three clean-up notes once each', () => {
  for (const note of [/03bd8d0/g, /Working with the npm registry/g, /no recoverable source record/g]) {
    assert.equal((text.match(note) ?? []).length, 1, String(note));
  }
});
