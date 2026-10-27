import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../docs/index.mdx', import.meta.url), 'utf8');
const line = 'New to Vector? Start with [Quickstart](/quickstart).';

test('the start line links to Quickstart', () => {
  assert.ok(text.includes(line));
});

test('the start line sits above the goal tracks', () => {
  assert.ok(text.indexOf(line) < text.indexOf('<TrackList />'));
});

test('the goal tracks stay', () => {
  assert.ok(text.includes("import TrackList from '@site/src/components/TrackList';"));
  assert.equal(text.match(/<TrackList \/>/g).length, 1);
});
