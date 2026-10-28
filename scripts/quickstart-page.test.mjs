import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { steViolations } from './ste.mjs';

const text = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
const sections = text.split(/^## /m).slice(1);
const titles = sections.map((s) => s.split('\n')[0]);
const fences = [...text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)].map(([, lang, meta, body]) => ({ lang, meta, body }));
const part1 = sections.find((s) => s.startsWith('Part 1'));
const steps = (part) => part.split(/^### /m).slice(1);
const count = (re) => (text.match(re) ?? []).length;

test('follows the writing rules checked by steViolations', () => {
  assert.deepEqual(steViolations(text), []);
});

test('follows the page order up to Part 1', () => {
  assert.deepEqual(titles.slice(0, 4), ['Goal', 'Prerequisites', 'Final layout', 'Part 1: Build and run the app']);
  assert.equal(titles.at(-1), 'Next steps');
});

test('opens with an intro of two sentences that links the monorepo', () => {
  const intro = text.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n\n')[0];
  assert.equal(intro.split(/(?<=[.!?])\s+/).length, 2);
  assert.match(intro, /\(\.\/glossary\.md#monorepo\)/);
});

test('prerequisites are two checklists and state the baseline once', () => {
  const prerequisites = sections.find((s) => s.startsWith('Prerequisites'));
  assert.match(prerequisites, /^Space side:\n\n- \[ \] /m);
  assert.match(prerequisites, /^App side:\n\n- \[ \] /m);
  const items = prerequisites.split('\n').filter((l) => /^- /.test(l));
  assert.ok(items.length >= 2);
  for (const line of items) assert.match(line, /^- \[ \] /);
  assert.match(prerequisites, /Node\.js 20\.19/);
  assert.match(prerequisites, /`read:packages`/);
  assert.equal(count(/20\.19/g), 1);
  assert.doesNotMatch(prerequisites, /React 18|TypeScript 5/);
});

test('the final layout shows the three packages as a tree', () => {
  const layout = sections.find((s) => s.startsWith('Final layout'));
  assert.match(layout, /^hello-app\/$/m);
  for (const name of ['client/', 'server/', 'shared/', 'tsconfig.base.json', '.npmrc', '.env']) {
    assert.ok(layout.includes(name), name);
  }
});

test('the packages and their scripts are defined once', () => {
  for (const name of ['client', 'server', 'shared']) assert.equal(count(new RegExp(`"name": "@hello-app/${name}"`, 'g')), 1, name);
  for (const script of ['dev:server', 'dev:client', 'check:server']) {
    assert.equal(count(new RegExp(`^    "${script}": `, 'gm')), 1, script);
  }
  assert.equal(count(/"typecheck": "npm run typecheck --workspaces --if-present"/g), 1);
  assert.match(text, /^npm install$/m);
  assert.match(text, /"@vectoragents\/vs-apps": "0\.2\.4"/);
  assert.doesNotMatch(text, /catalog:|workspace:/);
  assert.match(text, /title="\.npmrc"/);
  assert.match(text, /scope, a registry URL and a token/);
});

test('step 2 uses the shared-package typecheck', () => {
  assert.match(steps(part1)[1], /npm run typecheck --workspace @hello-app\/shared/);
});

test('the server is a node:http handler on the /server subpath', () => {
  assert.match(text, /from 'node:http'/);
  for (const s of ['createSpaceTokenVerifier', 'extractBearer', 'assertCapability', 'verifyAppUserToken', 'verifyProvisioningToken']) {
    assert.match(text, new RegExp(s), s);
  }
  assert.doesNotMatch(text, /@vectoragents\/vs-apps\/nest/);
});

test('the client runs on Vite with ports and proxy taken from .env', () => {
  assert.match(text, /^npm run dev:client$/m);
  assert.match(text, /title="client\/vite\.config\.ts"/);
  assert.match(text, /title="client\/index\.html"/);
  assert.match(text, /"dev": "node --env-file=\.\.\/\.env /);
});

test('every Part 1 step ends with a Check followed by its result', () => {
  const list = steps(part1);
  assert.deepEqual(list.map((s) => s.match(/^(\d+)\. /)?.[1]), list.map((_, i) => String(i + 1)));
  for (const step of list) {
    const after = step.split(/^\*\*Check\*\*/m).at(-1);
    assert.ok(step.includes('**Check**'), step.split('\n')[0]);
    assert.match(after, /\n\n(```|- )/, step.split('\n')[0]);
  }
});

test('the first Check line follows the step command', () => {
  assert.match(text, /^\*\*Check\*\*: run `npm ls @vectoragents\/vs-apps`/m);
  assert.match(text, /^\{"keys":\[$/m);
  assert.match(text, /^client-config 200\nmanifest\/hello-app 401$/m);
  assert.match(text, /^hello 401\nprovision 401$/m);
  assert.match(text, /^Waiting for Space\.$/m);
});

test('every ts and tsx block is a labelled file with no ellipsis', () => {
  const code = fences.filter((f) => f.lang === 'ts' || f.lang === 'tsx');
  assert.ok(code.length >= 8);
  for (const f of code) {
    assert.match(f.meta, /title="[\w./-]+"/);
    assert.doesNotMatch(f.body, /\.\.\.|…/);
  }
});

test('step 4 adds blocks to main.ts', () => {
  const adds = fences.filter((f) => /\badd\b/.test(f.meta.replace(/title="[^"]*"/, '')));
  assert.ok(adds.length >= 2);
  for (const f of adds) assert.match(f.meta, /title="server\/src\/main\.ts"/);
});

test('shell blocks have no prompt and one command per line', () => {
  const shell = fences.filter((f) => f.lang === 'bash');
  assert.ok(shell.length >= 3);
  for (const f of shell) {
    for (const line of f.body.trim().split('\n')) {
      assert.doesNotMatch(line, /^\$ /);
      assert.doesNotMatch(line, /&&|;\s*\w|\\$/);
    }
  }
});

test('each .env value is appended once, in the step that first uses it', () => {
  const list = steps(part1);
  assert.equal(count(/export GITHUB_PACKAGES_TOKEN=/g), 1);
  assert.match(list[0], /export GITHUB_PACKAGES_TOKEN=/);
  for (const name of ['SPACE_JWKS_URL', 'ALLOWED_PARENT_ORIGIN', 'PUBLIC_BASE_URL', 'SERVER_PORT']) {
    assert.equal(count(new RegExp(`^${name}=`, 'gm')), 1, name);
    assert.match(list[2], new RegExp(`^${name}=`, 'm'), name);
    assert.doesNotMatch(text, new RegExp(`export ${name}=`));
  }
  assert.equal(count(/^SERVER_PORT=3001$/gm), 1);
  assert.equal(count(/CLIENT_PORT=5173/g), 1);
  assert.match(list[5], /^echo CLIENT_PORT=5173 >> \.env$/m);
  assert.doesNotMatch(text, /SPACE_BASE_URL/);
  assert.doesNotMatch(text, /_authToken=[A-Za-z0-9_]{20,}/);
});

test('the key-set URL has the /api prefix, a Check and the port-clash note', () => {
  const step3 = steps(part1)[2];
  assert.match(step3, /^SPACE_JWKS_URL=\S*\/api\/\.well-known\/apps\/jwks\.json$/m);
  assert.match(step3, /\{"keys":\[/);
  assert.match(step3, /port 3001 is busy/);
});

test('shows one page gated by one capability', () => {
  assert.match(text, /hello:view/);
  assert.match(text, /RequireCapability/);
  assert.equal(count(/'hello:view'/g), 1);
});

test('covers the client and server symbols', () => {
  for (const s of ['defineApp', 'buildManifests', 'AppProvider', 'BootGate', 'loadAppClientConfig', 'RequireCapability']) {
    assert.match(text, new RegExp(s), s);
  }
  assert.match(text, /import \{ definition \} from '@hello-app\/shared';|import \{ CAPABILITY \} from '@hello-app\/shared';/);
});

test('links the concept page and glossary terms once at first use', () => {
  assert.match(text, /\(\.\/app-definition\.md\)/);
  for (const a of ['app-definition', 'manifest', 'space', 'capability', 'page', 'staff', 'space-manager', 'monorepo', 'shared-package']) {
    assert.match(text, new RegExp(`\\(\\./glossary\\.md#${a}\\)`), a);
  }
  for (const a of ['monorepo', 'shared-package']) assert.equal(count(new RegExp(`glossary\\.md#${a}\\)`, 'g')), 1, a);
});

test('follows the writing standard and makes no STE claim', () => {
  assert.doesNotMatch(text, /—|–/);
  assert.doesNotMatch(text, /\b(we|our|let's)\b/i);
  assert.doesNotMatch(text, /\b(simply|just|easy|easily)\b/i);
  assert.doesNotMatch(text, /\bSTE\b|ASD-STE100/);
});

test('has the Quickstart frontmatter title', () => {
  assert.match(text, /^---\ntitle: Quickstart\n/);
});
