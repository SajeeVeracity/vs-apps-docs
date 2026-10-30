import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../docs/index.mdx', import.meta.url), 'utf8');
const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
const outsideFences = body.replace(/^```[\s\S]*?^```/gm, '');

test('the page links to Quickstart', () => {
  assert.match(outsideFences, /<Link\b[^>]*\bto="\/quickstart"/);
});

test('the page has a single top-level heading', () => {
  assert.equal((outsideFences.match(/^# /gm) ?? []).length, 1);
});

test('the goal tracks stay', () => {
  assert.ok(text.includes("import TrackList from '@site/src/components/TrackList';"));
  assert.equal(text.match(/<TrackList \/>/g).length, 1);
});
