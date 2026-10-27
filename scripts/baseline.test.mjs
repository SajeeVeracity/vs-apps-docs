import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const banned = [
  /\bNest(JS)?\b/, /@nestjs\//, /\bVite\b/, /\bExpress\b/, /\bFastify\b/, /\bpnpm\b/, /\byarn\b/,
  /import\.meta\.env/, /@Injectable/, /@Controller/, /experimentalDecorators/,
];

// The one page that may name these terms, and no other term.
const nestPage = 'recipes/nest-adapter.md';
const nestTerms = new Set(['/\\bNest(JS)?\\b/', '/@nestjs\\//', '/@Injectable/', '/@Controller/', '/experimentalDecorators/']);

function bannedIn(body, allowed = new Set()) {
  return banned.filter((re) => re.test(body)).map(String).filter((term) => !allowed.has(term));
}

const docs = new URL('../docs/', import.meta.url);
const pages = readdirSync(docs, { recursive: true })
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => f.replaceAll('\\', '/'));

test('published pages name no stack outside the baseline', () => {
  for (const page of pages) {
    const allowed = page === nestPage ? nestTerms : undefined;
    assert.deepEqual(bannedIn(readFileSync(new URL(page, docs), 'utf8'), allowed), [], page);
  }
});

test('the Nest page is published and uses Nest terms', () => {
  assert.ok(pages.includes(nestPage), `${nestPage} is not a published page`);
  assert.notDeepEqual(bannedIn(readFileSync(new URL(nestPage, docs), 'utf8')), []);
});

test('the Nest allowance covers Nest terms and no other', () => {
  assert.deepEqual(bannedIn('uses NestJS and @nestjs/core', nestTerms), []);
  assert.deepEqual(bannedIn('uses Vite with Nest', nestTerms), ['/\\bVite\\b/']);
  assert.deepEqual(bannedIn('uses pnpm', nestTerms), ['/\\bpnpm\\b/']);
});

test('guard flags each banned term and allows npm', () => {
  for (const term of ['Nest', 'NestJS', 'Vite', 'Express', 'Fastify', 'pnpm', 'yarn', 'import.meta.env', '@Injectable', '@Controller', 'experimentalDecorators']) {
    assert.notDeepEqual(bannedIn(`uses ${term} here`), [], term);
  }
  assert.deepEqual(bannedIn('run npm install; nested; express the idea'), []);
});
