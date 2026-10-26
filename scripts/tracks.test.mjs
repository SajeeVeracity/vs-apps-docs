import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadProgress, saveProgress, summarize, toggleStep, tracks } from '../src/tracks/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resolves = (to) =>
  existsSync(join(root, 'docs', `${to}.md`)) || existsSync(join(root, 'src', 'pages', `${to.slice(1)}.tsx`)) || existsSync(join(root, 'docs', `${to}`, 'index.md'));

const memory = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    data,
  };
};
const broken = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

test('every track step links to an existing page', () => {
  for (const track of tracks) for (const step of track.steps) assert.ok(resolves(step.to), `${track.id}: ${step.to}`);
});

test('ids are unique and each track has steps', () => {
  assert.equal(new Set(tracks.map((t) => t.id)).size, tracks.length);
  for (const track of tracks) {
    assert.ok(track.steps.length >= 2, track.id);
    assert.equal(new Set(track.steps.map((s) => s.id)).size, track.steps.length, track.id);
  }
});

test('the build-a-definition track links concept page, builder and examples in order', () => {
  const track = tracks.find((t) => t.id === 'build-definition');
  const links = track.steps.map((s) => s.to);
  assert.ok(links.indexOf('/app-definition') < links.indexOf('/builder'));
  assert.ok(links.indexOf('/builder') < links.indexOf('/examples'));
});

test('steps follow the reading order quickstart, concept, builder, examples, reference, recipes, guides, glossary', () => {
  const rank = (to) =>
    ['/quickstart', '/app-definition', '/builder', '/examples', '/reference/', '/recipes/', '/guides/', '/glossary'].findIndex((p) => to.startsWith(p));
  for (const track of tracks) {
    const ranks = track.steps.map((s) => rank(s.to));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), track.id);
  }
});

test('toggleStep adds then removes a step without mutating', () => {
  const a = {};
  const b = toggleStep(a, 't', 's1');
  assert.deepEqual(b, { t: ['s1'] });
  assert.deepEqual(a, {});
  assert.deepEqual(toggleStep(b, 't', 's1'), { t: [] });
});

test('summarize counts only known steps', () => {
  const track = tracks[0];
  const done = { [track.id]: [track.steps[0].id, 'gone'] };
  assert.deepEqual(summarize(track, done), { done: 1, total: track.steps.length });
});

test('progress round-trips through storage', () => {
  const store = memory();
  saveProgress(store, { t: ['s1'] });
  assert.deepEqual(loadProgress(store), { t: ['s1'] });
});

test('loadProgress ignores corrupt or wrongly shaped data', () => {
  assert.deepEqual(loadProgress(memory({ 'vs-apps-docs:track-progress': '{bad' })), {});
  assert.deepEqual(loadProgress(memory({ 'vs-apps-docs:track-progress': '{"t":"x","u":["a",1]}' })), { u: ['a'] });
});

test('storage that throws or is missing leaves progress empty and does not throw', () => {
  assert.deepEqual(loadProgress(broken), {});
  assert.doesNotThrow(() => saveProgress(broken, { t: ['s1'] }));
  assert.deepEqual(loadProgress(undefined), {});
  assert.doesNotThrow(() => saveProgress(undefined, {}));
});

test('landing page renders the tracks, version label and stamp', () => {
  const page = readFileSync(join(root, 'docs', 'index.mdx'), 'utf8');
  assert.match(page, /TrackList/);
  assert.match(page, /slug: \//);
  assert.ok(!existsSync(join(root, 'docs', 'index.md')));
});
