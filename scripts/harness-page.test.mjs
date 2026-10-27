import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../docs/reference/harness.md', import.meta.url), 'utf8');

test('prerequisites state React 18 and the dev-issuer flag', () => {
  const prerequisites = text.split(/^## /m).find((s) => s.startsWith('Prerequisites'));
  assert.match(prerequisites, /React 18/);
  assert.match(prerequisites, /VA_DEV_ISSUER=true/);
  assert.doesNotMatch(prerequisites, /React 19/);
});

test('both dev routes have a shape and the handler uses createDevIssuer on node:http', () => {
  for (const route of ['GET /api/__dev/manifests', 'POST /api/__dev/token']) assert.match(text, new RegExp(route));
  for (const field of ['appKey', 'appId', 'manifest', 'token', 'expiresIn', 'claims', 'kind', 'ttlSeconds']) {
    assert.match(text, new RegExp(`\`${field}\``), field);
  }
  assert.match(text, /from 'node:http'/);
  assert.match(text, /createDevIssuer/);
});

test('serves harness.html with "your bundler" and keeps the development-only warning', () => {
  assert.match(text, /your bundler/);
  assert.match(text, /Serve it only in development/);
});
