import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const recipeNames = ['gate-by-capability', 'read-app-context', 'list-members', 'expose-agent-actions', 'add-page-and-capability', 'nest-adapter'];
const pagesIn = (dir) =>
  readdirSync(join(docs, dir))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ path: join(docs, dir, name), name: name.replace(/\.md$/, ''), text: readFileSync(join(docs, dir, name), 'utf8') }));

const recipes = existsSync(join(docs, 'recipes')) ? pagesIn('recipes') : [];
const guides = existsSync(join(docs, 'guides')) ? pagesIn('guides') : [];
const all = [...recipes, ...guides];

test('has one recipe per ranked task and at least one guide', () => {
  assert.deepEqual(recipes.map((r) => r.name).sort(), [...recipeNames].sort());
  assert.ok(guides.length >= 1);
});

test('every page follows the template and ends with a result and a next step', () => {
  for (const { name, text } of all) {
    const titles = text.split(/^## /m).slice(1).map((s) => s.split('\n')[0]);
    assert.deepEqual([titles[0], titles[1], titles[2]], ['Goal', 'Prerequisites', 'Steps'], name);
    assert.deepEqual(titles.slice(-2), ['Result', 'Next step'], name);
    assert.match(text, /^---\ntitle: .+\n---\n/, name);
  }
});

test('every ts and tsx block is a labelled complete file with no ellipsis', () => {
  for (const { name, text } of all) {
    const code = [...text.matchAll(/^```(tsx?)([^\n]*)\n([\s\S]*?)^```/gm)];
    assert.ok(code.length >= 1, name);
    for (const [, , meta, body] of code) {
      assert.match(meta, /title="[\w./-]+"/, name);
      assert.doesNotMatch(body, /\.\.\.|…/, name);
    }
  }
});

test('links the reference, the quickstart and the glossary, and every link resolves', () => {
  for (const { path, name, text } of all) {
    assert.match(text, /\]\([./]+\/reference\/[\w-]+\.md/, name);
    assert.match(text, /\]\([./]+\/quickstart\.md/, name);
    assert.match(text, /\]\([./]+\/glossary\.md#[\w-]+\)/, name);
    for (const [, target] of text.matchAll(/\]\((\.[^)#]*\.md)(?:#[^)]*)?\)/g)) {
      assert.ok(existsSync(join(dirname(path), target)), `${name}: ${target}`);
    }
  }
});

test('never uses the csr-agents page and uses SDR examples', () => {
  for (const { name, text } of all) {
    assert.doesNotMatch(text, /csr-agents|csr:agents|csr\.agents/i, name);
  }
  // nest-adapter mirrors the quickstart hello-app, which has no SDR example.
  assert.ok(recipes.filter((r) => r.name !== 'nest-adapter').every((r) => /sdr|lead|icp/i.test(r.text)));
});

test('follows the writing standard', () => {
  for (const { name, text } of all) {
    assert.doesNotMatch(text, /—|–/, name);
    assert.doesNotMatch(text, /\b(we|our|let's)\b/i, name);
    assert.doesNotMatch(text, /\b(simply|just|easy|easily)\b/i, name);
  }
});

test('shell blocks have no prompt and one command per line', () => {
  for (const { name, text } of all) {
    for (const [, body] of text.matchAll(/^```bash\n([\s\S]*?)^```/gm)) {
      for (const line of body.trim().split('\n')) {
        assert.doesNotMatch(line, /^\$ /, name);
        assert.doesNotMatch(line, /&&|;\s*\w|\\$/, name);
      }
    }
  }
});

const docFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return docFiles(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });

test('no page names a script the starter lacks or the old Part 2 anchor', () => {
  for (const path of docFiles(docs)) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /check:server|dev:server|#part-2-add-the-app-to-space\b/, path);
  }
});

test('nest-adapter checks the server with dev:space and two curl lines', () => {
  const { text } = recipes.find((r) => r.name === 'nest-adapter');
  assert.match(text, /npm run dev:space/);
  assert.match(text, /curl .*localhost:<SERVER_PORT>\/api\/client-config/);
  assert.match(text, /curl .*localhost:<SERVER_PORT>\/api\/manifest\/hello-app/);
});
