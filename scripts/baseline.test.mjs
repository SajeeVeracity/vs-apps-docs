import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const nestPage = 'recipes/nest-adapter.md';
const quickstartPage = 'quickstart.md';

// `allow` names the page that may use a term.
const banned = [
  { re: /\bNest(JS)?\b/, allow: nestPage },
  { re: /@nestjs\//, allow: nestPage },
  { re: /\bVite\b/, allow: quickstartPage },
  { re: /\bExpress\b/ },
  { re: /\bFastify\b/ },
  { re: /\bpnpm\b/ },
  { re: /\byarn\b/ },
  { re: /import\.meta\.env/ },
  { re: /@Injectable/, allow: nestPage },
  { re: /@Controller/, allow: nestPage },
  { re: /experimentalDecorators/, allow: nestPage },
];

function bannedIn(body, page = '') {
  return banned.filter(({ re, allow }) => re.test(body) && allow !== page).map(({ re }) => String(re));
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

test('the Nest page is published and uses Nest terms', () => {
  assert.ok(pages.includes(nestPage), `${nestPage} is not a published page`);
  assert.notDeepEqual(bannedIn(readFileSync(new URL(nestPage, docs), 'utf8')), []);
});

test('the Nest allowance covers Nest terms and no other', () => {
  assert.deepEqual(bannedIn('uses NestJS and @nestjs/core', nestPage), []);
  assert.deepEqual(bannedIn('uses Vite with Nest', nestPage), ['/\\bVite\\b/']);
  assert.deepEqual(bannedIn('uses pnpm', nestPage), ['/\\bpnpm\\b/']);
});

test('guard flags each banned term and allows npm', () => {
  for (const term of ['Nest', 'NestJS', 'Vite', 'Express', 'Fastify', 'pnpm', 'yarn', 'import.meta.env', '@Injectable', '@Controller', 'experimentalDecorators']) {
    assert.notDeepEqual(bannedIn(`uses ${term} here`), [], term);
  }
  assert.deepEqual(bannedIn('run npm install; nested; express the idea'), []);
});
