import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const recipeNames = ['gate-by-capability', 'read-app-context', 'list-members', 'expose-agent-actions', 'add-page-and-capability'];
const nestRecipe = 'nest-adapter';
const pagesIn = (dir) =>
  readdirSync(join(docs, dir))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ path: join(docs, dir, name), name: name.replace(/\.md$/, ''), text: readFileSync(join(docs, dir, name), 'utf8') }));

const recipes = existsSync(join(docs, 'recipes')) ? pagesIn('recipes') : [];
const guides = existsSync(join(docs, 'guides')) ? pagesIn('guides') : [];
const nest = existsSync(join(docs, 'nest')) ? pagesIn('nest') : [];
const all = [...recipes, ...nest, ...guides];

test('has one recipe per ranked task, the Nest recipe in the Nest folder and at least one guide', () => {
  assert.deepEqual(recipes.map((r) => r.name).sort(), [...recipeNames].sort());
  assert.ok(nest.some((page) => page.name === nestRecipe));
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
  assert.ok(recipes.every((r) => /sdr|lead|icp/i.test(r.text)));
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
  const { text } = nest.find((r) => r.name === nestRecipe);
  assert.match(text, /npm run dev:space/);
  assert.match(text, /curl .*localhost:<SERVER_PORT>\/api\/client-config/);
  assert.match(text, /curl .*localhost:<SERVER_PORT>\/api\/manifest\/hello-app/);
});

test('nest-adapter claims no bodyParser setting and warns that the credential store is in memory', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  assert.doesNotMatch(text, /bodyParser/);
  const warning = text.split('\n').filter((line) => /in memory/.test(line) && /loses them on restart/.test(line));
  assert.equal(warning.length, 1);
  assert.match(warning[0], /`AppCredentialStore`/);
  assert.match(warning[0], /your own storage/);
});

test('nest-adapter next step links quickstart Part 2 only', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  const next = text.split(/^## /m).at(-1);
  assert.match(next, /^Next step\n/);
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]), ['../quickstart.md#part-2-add-the-app-to-a-space']);
});

test('every link to nest-adapter points at its Nest folder location', () => {
  for (const path of docFiles(docs)) {
    const text = readFileSync(path, 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)#]*nest-adapter\.md)/g)) {
      assert.match(target, /(^|\/)nest\/nest-adapter\.md$|^\.\/nest-adapter\.md$/, `${path}: ${target}`);
      assert.ok(existsSync(join(dirname(path), target)), `${path}: ${target}`);
    }
  }
});

const expose = recipes.find((r) => r.name === 'expose-agent-actions');
const exposeCode = expose.text.match(/^```tsx?[^\n]*\n[\s\S]*?^```/gm).join('\n');
const exposeSection = (title) => expose.text.split(/^## /m).find((s) => s.startsWith(`${title}\n`));

test('expose-agent-actions starts from recipes/leads-app and installs zod 3', () => {
  assert.match(exposeSection('Prerequisites'), /`recipes\/leads-app\/`/);
  assert.match(expose.text, /^npm install zod@3\b.*$/m);
  assert.doesNotMatch(expose.text, /npm install zod(?!@3)/);
});

test('expose-agent-actions binds the action to a shared page key and names it leads.open_lead_list', () => {
  const pageIds = [...exposeCode.matchAll(/pageId: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(pageIds, ['leads']);
  assert.match(expose.text, /`leads\.open_lead_list`/);
  assert.doesNotMatch(expose.text, /sdr-leads/);
});

test('expose-agent-actions names the catalog command, its entry file and the dev dependency', () => {
  assert.match(expose.text, /^npm install --save-dev vite-node --workspace client$/m);
  assert.match(expose.text, /^npm exec --workspace client -- vs-apps catalog extract scripts\/agent-catalog\.ts$/m);
  assert.match(expose.text, /```ts title="client\/scripts\/agent-catalog\.ts"/);
  assert.match(exposeCode, /extractAgentCatalog/);
  assert.match(exposeCode, /outPath: '\.\.\/server\/agent-catalog\.json'/);
  assert.doesNotMatch(expose.text, /Regenerate `agent-catalog\.json`/);
});

test('expose-agent-actions limits description and mounted-action claims to the SDK', () => {
  assert.doesNotMatch(expose.text, /only guidance/);
  assert.match(expose.text, /The SDK puts it in the manifest, which Space reads\./);
  assert.match(expose.text, /After each successful call, the SDK reports the mounted actions\./);
  assert.doesNotMatch(expose.text, /agent sees `leads/);
});

test('expose-agent-actions next step links agent-action-trees only', () => {
  const next = exposeSection('Next step');
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]), ['../guides/agent-action-trees.md']);
});
