import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const internalUrl = new URL('../.agents/glossary-internal.md', import.meta.url);
const publishedUrl = new URL('../docs/glossary.md', import.meta.url);

const names = (text) => text.split(/^### /m).slice(1).map((block) => block.split('\n')[0].replace(/\s*\{#.*\}\s*$/, '').trim().toLowerCase());
const internal = readFileSync(internalUrl, 'utf8');

test('internal entries have definition, mapping and owner', () => {
  const blocks = internal.split(/^### /m).slice(1);
  assert.ok(blocks.length > 0);
  for (const block of blocks) {
    const [name, ...rest] = block.split('\n');
    const body = rest.join('\n');
    assert.match(body, /^\S.*$/m, `${name}: definition`);
    assert.match(body, /^- Maps to: .+/m, `${name}: mapping`);
    assert.match(body, /^- Owner: .+/m, `${name}: owner`);
  }
});

test('no term is in both glossaries', () => {
  const published = names(readFileSync(publishedUrl, 'utf8'));
  for (const name of names(internal)) assert.ok(!published.includes(name), `${name} is in both files`);
});

test('internal glossary is outside docs/', () => {
  assert.ok(!internalUrl.pathname.includes('/docs/'));
});
