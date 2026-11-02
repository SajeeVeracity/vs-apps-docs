import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const nestFolder = 'nest/';
const nestPage = 'nest/nest-adapter.md';
const quickstartPage = 'quickstart.md';

// `allow` is the path prefix of the pages that may use a term.
const banned = [
  { re: /\bNest(JS)?\b/, allow: nestFolder },
  { re: /@nestjs\//, allow: nestFolder },
  { re: /\bVite\b/, allow: quickstartPage },
  { re: /\bExpress\b/ },
  { re: /\bFastify\b/ },
  { re: /\bpnpm\b/ },
  { re: /\byarn\b/ },
  { re: /import\.meta\.env/ },
  { re: /@Injectable/, allow: nestFolder },
  { re: /@Controller/, allow: nestFolder },
  { re: /experimentalDecorators/, allow: nestFolder },
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

test('the Nest folder is published and its first page uses Nest terms', () => {
  assert.ok(pages.includes(nestPage), `${nestPage} is not a published page`);
  assert.notDeepEqual(bannedIn(readFileSync(new URL(nestPage, docs), 'utf8')), []);
});

test('the Nest allowance covers Nest terms and no other', () => {
  assert.deepEqual(bannedIn('uses NestJS and @nestjs/core', nestPage), []);
  assert.deepEqual(bannedIn('uses Vite with Nest', nestPage), ['/\\bVite\\b/']);
  assert.deepEqual(bannedIn('uses pnpm', nestPage), ['/\\bpnpm\\b/']);
});

test('the Nest allowance covers every page in the Nest folder and no page outside it', () => {
  assert.deepEqual(bannedIn('uses NestJS and @Injectable', 'nest/another-page.md'), []);
  for (const page of ['recipes/nest-adapter.md', 'guides/open-a-route.md', 'nested/page.md', 'index.mdx']) {
    assert.notDeepEqual(bannedIn('uses NestJS', page), [], page);
  }
});

test('guard flags each banned term and allows npm', () => {
  for (const term of ['Nest', 'NestJS', 'Vite', 'Express', 'Fastify', 'pnpm', 'yarn', 'import.meta.env', '@Injectable', '@Controller', 'experimentalDecorators']) {
    assert.notDeepEqual(bannedIn(`uses ${term} here`), [], term);
  }
  assert.deepEqual(bannedIn('run npm install; nested; express the idea'), []);
});
