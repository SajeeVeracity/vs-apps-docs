import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tracks } from '../src/tracks/index.ts';

test('track ids are unique', () => {
  assert.equal(new Set(tracks.map((t) => t.id)).size, tracks.length);
});

test('each track has at least 2 steps with distinct routes', () => {
  for (const track of tracks) {
    assert.ok(track.steps.length >= 2, track.id);
    assert.equal(new Set(track.steps.map((s) => s.to)).size, track.steps.length, track.id);
  }
});
