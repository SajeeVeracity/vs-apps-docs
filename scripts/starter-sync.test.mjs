import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkCodeBlocks, checkEnvExamples, checkEnvVars, checkFlavourSet, checkPageVersions, checkPorts, checkSdkPin, checkTree, cliCommand, installedSdkVersion, main, pageTreePaths, readPages, readTemplates, startOf, usedEnvNames } from './starter-sync.mjs';

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
  '### 2. Run the app in the harness',
  '',
  '`npm run dev` starts the server on port 3101 and Vite on port 5173.',
  '',
].join('\n');

const PRESET = "const SERVER_PORT = '3101';\nconst HARNESS = {\n  SERVER_PORT,\n  CLIENT_PORT: '5173',\n};\n";

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** A generated-project fixture that satisfies every check against `page`. */
function starter(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'starter-'));
  const pin = (version) => JSON.stringify({ dependencies: { '@vectoragents/vs-apps': version } });
  const files = {
    '.env.example': '',
    'scripts/env-preset.mjs': PRESET,
    'client/index.html': '',
    'client/src/main.tsx': '',
    'shared/src/index.ts': "import x;\nexport const CAPABILITY = 'hello:view';\nexport const y = 1;\n",
    'package.json': '{}',
    'client/package.json': pin('0.2.4'),
    'server/package.json': pin('0.2.4'),
    'shared/package.json': pin('0.2.4'),
    ...overrides,
  };
  for (const [path, content] of Object.entries(files)) if (content !== null) write(root, path, content);
  return root;
}

test('SDK pin: passes when every package.json pins the installed version', () => {
  assert.deepEqual(checkSdkPin(starter(), '0.2.4'), []);
});

test('SDK pin: fails when a package.json pins another version', () => {
  const root = starter({ 'server/package.json': JSON.stringify({ dependencies: { '@vectoragents/vs-apps': '0.2.5' } }) });
  const problems = checkSdkPin(root, '0.2.4');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /server\/package\.json/);
  assert.match(problems[0], /0\.2\.5/);
});

test('SDK pin: fails when no file pins the SDK at all', () => {
  const root = starter({ 'client/package.json': '{}', 'server/package.json': '{}', 'shared/package.json': '{}' });
  assert.equal(checkSdkPin(root, '0.2.4').length, 1);
});

test('installedSdkVersion matches the exact pin in this repo package.json', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(installedSdkVersion(), manifest.dependencies['@vectoragents/vs-apps']);
});

test('code blocks: passes when the excerpt is a substring of the starter file, and skips code blocks without starter', () => {
  assert.deepEqual(checkCodeBlocks(page, starter()), []);
});

test('code blocks: fails when the excerpt differs from the starter file', () => {
  const root = starter({ 'shared/src/index.ts': "export const CAPABILITY = 'hello:read';\n" });
  const problems = checkCodeBlocks(page, root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /shared\/src\/index\.ts/);
});

test('code blocks: fails when the named file is missing from the starter', () => {
  const root = starter({ 'shared/src/index.ts': null });
  assert.match(checkCodeBlocks(page, root)[0], /missing/);
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

const real = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
const runStep = (text) => ['### 2. Run the app in the harness', '', text, ''].join('\n');

test('ports: passes when the run step names the starter server and client ports', () => {
  assert.deepEqual(checkPorts(page, starter()), []);
});

test('ports: fails when the run step names a stale server port', () => {
  const stale = runStep('`npm run dev` starts the server on port 3001 and Vite on port 5173.');
  const problems = checkPorts(stale, starter());
  assert.equal(problems.length, 1);
  assert.match(problems[0], /port 3101/);
});

test('ports: fails when the run step names a stale client port', () => {
  const stale = runStep('`npm run dev` starts the server on port 3101 and Vite on port 5174.');
  assert.match(checkPorts(stale, starter())[0], /port 5173/);
});

test('ports: only the run step counts, wherever it sits and however it is numbered', () => {
  const elsewhere = ['## Goal', 'Port 3101 and port 5173 appear here only.', '', '### Run the app in the harness', 'Nothing here.', '', '### Next', 'port 3101 port 5173'].join('\n');
  assert.equal(checkPorts(elsewhere, starter()).length, 2);
  const moved = ['### 1. Run the app in the harness', 'Server on port 3101, Vite on port 5173.', '', '### 2. Read the app definition', 'Port 9999.'].join('\n');
  assert.deepEqual(checkPorts(moved, starter()), []);
});

test('ports: a longer number that starts with the port is not a match', () => {
  const stale = runStep('`npm run dev` starts the server on port 31011 and Vite on port 5173.');
  assert.match(checkPorts(stale, starter())[0], /port 3101/);
});

test('ports: a comment line inside a code block does not end the run step', () => {
  const withCodeBlock = ['### 2. Run the app in the harness', '', '```bash', '# start the dev servers', 'npm run dev', '```', '', 'Server on port 3101, Vite on port 5173.', '', '### 3. Next', ''].join('\n');
  assert.deepEqual(checkPorts(withCodeBlock, starter()), []);
});

test('ports: a page without the run step fails', () => {
  assert.match(checkPorts('## Goal', starter())[0], /no run step/);
});

test('ports: fails when the starter preset lacks a port', () => {
  const root = starter({ 'scripts/env-preset.mjs': 'export const x = 1;\n' });
  assert.match(checkPorts(page, root)[0], /SERVER_PORT/);
});

test('ports: the real page run step names the starter ports', () => {
  assert.deepEqual(checkPorts(real, starter()), []);
});

const ENV_EXAMPLE = 'SPACE_API_URL=https://space-api.example.com/api\nALLOWED_PARENT_ORIGIN=https://space.example.com\nPUBLIC_BASE_URL=https://hello-app.example.com\n';
const envPage = 'For example `https://space.example.com` and `https://hello-app.example.com`.';

test('env example: passes when each example origin on the page is in the starter .env.example', () => {
  assert.deepEqual(checkEnvExamples(envPage, starter({ '.env.example': ENV_EXAMPLE })), []);
});

test('env example: fails for each page origin the starter .env.example lacks', () => {
  const problems = checkEnvExamples(envPage, starter({ '.env.example': 'PUBLIC_BASE_URL=https://hello-app.example.com\n' }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /https:\/\/space\.example\.com/);
});

test('env example: fails when the starter has no .env.example', () => {
  assert.equal(checkEnvExamples(envPage, starter({ '.env.example': null })).length, 2);
});

test('env example: a page with no example origin passes', () => {
  assert.deepEqual(checkEnvExamples(page, starter()), []);
});

test('env example: the real page origins are in the starter example', () => {
  assert.deepEqual(checkEnvExamples(real, starter({ '.env.example': ENV_EXAMPLE })), []);
  assert.ok(['https://space.example.com', 'https://hello-app.example.com', 'https://space-api.example.com'].every((origin) => real.includes(origin)));
});

const envStarter = (example) => starter({ '.env.example': example });
const codeBlock = (lang, ...lines) => ['```' + lang, ...lines, '```'].join('\n');
const docPage = (...parts) => ({ 'docs/guides/x.md': parts.join('\n\n') });

test('env vars: pass when inline code and process.env names are in the starter .env.example', () => {
  const pages = docPage('Set `SPACE_API_URL` in `.env`.', codeBlock('ts', 'const u = process.env.PUBLIC_BASE_URL;'));
  assert.deepEqual(checkEnvVars(pages, envStarter('SPACE_API_URL=a\nPUBLIC_BASE_URL=b\n')), []);
});

test('env vars: fail for an inline-code name the starter lacks, and name the page and the variable', () => {
  const problems = checkEnvVars(docPage('Set `SPACE_BASE_URL` in `.env`.'), envStarter('SPACE_API_URL=a\n'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /docs\/guides\/x\.md/);
  assert.match(problems[0], /SPACE_BASE_URL/);
});

test('env vars: fail for a process.env name in a code block that the starter lacks', () => {
  const problems = checkEnvVars(docPage(codeBlock('ts', 'const k = process.env.MODEL_API_KEY;')), envStarter('SPACE_API_URL=a\n'));
  assert.match(problems[0], /MODEL_API_KEY/);
});

test('env vars: a name that the page assigns in a shell code block needs no starter entry', () => {
  const pages = docPage(codeBlock('bash', "echo 'MODEL_API_KEY=YOUR_KEY' >> .env"), codeBlock('ts', 'const k = process.env.MODEL_API_KEY;'));
  assert.deepEqual(checkEnvVars(pages, envStarter('')), []);
});

test('env vars: a name that another page assigns does not count', () => {
  const pages = { ...docPage('Read `MODEL_API_KEY`.'), 'docs/guides/y.md': codeBlock('bash', 'MODEL_API_KEY=1') };
  assert.equal(checkEnvVars(pages, envStarter('')).length, 1);
});

test('env vars: a name that the starter .npmrc reads counts as known', () => {
  const root = starter({ '.npmrc': '//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}\n' });
  assert.deepEqual(checkEnvVars(docPage('Export `GITHUB_PACKAGES_TOKEN`.'), root), []);
});

test('env vars: placeholders in code blocks, error codes and plain words are not variables', () => {
  const pages = docPage('The call returns `UNAVAILABLE_ACTION`. Use `CAPABILITY` and `Result`.', codeBlock('bash', 'curl http://localhost:<SERVER_PORT>/api'));
  assert.deepEqual(checkEnvVars(pages, envStarter('')), []);
});

test('env vars: the real pages use names that the extractor finds', () => {
  const names = usedEnvNames(readFileSync(new URL('../docs/guides/call-space-from-your-server.md', import.meta.url), 'utf8'));
  assert.ok(names.includes('SPACE_API_URL'));
});

const silent = { log() {}, warn() {}, error() {} };
const failingClone = () => {
  throw new Error('fatal: unable to access');
};

const config = {
  docsRoot: 'docs',
  outDir: 'docs-gen',
  axes: { client: { react: 'React' }, server: { node: 'Node.js + TypeScript', nest: 'Nest.js' } },
  defaults: { client: 'react', server: 'node' },
};

/** A starter checkout fixture that holds one template directory with a manifest per name. */
function starterRepo(names = ['client-react', 'server-node', 'server-nest']) {
  const root = mkdtempSync(join(tmpdir(), 'starter-repo-'));
  for (const name of names) {
    const row = name.split('-')[0];
    write(root, `templates/${name}/flavour.json`, JSON.stringify({ schemaVersion: 1, row, label: name, dev: 'x', needsShared: false }));
  }
  write(root, 'templates/base/package.json', '{}');
  return root;
}

/** Stands in for the CLI: copies a project fixture into `dir` and records each call. `projects` maps `client+server+start` to overrides. */
function fakeScaffold(projects = {}) {
  const calls = [];
  const scaffold = ({ dir, client, server, start }) => {
    calls.push(`${client}+${server}+${start}`);
    cpSync(starter(projects[`${client}+${server}+${start}`]), dir, { recursive: true });
  };
  return { scaffold, calls };
}

const record = (over = {}) => ({ source: 'quickstart.md', path: 'docs/quickstart.md', text: page, pair: { client: 'react', server: 'node' }, start: 'hello', ...over });
const noPages = { pages: [] };
const run = (over = {}) => main({ env: { STARTER_DIR: starterRepo() }, config, manifest: noPages, pages: [record()], sdkVersion: '0.2.4', ...fakeScaffold(), ...silent, ...over });

test('main: a clone failure exits 1 when CI is set', async () => {
  assert.equal(await main({ env: { CI: 'true' }, clone: failingClone, ...silent }), 1);
});

test('main: a clone failure warns and exits 0 when CI is unset', async () => {
  const warnings = [];
  const code = await main({ env: {}, clone: failingClone, ...silent, warn: (m) => warnings.push(m) });
  assert.equal(code, 0);
  assert.match(warnings.join('\n'), /skipp/i);
});

test('main: STARTER_DIR is used without cloning', async () => {
  assert.equal(await run({ clone: () => assert.fail('clone must not run') }), 0);
});

test('main: runs the CLI once per pair, with the hello start', async () => {
  const { scaffold, calls } = fakeScaffold();
  assert.equal(await run({ scaffold }), 0);
  assert.deepEqual(calls.sort(), ['react+nest+hello', 'react+node+hello']);
});

test('main: a pair whose flavour has no template is not scaffolded', async () => {
  const { scaffold, calls } = fakeScaffold();
  assert.equal(await run({ scaffold, env: { STARTER_DIR: starterRepo(['client-react', 'server-node']) } }), 0);
  assert.deepEqual(calls, ['react+node+hello']);
});

test('main: a page that asks for the overlay is checked against the overlay project', async () => {
  const { scaffold, calls } = fakeScaffold({ 'react+node+leads-app': { 'client/src/LeadsPage.tsx': 'export {};\n' } });
  const leads = record({ source: 'guides/leads.md', path: 'docs/guides/leads.md', start: 'leads-app', text: '```tsx title="client/src/LeadsPage.tsx" starter\nexport {};\n```\n' });
  assert.equal(await run({ scaffold, pages: [leads] }), 0);
  assert.ok(calls.includes('react+node+leads-app'));
  const stale = record({ source: 'guides/leads.md', path: 'docs/guides/leads.md', start: 'leads-app', text: '```tsx title="client/src/LeadsPage.tsx" starter\nother\n```\n' });
  assert.equal(await run({ scaffold, pages: [stale] }), 1);
});

test('main: problems name the page and the pair', async () => {
  const errors = [];
  const stale = record({ path: 'docs-gen/react/nest/quickstart.md', pair: { client: 'react', server: 'nest' }, text: page.replace('port 3101', 'port 3001') });
  assert.equal(await run({ pages: [stale], error: (m) => errors.push(m) }), 1);
  assert.match(errors.join('\n'), /docs-gen\/react\/nest\/quickstart\.md \(react\+nest\).*port 3101/);
});

test('main: every pair is checked for the SDK pin, even without a page', async () => {
  const bad = { 'server/package.json': JSON.stringify({ dependencies: { '@vectoragents/vs-apps': '9.9.9' } }) };
  const errors = [];
  const { scaffold } = fakeScaffold({ 'react+nest+hello': bad });
  assert.equal(await run({ scaffold, pages: [], error: (m) => errors.push(m) }), 1);
  assert.match(errors.join('\n'), /react\+nest.*server\/package\.json pins .* 9\.9\.9/);
});

test('main: a CLI failure exits 1 and names the pair', async () => {
  const errors = [];
  const scaffold = () => {
    throw new Error('Unknown server');
  };
  assert.equal(await run({ scaffold, error: (m) => errors.push(m) }), 1);
  assert.match(errors.join('\n'), /react\+node.*Unknown server/);
});

test('main: the flavour-set drift check fails the run', async () => {
  const manifest = { pages: [{ source: 'recipes/x.md', axes: ['server'], trees: [{ flavours: { server: 'node' } }, { flavours: { server: 'nest' } }] }] };
  assert.equal(await run({ manifest, env: { STARTER_DIR: starterRepo(['client-react', 'server-node']) } }), 1);
  assert.equal(await run({ manifest }), 0);
});

test('main: a page with a stale port exits 1', async () => {
  assert.equal(await run({ pages: [record({ text: page.replace('port 3101', 'port 3001') })] }), 1);
});

test('main: a page with a stale SDK version exits 1', async () => {
  const stale = record({ text: '@vectoragents/vs-apps@0.1.0' });
  assert.equal(await run({ pages: [stale] }), 1);
});

test('main: only recipes and guides are checked for env vars', async () => {
  const text = 'Set `SPACE_BASE_URL`.';
  assert.equal(await run({ pages: [record({ source: 'guides/x.md', path: 'docs/guides/x.md', text })] }), 1);
  assert.equal(await run({ pages: [record({ source: 'reference/x.md', path: 'docs/reference/x.md', text })] }), 0);
});

test('main: the run step is checked on the quickstart only', async () => {
  const stale = record({ source: 'guides/x.md', path: 'docs/guides/x.md', text: runStep('port 1.') });
  assert.equal(await run({ pages: [stale] }), 0);
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
  const pages = Object.fromEntries(['quickstart.md', 'reference/harness.md'].map((file) => [file, readFileSync(new URL(`../docs/${file}`, import.meta.url), 'utf8')]));
  assert.deepEqual(checkPageVersions(pages, installedSdkVersion()), []);
});


const flavourPage = (source, axes, trees) => ({ source, axes, trees: trees.map((flavours) => ({ flavours })) });
const templates = [
  { row: 'client', name: 'react' },
  { row: 'server', name: 'node' },
  { row: 'server', name: 'nest' },
];
const serverPage = flavourPage('guides/x.md', ['server'], [{ server: 'node' }, { server: 'nest' }]);

test('flavour set: passes when templates and the flavours of every flavoured page match', () => {
  assert.deepEqual(checkFlavourSet([serverPage, flavourPage('quickstart.md', ['client', 'server'], [{ client: 'react', server: 'node' }, { client: 'react', server: 'nest' }])], templates), []);
});

test('flavour set: fails when a flavour a page names has no template', () => {
  const problems = checkFlavourSet([serverPage], templates.filter((t) => t.name !== 'nest'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /guides\/x\.md names server flavour "nest".*no template/);
});

test('flavour set: fails when a server template has no block or todo on a flavoured page', () => {
  const only = flavourPage('guides/x.md', ['server'], [{ server: 'node' }]);
  const problems = checkFlavourSet([only], templates);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /server-nest.*no block or todo.*guides\/x\.md/);
});

test('flavour set: a template of an axis the page does not use needs no block', () => {
  const clientOnly = flavourPage('recipes/y.md', ['client'], [{ client: 'react' }]);
  assert.deepEqual(checkFlavourSet([clientOnly], templates), []);
});

test('flavour set: no flavoured page needs no template', () => {
  assert.deepEqual(checkFlavourSet([], []), []);
});

test('templates: read from the manifests, named by the directory suffix', () => {
  const root = starterRepo(['client-react', 'server-node']);
  assert.deepEqual(
    readTemplates(root).sort((a, b) => a.name.localeCompare(b.name)),
    [{ row: 'server', name: 'node' }, { row: 'client', name: 'react' }].sort((a, b) => a.name.localeCompare(b.name)),
  );
});

test('start: front matter `start` selects the overlay, hello otherwise', () => {
  assert.equal(startOf('---\ntitle: X\nstart: leads-app\n---\nbody'), 'leads-app');
  assert.equal(startOf('---\ntitle: X\n---\nbody'), 'hello');
  assert.equal(startOf('no front matter\nstart: leads-app'), 'hello');
});

test('cliCommand: a local starter runs its own CLI against its templates, without install', () => {
  const { command, args } = cliCommand({ starterDir: '/s', dir: '/p/a', client: 'react', server: 'nest', start: 'leads-app' });
  assert.equal(command, process.execPath);
  assert.deepEqual(args, ['/s/packages/create-app/bin/create-app.mjs', '/p/a', '--client', 'react', '--server', 'nest', '--start', 'leads-app', '--starter', '/s', '--no-install']);
});

test('cliCommand: without a local starter the published CLI downloads the ref', () => {
  const { command, args } = cliCommand({ dir: '/p/a', client: 'react', server: 'node', start: 'hello', ref: 'v2' });
  assert.equal(command, 'npm');
  assert.deepEqual(args, ['exec', '--yes', '--package=@vectoragents/create-app@latest', '--', 'create-app', '/p/a', '--client', 'react', '--server', 'node', '--start', 'hello', '--ref', 'v2', '--no-install']);
});

/** A docs root with source pages and a generated tree, as `pnpm generate` leaves them. */
function docsRoot(files) {
  const root = mkdtempSync(join(tmpdir(), 'docs-root-'));
  for (const [path, content] of Object.entries(files)) write(root, path, content);
  return root;
}

test('pages: neutral pages take the default pair and their own start; flavoured pages come from the trees', () => {
  const root = docsRoot({
    'docs/quickstart.md': 'quick',
    'docs/reference/harness.md': 'harness',
    'docs/recipes/a.md': '---\nstart: leads-app\n---\nrecipe',
    'docs/guides/x.md': 'flavoured source',
    'docs-gen/nest/guides/x.md': 'nest tree',
    'docs-gen/node/guides/x.md': 'node tree',
  });
  const manifest = { pages: [flavourPage('guides/x.md', ['server'], [{ server: 'node' }, { server: 'nest' }])] };
  const pages = readPages({ root, config, manifest });
  const by = (path) => pages.find((p) => p.path === path);
  assert.equal(pages.length, 5);
  assert.deepEqual(by('docs/recipes/a.md').pair, { client: 'react', server: 'node' });
  assert.equal(by('docs/recipes/a.md').start, 'leads-app');
  assert.equal(by('docs/quickstart.md').start, 'hello');
  assert.equal(by('docs-gen/nest/guides/x.md').text, 'nest tree');
  assert.deepEqual(by('docs-gen/nest/guides/x.md').pair, { client: 'react', server: 'nest' });
  assert.equal(by('docs-gen/nest/guides/x.md').source, 'guides/x.md');
  assert.equal(pages.some((p) => p.path === 'docs/guides/x.md'), false);
});

test('pages: a flavoured page without a generated tree is an error', () => {
  const root = docsRoot({ 'docs/quickstart.md': 'quick', 'docs/reference/harness.md': 'harness' });
  const manifest = { pages: [flavourPage('guides/x.md', ['server'], [{ server: 'node' }])] };
  assert.throws(() => readPages({ root, config, manifest }), /node\/guides\/x\.md/);
});

// STARTER_DIR names a starter checkout; the CLI runs for real.
test('the real CLI scaffolds a project that satisfies the SDK pin check', { skip: !process.env.STARTER_DIR }, async () => {
  const { scaffoldWith } = await import('./starter-sync.mjs');
  const dir = join(mkdtempSync(join(tmpdir(), 'cli-')), 'p');
  scaffoldWith({ starterDir: process.env.STARTER_DIR })({ dir, client: 'react', server: 'nest', start: 'leads-app' });
  assert.ok(readFileSync(join(dir, 'client/src/LeadsPage.tsx'), 'utf8').length > 0);
  assert.deepEqual(checkSdkPin(dir, installedSdkVersion()), []);
});

test('the real CLI and templates pass main for a flavoured page that asks for the overlay', { skip: !process.env.STARTER_DIR }, async () => {
  const starterDir = process.env.STARTER_DIR;
  const excerpt = readFileSync(join(starterDir, 'overlays/leads-app/client/src/LeadsPage.tsx'), 'utf8').split('\n').slice(0, 3).join('\n');
  const text = `---\nstart: leads-app\n---\n\`\`\`tsx title="client/src/LeadsPage.tsx" starter\n${excerpt}\n\`\`\`\n`;
  const pages = ['node', 'nest'].map((server) => record({ source: 'guides/leads.md', path: `docs-gen/react/${server}/guides/leads.md`, pair: { client: 'react', server }, start: startOf(text), text }));
  const manifest = { pages: [flavourPage('guides/leads.md', ['client', 'server'], [{ client: 'react', server: 'node' }, { client: 'react', server: 'nest' }])] };
  assert.equal(await main({ env: { STARTER_DIR: starterDir }, config, manifest, pages, ...silent }), 0);
});
