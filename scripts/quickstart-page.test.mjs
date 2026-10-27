import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
const sections = text.split(/^## /m).slice(1);
const titles = sections.map((s) => s.split('\n')[0]);
const fences = [...text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)].map(([, lang, meta, body]) => ({ lang, meta, body }));

test('states the languages in the first lines', () => {
  const head = text.split('\n').slice(0, 12).join('\n');
  for (const word of ['TypeScript', 'Node', 'React']) assert.match(head, new RegExp(word));
});

test('prerequisites state the baseline versions once and allow another package manager', () => {
  const prerequisites = sections.find((s) => s.startsWith('Prerequisites'));
  assert.match(prerequisites, /Node\.js 20\.6/);
  assert.match(prerequisites, /React 18/);
  assert.match(prerequisites, /TypeScript 5/);
  assert.match(prerequisites, /`strict`/);
  assert.match(prerequisites, /another package manager/i);
  for (const re of [/20\.6/g, /React 18/g]) assert.equal((text.match(re) ?? []).length, 1, String(re));
});

test('installs use npm and the registry is a scope, a URL and a token', () => {
  assert.match(text, /^npm install @vectoragents\/vs-apps@0\.2\.4 /m);
  assert.match(text, /^npm run dev:server$/m);
  assert.match(text, /scope, a registry URL and a token/);
  assert.match(text, /title="\.npmrc"/);
  assert.doesNotMatch(text, /catalog:|workspace:/);
});

test('the server is a node:http handler on the /server subpath', () => {
  assert.match(text, /from 'node:http'/);
  for (const s of ['createSpaceTokenVerifier', 'extractBearer', 'assertCapability', 'verifyAppUserToken', 'verifyProvisioningToken']) {
    assert.match(text, new RegExp(s), s);
  }
  assert.doesNotMatch(text, /@vectoragents\/vs-apps\/nest/);
});

test('the client names no bundler and shows no bundler config', () => {
  assert.match(text, /your bundler/);
  assert.doesNotMatch(text, /dev:client|\.config\.[jt]s|index\.html/);
});

test('follows the page template and ends with a result and a next step', () => {
  assert.deepEqual([titles[0], titles[1], titles[2]], ['Goal', 'Prerequisites', 'Set your values']);
  assert.deepEqual(titles.slice(-2), ['Result', 'Next steps']);
  assert.match(text, /^## Steps$/m);
});

test('every ts and tsx block is a labelled file with no ellipsis', () => {
  const code = fences.filter((f) => f.lang === 'ts' || f.lang === 'tsx');
  assert.ok(code.length >= 8);
  for (const f of code) {
    assert.match(f.meta, /title="[\w./-]+"/);
    assert.doesNotMatch(f.body, /\.\.\.|…/);
  }
});

test('shell blocks have no prompt and one command per line', () => {
  const shell = fences.filter((f) => f.lang === 'bash');
  assert.ok(shell.length >= 3);
  for (const f of shell) {
    for (const line of f.body.trim().split('\n')) {
      assert.doesNotMatch(line, /^\$ /);
      assert.doesNotMatch(line, /&&|;\s*\w|\\$/);
    }
  }
});

test('secrets and ids are UPPER_CASE placeholders defined once up front', () => {
  const setBlock = sections[2];
  assert.equal((text.match(/export GITHUB_PACKAGES_TOKEN=/g) ?? []).length, 1);
  assert.match(setBlock, /export GITHUB_PACKAGES_TOKEN=/);
  for (const name of ['SPACE_BASE_URL', 'SPACE_JWKS_URL', 'ALLOWED_PARENT_ORIGIN', 'PUBLIC_BASE_URL', 'SERVER_PORT', 'CLIENT_PORT']) {
    assert.match(setBlock, new RegExp(`^${name}=`, 'm'));
    assert.equal((text.match(new RegExp(`^${name}=`, 'gm')) ?? []).length, 1, name);
    assert.doesNotMatch(text, new RegExp(`export ${name}=`));
  }
  assert.doesNotMatch(text, /_authToken=[A-Za-z0-9_]{20,}/);
});

test('no inline localhost literal with a fixed port', () => {
  assert.doesNotMatch(text, /localhost:\d+/);
});

test('shows one page and one capability as a gating demonstration, not a minimum', () => {
  assert.match(text, /hello:view/);
  assert.match(text, /not an SDK minimum/i);
  assert.match(text, /RequireCapability/);
});

test('covers the client and server symbols', () => {
  for (const s of ['defineApp', 'buildManifests', 'AppProvider', 'BootGate', 'loadAppClientConfig', 'RequireCapability']) {
    assert.match(text, new RegExp(s), s);
  }
});

test('links the concept page and glossary terms', () => {
  assert.match(text, /\(\.\/app-definition\.md\)/);
  for (const a of ['app-definition', 'manifest', 'space', 'app-registration', 'capability', 'page']) {
    assert.match(text, new RegExp(`\\(\\./glossary\\.md#${a}\\)`), a);
  }
});

test('VectorAppsHarness appears only in a debugging aside', () => {
  const holders = sections.filter((s) => s.includes('VectorAppsHarness'));
  assert.equal(holders.length, 1);
  assert.match(holders[0], /^Debugging aside/);
  assert.equal(titles.at(-3), 'Debugging aside: the dev harness');
});

test('follows the writing standard', () => {
  assert.doesNotMatch(text, /—|–/);
  assert.doesNotMatch(text, /\b(we|our|let's)\b/i);
  assert.doesNotMatch(text, /\b(simply|just|easy|easily)\b/i);
});

test('is in the sidebar order after the concept page', () => {
  assert.match(text, /^---\ntitle: Quickstart\n/);
});
