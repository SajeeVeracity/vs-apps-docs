import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkFences, checkPageVersions, checkSdkPin, checkTree, installedSdkVersion, main, pageTreePaths } from './starter-sync.mjs';

const tree = ['hello-app/', '├── .env.example', '├── client/', '│   ├── index.html', '│   └── src/', '│       └── main.tsx', '└── shared/', '    └── src/', '        └── index.ts'].join('\n');
const page = [
  '```text',
  tree,
  '```',
  '',
  '```ts title="shared/src/index.ts" starter',
  'export const CAPABILITY = \'hello:view\';',
  '```',
  '',
  '```ts title="not-from-starter.ts"',
  'anything',
  '```',
  '',
].join('\n');

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** A starter fixture that satisfies every check against `page`. */
function starter(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'starter-'));
  const pin = (version) => JSON.stringify({ dependencies: { '@vectoragents/vs-apps': version } });
  const files = {
    '.env.example': '',
    'client/index.html': '',
    'client/src/main.tsx': '',
    'shared/src/index.ts': "import x;\nexport const CAPABILITY = 'hello:view';\nexport const y = 1;\n",
    'package.json': '{}',
    'client/package.json': pin('0.2.4'),
    'server/package.json': pin('0.2.4'),
    'shared/package.json': pin('0.2.4'),
    'package-lock.json': JSON.stringify({ packages: { 'node_modules/@vectoragents/vs-apps': { version: '0.2.4' } } }),
    ...overrides,
  };
  for (const [path, content] of Object.entries(files)) if (content !== null) write(root, path, content);
  return root;
}

test('SDK pin: passes when every package.json and the lockfile pin the installed version', () => {
  assert.deepEqual(checkSdkPin(starter(), '0.2.4'), []);
});

test('SDK pin: fails when a package.json pins another version', () => {
  const root = starter({ 'server/package.json': JSON.stringify({ dependencies: { '@vectoragents/vs-apps': '0.2.5' } }) });
  const problems = checkSdkPin(root, '0.2.4');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /server\/package\.json/);
  assert.match(problems[0], /0\.2\.5/);
});

test('SDK pin: fails when the lockfile resolves another version', () => {
  const root = starter({ 'package-lock.json': JSON.stringify({ packages: { 'node_modules/@vectoragents/vs-apps': { version: '0.2.3' } } }) });
  const problems = checkSdkPin(root, '0.2.4');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /package-lock\.json/);
});

test('SDK pin: fails when no file pins the SDK at all', () => {
  const root = starter({ 'client/package.json': '{}', 'server/package.json': '{}', 'shared/package.json': '{}', 'package-lock.json': null });
  assert.equal(checkSdkPin(root, '0.2.4').length, 1);
});

test('installedSdkVersion matches the exact pin in this repo package.json', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(installedSdkVersion(), manifest.dependencies['@vectoragents/vs-apps']);
});

test('fences: passes when the excerpt is a substring of the starter file, and skips fences without starter', () => {
  assert.deepEqual(checkFences(page, starter()), []);
});

test('fences: fails when the excerpt differs from the starter file', () => {
  const root = starter({ 'shared/src/index.ts': "export const CAPABILITY = 'hello:read';\n" });
  const problems = checkFences(page, root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /shared\/src\/index\.ts/);
});

test('fences: fails when the named file is missing from the starter', () => {
  const root = starter({ 'shared/src/index.ts': null });
  assert.match(checkFences(page, root)[0], /missing/);
});

test('pageTreePaths lists files and directories of the cloned-layout tree', () => {
  assert.deepEqual(pageTreePaths(page), [
    '.env.example',
    'client',
    'client/index.html',
    'client/src',
    'client/src/main.tsx',
    'shared',
    'shared/src',
    'shared/src/index.ts',
  ]);
});

test('tree: passes when every listed path exists in the starter', () => {
  assert.deepEqual(checkTree(page, starter()), []);
});

test('tree: fails for each listed path that is missing from the starter', () => {
  const root = starter({ 'client/index.html': null, '.env.example': null });
  const problems = checkTree(page, root);
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => p.includes('client/index.html')));
  assert.ok(problems.some((p) => p.includes('.env.example')));
});

test('the real page has a tree that checkTree can read', () => {
  const real = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
  const paths = pageTreePaths(real);
  for (const path of ['.env.example', 'client/harness.html', 'server/src/auth.ts', 'shared/src/index.ts']) assert.ok(paths.includes(path), path);
});

const silent = { log() {}, warn() {}, error() {} };
const real = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
const failingClone = () => {
  throw new Error('fatal: unable to access');
};

test('main: a clone failure exits 1 when CI is set', async () => {
  assert.equal(await main({ env: { CI: 'true' }, clone: failingClone, ...silent }), 1);
});

test('main: a clone failure warns and exits 0 when CI is unset', async () => {
  const warnings = [];
  const code = await main({ env: {}, clone: failingClone, ...silent, warn: (m) => warnings.push(m) });
  assert.equal(code, 0);
  assert.match(warnings.join('\n'), /skipp/i);
});

test('main: STARTER_DIR is used without cloning, and problems exit 1', async () => {
  const clone = () => assert.fail('clone must not run');
  const bad = starter({ 'client/package.json': JSON.stringify({ dependencies: { '@vectoragents/vs-apps': '9.9.9' } }) });
  assert.equal(await main({ env: { STARTER_DIR: bad }, clone, page: real, ...silent }), 1);
});

test('main: a clean starter exits 0', async () => {
  const clone = () => assert.fail('clone must not run');
  const ok = await main({ env: { STARTER_DIR: starter() }, clone, page, sdkVersion: '0.2.4', ...silent });
  assert.equal(ok, 0);
});

test('page versions: passes when every SDK version string on the pages is the installed version', () => {
  const pages = {
    'docs/quickstart.md': '└── @vectoragents/vs-apps@0.2.4 deduped',
    'docs/reference/harness.md': 'Reference for `@vectoragents/vs-apps/harness` 0.2.4.',
  };
  assert.deepEqual(checkPageVersions(pages, '0.2.4'), []);
});

test('page versions: fails for each string that names another version', () => {
  const pages = {
    'docs/quickstart.md': '├── @vectoragents/vs-apps@0.2.3\n└── @vectoragents/vs-apps@0.2.4',
    'docs/reference/harness.md': 'Reference for `@vectoragents/vs-apps/harness` 0.2.3.',
  };
  const problems = checkPageVersions(pages, '0.2.4');
  assert.equal(problems.length, 2);
  assert.match(problems[0], /docs\/quickstart\.md/);
  assert.match(problems[1], /docs\/reference\/harness\.md/);
});

test('page versions: the real quickstart and harness pages name the installed version', () => {
  assert.deepEqual(checkPageVersions(undefined, installedSdkVersion()), []);
});

test('main: a page with a stale SDK version exits 1', async () => {
  const stale = { 'docs/quickstart.md': '@vectoragents/vs-apps@0.1.0' };
  const code = await main({ env: { STARTER_DIR: starter() }, page, sdkVersion: '0.2.4', versionPages: stale, ...silent });
  assert.equal(code, 1);
});
