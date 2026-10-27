import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// `nest` marks the terms that the Nest page may use.
const banned = [
  { re: /\bNest(JS)?\b/, nest: true },
  { re: /@nestjs\//, nest: true },
  { re: /\bVite\b/ },
  { re: /\bExpress\b/ },
  { re: /\bFastify\b/ },
  { re: /\bpnpm\b/ },
  { re: /\byarn\b/ },
  { re: /import\.meta\.env/ },
  { re: /@Injectable/, nest: true },
  { re: /@Controller/, nest: true },
  { re: /experimentalDecorators/, nest: true },
];

const nestPage = 'recipes/nest-adapter.md';

function bannedIn(body, nestAllowed = false) {
  return banned.filter(({ re, nest }) => re.test(body) && !(nestAllowed && nest)).map(({ re }) => String(re));
}

const docs = new URL('../docs/', import.meta.url);
const pages = readdirSync(docs, { recursive: true })
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => f.replaceAll('\\', '/'));

test('published pages name no stack outside the baseline', () => {
  for (const page of pages) {
    assert.deepEqual(bannedIn(readFileSync(new URL(page, docs), 'utf8'), page === nestPage), [], page);
  }
});

test('the Nest page is published and uses Nest terms', () => {
  assert.ok(pages.includes(nestPage), `${nestPage} is not a published page`);
  assert.notDeepEqual(bannedIn(readFileSync(new URL(nestPage, docs), 'utf8')), []);
});

test('the Nest allowance covers Nest terms and no other', () => {
  assert.deepEqual(bannedIn('uses NestJS and @nestjs/core', true), []);
  assert.deepEqual(bannedIn('uses Vite with Nest', true), ['/\\bVite\\b/']);
  assert.deepEqual(bannedIn('uses pnpm', true), ['/\\bpnpm\\b/']);
});

test('guard flags each banned term and allows npm', () => {
  for (const term of ['Nest', 'NestJS', 'Vite', 'Express', 'Fastify', 'pnpm', 'yarn', 'import.meta.env', '@Injectable', '@Controller', 'experimentalDecorators']) {
    assert.notDeepEqual(bannedIn(`uses ${term} here`), [], term);
  }
  assert.deepEqual(bannedIn('run npm install; nested; express the idea'), []);
});
