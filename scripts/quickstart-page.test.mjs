import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
const sections = text.split(/^## /m).slice(1);
const titles = sections.map((s) => s.split('\n')[0]);
const fences = [...text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)].map(([, lang, meta, body]) => ({ lang, meta, body }));

test('states stack and languages in the first lines', () => {
  const head = text.split('\n').slice(0, 12).join('\n');
  for (const word of ['TypeScript', 'React 19', 'Vite', 'NestJS']) assert.match(head, new RegExp(word));
});

test('follows the page template and ends with a result and a next step', () => {
  assert.deepEqual([titles[0], titles[1], titles[2]], ['Goal', 'Prerequisites', 'Set your values']);
  assert.deepEqual(titles.slice(-2), ['Result', 'Next step']);
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
  for (const name of ['GITHUB_PACKAGES_TOKEN', 'SPACE_BASE_URL', 'SPACE_JWKS_URL', 'ALLOWED_PARENT_ORIGIN', 'PUBLIC_BASE_URL']) {
    assert.match(setBlock, new RegExp(`export ${name}=`));
    assert.equal((text.match(new RegExp(`export ${name}=`, 'g')) ?? []).length, 1, name);
  }
  assert.doesNotMatch(text, /_authToken=[A-Za-z0-9_]{20,}/);
});

test('shows one page and one capability as a gating demonstration, not a minimum', () => {
  assert.match(text, /hello:view/);
  assert.match(text, /not an SDK minimum/i);
  assert.match(text, /RequireCapability/);
});

test('covers the client and server symbols', () => {
  for (const s of ['defineApp', 'buildManifests', 'AppPlatformModule', 'AppProvider', 'BootGate', 'loadAppClientConfig', 'RequireCapability']) {
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
