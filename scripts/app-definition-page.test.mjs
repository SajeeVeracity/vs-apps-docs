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
    'Validate on import',
    'Type navigation and routes',
    'Generate and serve the manifest',
    'List agent-callable routes',
    'Merge the [agent catalog](./glossary.md#agent-catalog)',
    "Keep the server's app registry",
    'Check the token',
    'Register connector event handlers',
    'Look up a model slot',
    'Read the manifest in Space',
  ]);
});

test('contrasts definition and manifest and says Space never sees the definition', () => {
  assert.match(text, /hand-written TypeScript/i);
  assert.match(text, /generated JSON/i);
  assert.match(text, /Space never sees the definition/);
});

test('the one mermaid fence sits inside DiagramControls, imported first in the body', () => {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  assert.equal(body.split('\n\n')[0], "import DiagramControls from '@site/src/components/DiagramControls';");
  assert.match(text, /<DiagramControls>\n\n```mermaid\n[\s\S]*?\n```\n\n<\/DiagramControls>\n\n### On import and in the client/);
  assert.equal([...text.matchAll(/<DiagramControls>/g)].length, 1);
  assert.equal([...text.matchAll(/```mermaid/g)].length, 1);
});

test('field rows equal the field-rules table, per object, with no extra rows', () => {
  const rules = [...coreFieldRules, ...resourceFieldRules];
  const documented = [];
  let object = null;
  let inTable = false;
  for (const line of text.split('\n')) {
    const heading = line.match(/^#{2,4} (.+)$/);
    if (heading) {
      object = heading[1] === 'Core fields' ? '' : (heading[1].match(/^`(.+)`$/)?.[1] ?? null);
      inTable = false;
      continue;
    }
    if (object === null) continue;
    if (line === '| Field | Required | Rule |') inTable = true;
    else if (inTable && line.startsWith('| `')) documented.push({ object, row: line });
    else if (!line.startsWith('|')) inTable = false;
  }
  const split = (path) => {
    const i = path.lastIndexOf('.');
    return i < 0 ? ['', path] : [path.slice(0, i), path.slice(i + 1)];
  };
  for (const rule of rules) {
    const [object, field] = split(rule.path);
    const row = `| \`${field}\` | ${rule.required ? 'required' : 'optional'} | ${rule.rule} |`;
    assert.ok(documented.some((d) => d.object === object && d.row === row), `row for ${rule.path}`);
  }
  assert.equal(documented.length, rules.length);
});

test('states the empty capabilities and ungated page rules and the typo warning', () => {
  assert.match(text, /`capabilities: \[\]` is valid/);
  assert.match(text, /page without a capability has no gate/i);
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
  for (const term of ['manifest', 'Space', 'capability', 'model slot', 'connector slot']) {
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
