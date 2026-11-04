import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { generate } from './generate.mjs';

const config = {
  docsRoot: 'docs',
  outDir: 'docs-gen',
  todoCap: 5,
  axes: { client: { react: 'React' }, server: { node: 'Node.js + TypeScript', nest: 'Nest.js' } },
  defaults: { client: 'react', server: 'node' },
};

const sandboxes = [];
after(() => sandboxes.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Writes `pages` (path to text) under a temp project and runs the generator on it. */
function run(pages, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'generate-test-'));
  sandboxes.push(root);
  const merged = { ...config, ...overrides };
  for (const [path, body] of Object.entries(pages)) {
    mkdirSync(dirname(join(root, merged.docsRoot, path)), { recursive: true });
    writeFileSync(join(root, merged.docsRoot, path), body);
  }
  const result = generate({ root, config: merged });
  const out = join(root, merged.outDir);
  const read = (path) => readFileSync(join(out, path), 'utf8');
  const files = () => readdirSync(out, { recursive: true }).filter((f) => /\.mdx?$/.test(f)).map((f) => f.replaceAll('\\', '/')).sort();
  return { result, read, files, exists: (path) => existsSync(join(out, path)), root, out };
}

const server = (extra = '') => `---\ntitle: Server page\n---\n\nShared prose.\n\n<!-- flavour node -->\nNODE BODY\n<!-- /flavour -->\n\n<!-- flavour nest -->\nNEST BODY\n<!-- /flavour -->\n${extra}`;

test('a neutral page is copied byte for byte to its own address, with no stub or tree', () => {
  const page = '---\ntitle: Plain\n---\n\nSee [other](./other.md#part).\n';
  const { files, read } = run({ 'plain.md': page, 'other.md': '# Other\n' });
  assert.deepEqual(files(), ['other.md', 'plain.md']);
  assert.equal(read('plain.md'), page);
});

test('a server-only page is emitted once per server flavour under /<server>/', () => {
  const { files, read } = run({ 'guides/call.md': server() });
  assert.deepEqual(files().filter((f) => f.startsWith('nest/') || f.startsWith('node/')), ['nest/guides/call.md', 'node/guides/call.md']);
  const node = read('node/guides/call.md');
  assert.match(node, /Shared prose\./);
  assert.match(node, /NODE BODY/);
  assert.doesNotMatch(node, /NEST BODY|flavour/);
  assert.match(read('nest/guides/call.md'), /NEST BODY/);
  assert.doesNotMatch(read('nest/guides/call.md'), /NODE BODY/);
});

test('tree pages show the shared sidebar', () => {
  const { read } = run({ 'guides/call.md': server() });
  assert.match(read('node/guides/call.md'), /^---\ntitle: Server page\ndisplayed_sidebar: docs\n---\n/);
});

test('a flavoured page keeps a flavourless stub at its own address that links to every tree page', () => {
  const { read } = run({ 'guides/call.md': server() });
  const stub = read('guides/call.md');
  assert.match(stub, /^---\ntitle: Server page\n---\n/);
  assert.doesNotMatch(stub, /Shared prose|NODE BODY/);
  assert.match(stub, /\[Node\.js \+ TypeScript\]\(\.\.\/node\/guides\/call\.md\)/);
  assert.match(stub, /\[Nest\.js\]\(\.\.\/nest\/guides\/call\.md\)/);
});

test('a client-only page is emitted under /<client>/ and carries the client block content', () => {
  const page = '---\ntitle: Hook\n---\n\n<!-- flavour react -->\nREACT BODY\n<!-- /flavour -->\n';
  const { files, read } = run({ 'recipes/hook.md': page });
  assert.deepEqual(files(), ['react/recipes/hook.md', 'recipes/hook.md']);
  assert.match(read('react/recipes/hook.md'), /REACT BODY/);
  assert.match(read('recipes/hook.md'), /\[React\]\(\.\.\/react\/recipes\/hook\.md\)/);
});

test('a both-axis page is emitted once per client and server pair under /<client>/<server>/', () => {
  const page = `---\ntitle: Both\n---\n\n<!-- flavour react -->\nREACT STEP\n<!-- /flavour -->\n${server()}`.replace('---\ntitle: Server page\n---\n', '');
  const { files, read } = run({ 'quickstart.md': page });
  assert.deepEqual(files(), ['quickstart.md', 'react/nest/quickstart.md', 'react/node/quickstart.md']);
  const nest = read('react/nest/quickstart.md');
  assert.match(nest, /REACT STEP/);
  assert.match(nest, /NEST BODY/);
  assert.doesNotMatch(nest, /NODE BODY/);
  assert.match(read('quickstart.md'), /\[React · Nest\.js\]\(\.\/react\/nest\/quickstart\.md\)/);
});

test('a page without front matter still gets the shared sidebar, and its stub takes the first heading as title', () => {
  const { read } = run({ 'quickstart.md': '# Quickstart\n\n<!-- flavour node -->\nA\n<!-- /flavour -->\n<!-- flavour nest -->\nB\n<!-- /flavour -->\n' });
  assert.match(read('node/quickstart.md'), /^---\ndisplayed_sidebar: docs\n---\n# Quickstart/);
  assert.match(read('quickstart.md'), /^---\ntitle: "Quickstart"\n---\n/);
});

const hook = '<!-- flavour react -->\nREACT\n<!-- /flavour -->\n';
const both = '<!-- flavour react -->\nR\n<!-- /flavour -->\n<!-- flavour node -->\nN\n<!-- /flavour -->\n<!-- flavour nest -->\nS\n<!-- /flavour -->\n';

/** Output path that the first link of `text` points at, resolved from the page at `from`. */
const target = (from, text) => posix.join(posix.dirname(from), /\]\(([^)#]+)/.exec(text)[1]);

test('inside a tree, a link to a flavoured page points into the same tree and keeps its hash', () => {
  const { read } = run({ 'guides/call.md': server(), 'other/page.md': server('\nSee [call](../guides/call.md#part).\n') });
  for (const tree of ['node', 'nest']) {
    const from = `${tree}/other/page.md`;
    const text = read(from).split('See ')[1];
    assert.equal(target(from, text), `${tree}/guides/call.md`);
    assert.match(text, /#part\)/);
  }
});

test('a link from a tree to a page that varies on an axis the tree lacks points to the flavourless stub', () => {
  const { read } = run({
    'recipes/hook.md': hook,
    'guides/call.md': server('\n[hook](../recipes/hook.md)\n'),
  });
  assert.match(read('node/guides/call.md'), /\[hook\]\(\.\.\/\.\.\/recipes\/hook\.md\)/);
});

test('a both-axis tree links a server-only page in its own server tree and a client-only page in its client tree', () => {
  const { read } = run({
    'quickstart.md': `${both}\n[call](./guides/call.md) [hook](./recipes/hook.md)\n`,
    'guides/call.md': server(),
    'recipes/hook.md': hook,
  });
  const page = read('react/nest/quickstart.md');
  assert.match(page, /\[call\]\(\.\.\/\.\.\/nest\/guides\/call\.md\)/);
  assert.match(page, /\[hook\]\(\.\.\/recipes\/hook\.md\)/);
});

test('inside a tree, a link to a neutral page is re-based for the deeper path', () => {
  const { read } = run({
    'guides/call.md': server('\n[glossary](../glossary.md#term) [web](https://example.com/a.md) [gone](./missing.md)\n'),
    'glossary.md': '# G\n',
  });
  const node = read('node/guides/call.md');
  assert.match(node, /\[glossary\]\(\.\.\/\.\.\/glossary\.md#term\)/);
  assert.match(node, /\[web\]\(https:\/\/example\.com\/a\.md\) \[gone\]\(\.\/missing\.md\)/);
});

test('a neutral page keeps its relative links to flavoured pages, which resolve to the stub', () => {
  const page = 'See [call](./guides/call.md).\n';
  const { read } = run({ 'plain.md': page, 'guides/call.md': server() });
  assert.equal(read('plain.md'), page);
});

const withTodo = (flavour, rest) => `---\ntitle: Gap\n---\n\n<!-- flavour ${flavour} todo -->\n<!-- /flavour -->\n\n${rest}`;

test('a todo block renders a visible notice that links to the written flavour', () => {
  const { read, result } = run({ 'open-route.md': withTodo('node', '<!-- flavour nest -->\nNEST BODY\n<!-- /flavour -->\n') });
  const node = read('node/open-route.md');
  assert.match(node, /^:::warning\nNot yet written for Node\.js \+ TypeScript\. Read the \[Nest\.js version\]\(\.\.\/nest\/open-route\.md\)\.\n:::$/m);
  assert.doesNotMatch(read('nest/open-route.md'), /Not yet written/);
  assert.equal(result.todos, 1);
});

test('on a both-axis page the notice link keeps the other axes of the tree', () => {
  const page = '<!-- flavour react -->\nR\n<!-- /flavour -->\n<!-- flavour nest todo -->\n<!-- /flavour -->\n<!-- flavour node -->\nN\n<!-- /flavour -->\n';
  const { read } = run({ 'quickstart.md': page });
  assert.match(read('react/nest/quickstart.md'), /Read the \[React · Node\.js \+ TypeScript version\]\(\.\.\/node\/quickstart\.md\)/);
});

test('the generator fails when open todo blocks exceed the cap', () => {
  const pages = { 'a.md': withTodo('node', both.replace(/<!-- flavour node -->\nN\n<!-- \/flavour -->\n/, '')) };
  assert.throws(() => run(pages, { todoCap: 0 }), /1 open todo notice exceeds the cap of 0/);
  assert.doesNotThrow(() => run(pages, { todoCap: 1 }));
});

const fails = (page, pattern, overrides) => assert.throws(() => run({ 'guides/x.md': page }, overrides), pattern);

test('an unclosed block fails with the file and the opening line', () => {
  fails('# X\n\n<!-- flavour node -->\ncode\n', /docs\/guides\/x\.md:3: block "node" is not closed/);
});

test('a closing marker without a block fails', () => {
  fails('# X\n<!-- /flavour -->\n', /docs\/guides\/x\.md:2: closing marker outside a block/);
});

test('a block inside a block fails', () => {
  fails('<!-- flavour node -->\n<!-- flavour nest -->\n<!-- /flavour -->\n<!-- /flavour -->\n', /docs\/guides\/x\.md:2: block "nest" opens inside block "node"/);
});

test('an unknown flavour name fails', () => {
  fails('<!-- flavour python -->\nx\n<!-- /flavour -->\n', /docs\/guides\/x\.md:1: unknown flavour "python"/);
});

test('a marker that does not match the syntax fails', () => {
  fails('<!-- flavour node  todo -->\n', /docs\/guides\/x\.md:1: malformed marker/);
  fails('<!--flavour node-->\n', /docs\/guides\/x\.md:1: malformed marker/);
});

test('a page that varies on an axis needs a block or a todo for every flavour of it', () => {
  fails('<!-- flavour node -->\nx\n<!-- /flavour -->\n', /docs\/guides\/x\.md: no block or todo for flavour "nest"/);
  fails('<!-- flavour node todo -->\n<!-- /flavour -->\n<!-- flavour nest todo -->\n<!-- /flavour -->\n', /docs\/guides\/x\.md: every block of axis "server" is todo/);
});

test('every marker error is reported in one run', () => {
  assert.throws(
    () => run({ 'a.md': '<!-- flavour python -->\n', 'b.md': '<!-- /flavour -->\n' }),
    (error) => /a\.md:1: unknown flavour/.test(error.message) && /b\.md:1: closing marker outside a block/.test(error.message),
  );
});

test('a flavour name must belong to one axis', () => {
  const axes = { client: { react: 'React', node: 'Node client' }, server: { node: 'Node.js' } };
  fails('plain\n', /flavour name "node" is on both axis "client" and axis "server"/, { axes });
});

test('a tree path that a neutral page already holds fails', () => {
  assert.throws(
    () => run({ 'a.md': server(), 'node/a.md': '# Clash\n' }),
    /node\/a\.md is written by both docs\/a\.md and docs\/node\/a\.md/,
  );
});

test('the docs root and output folder come from config', () => {
  const { exists, read } = run({ 'guides/call.md': server(), 'plain.md': '# P\n' }, { docsRoot: 'content/sdk', outDir: 'build/gen' });
  assert.ok(exists('plain.md') && exists('node/guides/call.md'));
  assert.match(read('guides/call.md'), /\.\.\/node\/guides\/call\.md/);
});

test('flavours.json lists each flavoured page with its stub address and tree addresses', () => {
  const { read } = run({ 'quickstart.md': `${both}`, 'plain.md': '# P\n', 'recipes/index.md': server() });
  assert.deepEqual(JSON.parse(read('flavours.json')).pages, [
    {
      source: 'quickstart.md',
      url: '/quickstart',
      axes: ['client', 'server'],
      trees: [
        { flavours: { client: 'react', server: 'node' }, url: '/react/node/quickstart' },
        { flavours: { client: 'react', server: 'nest' }, url: '/react/nest/quickstart' },
      ],
    },
    {
      source: 'recipes/index.md',
      url: '/recipes',
      axes: ['server'],
      trees: [
        { flavours: { server: 'node' }, url: '/node/recipes' },
        { flavours: { server: 'nest' }, url: '/nest/recipes' },
      ],
    },
  ]);
});

test('the shipped config keeps every page of this site neutral: one byte-identical copy, no tree', () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const shipped = JSON.parse(readFileSync(join(repo, 'flavours.config.json'), 'utf8'));
  const out = mkdtempSync(join(tmpdir(), 'generate-site-'));
  sandboxes.push(out);
  const { todos } = generate({ root: repo, config: { ...shipped, outDir: relative(repo, out) } });
  const sources = readdirSync(join(repo, shipped.docsRoot), { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
  assert.ok(sources.length > 20);
  for (const entry of sources) {
    const rel = relative(join(repo, shipped.docsRoot), join(entry.parentPath, entry.name));
    assert.deepEqual(readFileSync(join(out, rel)), readFileSync(join(repo, shipped.docsRoot, rel)), rel);
  }
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'flavours.json'), 'utf8')).pages, []);
  assert.ok(todos <= shipped.todoCap);
});
