import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSnippets } from './check-snippets.mjs';
import { coreFieldRules, resourceFieldRules } from '../src/data/field-rules.ts';

const pageUrl = new URL('../docs/app-definition.md', import.meta.url);
const text = readFileSync(pageUrl, 'utf8');
const headings = [...text.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1]);

test('answers the four questions', () => {
  for (const h of ['What an app definition is', 'What an app definition does', 'How to write one', 'How it reflects in Space']) {
    assert.ok(headings.includes(h), h);
  }
});

test('states each of the ten uses once, in order', () => {
  const uses = [...text.matchAll(/^\d+\. \*\*(.+?)\.\*\*/gm)].map((m) => m[1]);
  assert.deepEqual(uses, [
    'Import-time validation',
    'Manifest generation and serving',
    'Agent-callable endpoint exposure',
    'Agent-catalog merge',
    'Server app registry',
    'Token-scoped surface guards',
    'Connector-event handler wiring',
    'Model-slot lookup',
    'Client nav and route typing',
    'Space-side use of the manifest',
  ]);
});

test('contrasts definition and manifest and says Space never sees the definition', () => {
  assert.match(text, /hand-written TypeScript/i);
  assert.match(text, /generated JSON/i);
  assert.match(text, /Space never sees the definition/);
});

test('field rows equal the field-rules table, with no extra rows', () => {
  const rules = [...coreFieldRules, ...resourceFieldRules];
  for (const rule of rules) {
    const row = `| \`${rule.path}\` | ${rule.required ? 'required' : 'optional'} | ${rule.rule} |`;
    assert.ok(text.split('\n').includes(row), `row for ${rule.path}`);
  }
  const documented = [...text.matchAll(/^\| `((?:resources|pages|capabilities|key|name|version|defaultPageKey)[^`]*)` \|/gm)].map((m) => m[1]);
  assert.deepEqual(documented.sort(), rules.map((r) => r.path).sort());
});

test('states the empty capabilities and ungated page rules and the typo warning', () => {
  assert.match(text, /`capabilities: \[\]` is valid/);
  assert.match(text, /page without a capability is ungated/i);
  assert.match(text, /:::warning[\s\S]*does not check[\s\S]*:::/);
});

test('states what the SDK guarantees and what is Space-side, and the pending review', () => {
  assert.match(text, /### SDK guarantees/);
  assert.match(text, /### Space-side/);
  assert.match(text, /pending/i);
});

test('does not claim unverified nav behaviour for a page without a capability', () => {
  assert.doesNotMatch(text, /without a capability[^.]*\b(appears|shows|listed|visible) in the (Space )?nav/i);
});

test('leaves deferred fields undocumented', () => {
  assert.doesNotMatch(text, /`(contract|acts|approvals|retrieval|datasource)`/);
});

test('links each glossary term at first use only', () => {
  for (const term of ['app definition', 'manifest', 'Space', 'page', 'capability', 'model slot', 'connector slot']) {
    const slug = term.toLowerCase().replaceAll(' ', '-');
    const links = text.split(`](./glossary.md#${slug})`).length - 1;
    assert.equal(links, 1, `${term} linked ${links} times`);
  }
});

test('links the builder', () => {
  assert.match(text, /\]\(\/builder\)/);
});

test('follows the writing standard', () => {
  assert.doesNotMatch(text, /—|–/);
  assert.doesNotMatch(text, /\b(we|our|ours|us)\b/i);
});

test('every snippet typechecks against the installed package', () => {
  const dir = mkdtempSync(join(tmpdir(), 'appdef-'));
  copyFileSync(pageUrl, join(dir, 'app-definition.md'));
  const result = checkSnippets({ docsDir: dir, stampFile: join(dir, 'stamp.json') });
  assert.equal(result.output, '');
  assert.ok(result.count >= 2, `snippets: ${result.count}`);
});
