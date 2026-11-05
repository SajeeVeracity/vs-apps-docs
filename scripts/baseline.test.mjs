import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const quickstartPage = 'quickstart.md';

// `allow` is the path prefix of the pages that may use a term.
const banned = [
  { re: /\bVite\b/, allow: quickstartPage },
  { re: /\bExpress\b/ },
  { re: /\bFastify\b/ },
  { re: /\bpnpm\b/ },
  { re: /\byarn\b/ },
  { re: /import\.meta\.env/ },
];

function bannedIn(body, page = '') {
  return banned.filter(({ re, allow }) => re.test(body) && !(allow && page.startsWith(allow))).map(({ re }) => String(re));
}

const docs = new URL('../docs/', import.meta.url);
const pages = readdirSync(docs, { recursive: true })
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => f.replaceAll('\\', '/'));

test('published pages name no stack outside the baseline', () => {
  for (const page of pages) {
    assert.deepEqual(bannedIn(readFileSync(new URL(page, docs), 'utf8'), page), [], page);
  }
});

test('Nest terms are allowed on any page', () => {
  assert.deepEqual(bannedIn('uses NestJS, @nestjs/core, @Injectable, @Controller and experimentalDecorators', 'guides/page.md'), []);
  assert.deepEqual(bannedIn("import from '@vectoragents/vs-apps/nest'", 'recipes/page.md'), []);
});

test('only the quickstart may name Vite', () => {
  assert.deepEqual(bannedIn('uses Vite', quickstartPage), []);
  assert.notDeepEqual(bannedIn('uses Vite', 'guides/page.md'), []);
});

test('guard flags each banned term and allows npm', () => {
  for (const term of ['Vite', 'Express', 'Fastify', 'pnpm', 'yarn', 'import.meta.env']) {
    assert.notDeepEqual(bannedIn(`uses ${term} here`), [], term);
  }
  assert.deepEqual(bannedIn('run npm install; nested; express the idea'), []);
});
