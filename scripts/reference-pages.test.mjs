import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (name) => {
  const url = new URL(`../docs/reference/${name}.md`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};
const section = (text, title) => text.split(/^## /m).find((s) => s.startsWith(title)) ?? '';

test('root and agent-react prerequisites pin zod 3 and give the install command', () => {
  for (const name of ['root', 'agent-react']) {
    const prerequisites = section(read(name), 'Prerequisites');
    assert.match(prerequisites, /npm install zod@3\b/, name);
    assert.match(prerequisites, /paramsJsonSchema/, name);
    assert.doesNotMatch(prerequisites, /npm install zod(?!@3)/, name);
  }
});

test('the description sentence states SDK guarantees only', () => {
  const root = read('root');
  assert.doesNotMatch(root, /only guidance/);
  assert.match(root, /in the manifest/);
  assert.doesNotMatch(read('agent-react'), /so the agent sees the actions/);
  assert.match(read('agent-react'), /reports the mounted actions/);
});

test('the server reference documents pingSpaceManifests', () => {
  const text = read('server');
  assert.match(text, /^title: Server reference$/m);
  const ping = section(text, '`pingSpaceManifests`');
  assert.deepEqual(
    ['Signature', 'Behaviour', 'Example'].filter((h) => !ping.includes(`### ${h}`)),
    [],
  );
  for (const term of ['spaceBaseUrl', 'manifests', 'log', 'Promise<void>', '/api/apps/manifest-ping', 'appKey', 'manifestHash', '429']) {
    assert.ok(ping.includes(term), term);
  }
  assert.match(ping, /never throws/i);
  assert.match(text, /\]\(\.\.\/glossary\.md#manifest\)/);
});
