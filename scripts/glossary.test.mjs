import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../docs/glossary.md', import.meta.url), 'utf8');
const entries = text
  .split(/^### /m)
  .slice(1)
  .map((block) => {
    const [name, ...rest] = block.split('\n');
    return { name: name.replace(/\s*\{#.*\}\s*$/, '').trim(), body: rest.join('\n') };
  });

const required = [
  'app', 'app definition', 'manifest', 'Space', 'space manager', 'staff', 'app registration', 'page',
  'capability', 'grant', 'model slot', 'connector slot', 'agent action', 'agent catalog', 'acts', 'approvals',
  'harness', 'SDK', 'MCP', 'monorepo', 'shared package',
];

test('covers every candidate term', () => {
  assert.deepEqual(entries.map((e) => e.name.toLowerCase()).sort(), required.map((t) => t.toLowerCase()).sort());
});

test('each entry has definition, mapping and owner', () => {
  for (const { name, body } of entries) {
    assert.match(body, /^[^\s-].*$/m, `${name}: definition`);
    assert.match(body, /^- Maps to: .+/m, `${name}: mapping`);
    assert.match(body, /^- Owner: (SDK|Space|SDK and Space|docs)\b/m, `${name}: owner`);
  }
});

test('follows the writing standard', () => {
  assert.doesNotMatch(text, /—|–/);
  assert.doesNotMatch(text, /\b(we|our|ours|us)\b/i);
});

test('published pages use no internal term', () => {
  const docs = new URL('../docs/', import.meta.url);
  const pages = readdirSync(docs, { recursive: true }).filter((f) => /\.mdx?$/.test(f));
  for (const page of pages) {
    const body = readFileSync(new URL(page, docs), 'utf8');
    assert.doesNotMatch(body, /app developer|app binding|glossary\.md#binding/i, page);
  }
});

test('published pages carry no provenance link or unverified caveat', () => {
  const docs = new URL('../docs/', import.meta.url);
  const pages = readdirSync(docs, { recursive: true });
  assert.ok(!pages.some((f) => /^provenance\./.test(f)), 'provenance page is published');
  for (const page of pages.filter((f) => /\.mdx?$/.test(f))) {
    const body = readFileSync(new URL(page, docs), 'utf8');
    assert.doesNotMatch(body, /provenance|not yet verified/i, page);
  }
});

test('glossary defines no workspace term', () => {
  assert.ok(!entries.some((e) => /workspace/i.test(e.name)));
});
