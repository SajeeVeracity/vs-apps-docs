import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const recipeNames = ['gate-by-capability', 'read-app-context', 'list-members', 'expose-agent-actions', 'add-page-and-capability'];
const nestRecipe = 'nest-adapter';
const openRouteGuide = 'open-route-and-read-caller';
const pagesIn = (dir) =>
  readdirSync(join(docs, dir))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ path: join(docs, dir, name), name: name.replace(/\.md$/, ''), text: readFileSync(join(docs, dir, name), 'utf8') }));

const recipes = existsSync(join(docs, 'recipes')) ? pagesIn('recipes') : [];
const guides = existsSync(join(docs, 'guides')) ? pagesIn('guides') : [];
const nest = existsSync(join(docs, 'nest')) ? pagesIn('nest') : [];
const all = [...recipes, ...nest, ...guides];

test('has one recipe per ranked task, the Nest recipe and the open-route guide in the Nest folder and at least one guide', () => {
  assert.deepEqual(recipes.map((r) => r.name).sort(), [...recipeNames].sort());
  assert.ok(nest.some((page) => page.name === nestRecipe));
  assert.ok(nest.some((page) => page.name === openRouteGuide));
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

const gate = recipes.find((r) => r.name === 'gate-by-capability');
const section = (text, title) => text.split(/^## /m).find((s) => s.startsWith(`${title}\n`)) ?? '';

test('gate-by-capability starts from the leads-app start folder of the starter', () => {
  const prerequisites = section(gate.text, 'Prerequisites');
  assert.match(prerequisites, /`recipes\/leads-app`/);
  assert.match(prerequisites, /git clone https:\/\/github\.com\/VectorAgents\/vector-app-quickstart\.git/);
});

test('gate-by-capability snippets use only the shared page and capability keys', () => {
  const code = [...gate.text.matchAll(/^```tsx?[^\n]*\n([\s\S]*?)^```/gm)].map(([, body]) => body).join('\n');
  const keys = (pattern) => [...code.matchAll(pattern)].map(([, key]) => key);
  assert.deepEqual(keys(/\bkey: '([^']+)'/g).filter((k) => !['hello-app', 'home', 'leads', 'icp', 'hello:view', 'lead:manage', 'icp:manage'].includes(k)), []);
  assert.deepEqual(keys(/\bcapability(?:: |=)['"]([^'"]+)['"]/g).filter((k) => !['hello:view', 'lead:manage', 'icp:manage'].includes(k)), []);
  assert.doesNotMatch(gate.text, /sdr/i);
});

test('gate-by-capability closes by sharing one fallback across at least two pages', () => {
  const steps = section(gate.text, 'Steps').split(/^### /m).slice(1);
  assert.match(steps.at(-1), /^\d+\. Share one fallback across pages\n/);
  assert.equal([...steps.at(-1).matchAll(/^```tsx title="client\/src\/\w+\.tsx"/gm)].length >= 2, true);
  assert.ok([...gate.text.matchAll(/<GatedPage\b/g)].length >= 2);
  assert.equal([...gate.text.matchAll(/fallback=/g)].length, 2);
});

test('gate-by-capability ends with one Next step: read-app-context', () => {
  const next = section(gate.text, 'Next step');
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map(([, link]) => link), ['./read-app-context.md']);
});

test('nest-adapter claims no bodyParser setting and warns that the credential store is in memory', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  assert.doesNotMatch(text, /bodyParser/);
  const warning = text.split('\n').filter((line) => /in memory/.test(line) && /loses them on restart/.test(line));
  assert.equal(warning.length, 1);
  assert.match(warning[0], /`AppCredentialStore`/);
  assert.match(warning[0], /your own storage/);
});

test('nest-adapter next step links quickstart Part 2, then the open-route guide', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  const next = text.split(/^## /m).at(-1);
  assert.match(next, /^Next step\n/);
  assert.deepEqual(
    [...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]),
    ['../quickstart.md#part-2-add-the-app-to-a-space', `./${openRouteGuide}.md`],
  );
});

test('Nest pages share one snippet project, so no two Nest pages use the same snippet title', () => {
  const owners = new Map();
  for (const { name, text } of nest) {
    for (const [, title] of text.matchAll(/^```(?:tsx?|json)[^\n]*title="([^"]+)"/gm)) {
      assert.ok(!owners.has(title) || owners.get(title) === name, `${title} is in ${owners.get(title)} and ${name}`);
      owners.set(title, name);
    }
  }
});

const guide = () => nest.find((r) => r.name === openRouteGuide)?.text ?? '';
const section = (text, heading) => text.split(/^## /m).find((s) => s.startsWith(`${heading}\n`)) ?? '';

test('the open-route guide names nest-adapter as its prerequisite', () => {
  assert.match(section(guide(), 'Prerequisites'), /\]\(\.\/nest-adapter\.md\)/);
});

test('the open-route guide shows @Public, appCaller and AppRequest in labelled server files', () => {
  const code = [...guide().matchAll(/^```tsx?\s+title="(server\/[^"]+)"\n([\s\S]*?)^```/gm)];
  assert.ok(code.length >= 1);
  const body = code.map(([, , b]) => b).join('\n');
  assert.match(body, /@Public\(\)/);
  assert.match(body, /\bappCaller\(/);
  assert.match(body, /\bAppRequest\b/);
  assert.match(body, /\bimport \{[^}]*\bappCaller\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
});

test('the open-route guide checks that the open route answers 200 and the caller route answers 401 with no token', () => {
  const steps = section(guide(), 'Steps');
  const curls = [...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/([\w-]+)$/gm)].map((m) => m[1]);
  assert.equal(curls.length, 2);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`200`[^\n]*`401`/);
});

test('the open-route guide next step links one related page', () => {
  const next = section(guide(), 'Next step');
  const links = [...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(links.length, 1);
  assert.ok(existsSync(join(docs, 'nest', links[0].split('#')[0])), links[0]);
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
