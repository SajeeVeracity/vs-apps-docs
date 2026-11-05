import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkSnippets as check, isStarterCodeBlock } from './check-snippets.mjs';
import { generate } from './generate.mjs';

const ticks = '```';

const config = {
  docsRoot: 'docs',
  outDir: 'docs-gen',
  todoCap: 5,
  axes: { client: { react: 'React' }, server: { node: 'Node.js + TypeScript', nest: 'Nest.js' } },
  defaults: { client: 'react', server: 'node' },
};

/** Typechecks a fixture project: `docs-gen` sits beside its `docs`. */
const checkSnippets = ({ docsDir, stampFile }) =>
  check({ docsDir, genDir: join(docsDir, '..', 'docs-gen'), config, stampFile });

function docsDir(body) {
  const root = mkdtempSync(join(tmpdir(), 'snip-'));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs', 'page.md'), body);
  generate({ root, config });
  return { docs: join(root, 'docs'), stamp: join(root, 'stamp.json') };
}

test('passes a valid snippet and writes the stamp', () => {
  const { docs, stamp } = docsDir(
    `${ticks}ts title="a.ts"\nimport { defineApp } from '@vectoragents/vs-apps';\nexport const d = defineApp;\n${ticks}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(JSON.parse(readFileSync(stamp, 'utf8')).package, '0.4.0');
});

test('fails a snippet that does not typecheck and writes no stamp', () => {
  const { docs, stamp } = docsDir(`${ticks}ts\nconst n: number = 'x';\n${ticks}\n`);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.throws(() => readFileSync(stamp));
});

const decorated = `${ticks}ts title="server/a.ts"
import { Get } from '@nestjs/common';
export class X {
  @Get()
  list() {}
}
${ticks}
`;

test('fails a decorator snippet on a neutral page', () => {
  const { docs, stamp } = docsDir(decorated);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.match(result.output, /page\.md block 1/);
});

test('fails a decorator snippet on a recipe page', () => {
  const { docs, stamp } = pageIn('recipes', decorated);
  assert.equal(checkSnippets({ docsDir: docs, stampFile: stamp }).ok, false);
});

test('skips a starter code block with a type error and does not count it', () => {
  const { docs, stamp } = docsDir(
    `${ticks}ts title="a.ts" starter\nconst n: number = 'x';\n${ticks}\n\n${ticks}ts title="b.ts"\nexport const b = 1;\n${ticks}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
  assert.equal(result.count, 1);
  assert.equal(JSON.parse(readFileSync(stamp, 'utf8')).snippets, 1);
});

test('accepts a mermaid code block and does not count it', () => {
  const { docs, stamp } = docsDir(`${ticks}mermaid\nsequenceDiagram\n  A->>B: hi\n${ticks}\n`);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
  assert.equal(result.count, 0);
});

test('isStarterCodeBlock reads the starter word in the code block meta, not in a title', () => {
  assert.equal(isStarterCodeBlock('title="a.ts" starter'), true);
  assert.equal(isStarterCodeBlock('starter title="a.ts"'), true);
  assert.equal(isStarterCodeBlock('title="starter"'), false);
  assert.equal(isStarterCodeBlock('title="a.ts" starters'), false);
  assert.equal(isStarterCodeBlock(''), false);
});

test('resolves @hello-app/shared to the shared/src/index.ts block of the same recipe page', () => {
  const { docs, stamp } = pageIn(
    'recipes',
    `${ticks}ts title="shared/src/index.ts"\nexport type PagePath = '/leads';\n${ticks}\n\n` +
      `${ticks}ts title="client/src/use.ts"\nimport type { PagePath } from '@hello-app/shared';\nexport const p: PagePath = '/leads';\n${ticks}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
});

test('fails a recipe snippet that misuses a type from @hello-app/shared', () => {
  const { docs, stamp } = pageIn(
    'recipes',
    `${ticks}ts title="shared/src/index.ts"\nexport type PagePath = '/leads';\n${ticks}\n\n` +
      `${ticks}ts title="client/src/use.ts"\nimport type { PagePath } from '@hello-app/shared';\nexport const p: PagePath = '/icp';\n${ticks}\n`,
  );
  assert.equal(checkSnippets({ docsDir: docs, stampFile: stamp }).ok, false);
});

function pageIn(folder, body) {
  const { docs, stamp } = docsDir('');
  mkdirSync(join(docs, folder));
  writeFileSync(join(docs, folder, 'page.md'), body);
  generate({ root: join(docs, '..'), config });
  return { docs, stamp };
}

test('fails a recipe or guide snippet whose title is outside client, server and shared, and writes no stamp', () => {
  for (const folder of ['recipes', 'guides']) {
    const { docs, stamp } = pageIn(folder, `${ticks}ts title="src/actions.ts"\nexport const a = 1;\n${ticks}\n`);
    const result = checkSnippets({ docsDir: docs, stampFile: stamp });
    assert.equal(result.ok, false);
    assert.match(result.output, new RegExp(`${folder}/page\\.md: src/actions\\.ts`));
    assert.throws(() => readFileSync(stamp));
  }
});

test('passes a guide snippet titled under client, server or shared', () => {
  for (const title of ['client/src/a.ts', 'server/src/a.ts', 'shared/src/a.ts']) {
    const { docs, stamp } = pageIn('guides', `${ticks}ts title="${title}"\nexport const a = 1;\n${ticks}\n`);
    const result = checkSnippets({ docsDir: docs, stampFile: stamp });
    assert.equal(result.ok, true, result.output);
  }
});

test('skips untitled code blocks and code blocks outside recipes and guides', () => {
  const untitled = pageIn('recipes', `${ticks}ts\nexport const a = 1;\n${ticks}\n`);
  assert.equal(checkSnippets({ docsDir: untitled.docs, stampFile: untitled.stamp }).ok, true);
  const reference = pageIn('reference', `${ticks}ts title="src/a.ts"\nexport const a = 1;\n${ticks}\n`);
  assert.equal(checkSnippets({ docsDir: reference.docs, stampFile: reference.stamp }).ok, true);
});

/** A project with `pages` (path under docs to text), generated and ready for `checkSnippets`. */
function project(pages) {
  const root = mkdtempSync(join(tmpdir(), 'snip-'));
  for (const [path, body] of Object.entries(pages)) {
    mkdirSync(dirname(join(root, 'docs', path)), { recursive: true });
    writeFileSync(join(root, 'docs', path), body);
  }
  generate({ root, config });
  return { docs: join(root, 'docs'), stamp: join(root, 'stamp.json') };
}

const good = `${ticks}ts title="server/ok.ts"\nexport const ok = 1;\n${ticks}`;
const bad = `${ticks}ts title="server/bad.ts"\nconst n: number = 'x';\n${ticks}`;
const flavoured = (node, nest) =>
  `# Page\n\n<!-- flavour node -->\n${node}\n<!-- /flavour -->\n\n<!-- flavour nest -->\n${nest}\n<!-- /flavour -->\n`;

test('a failing Node snippet fails the react+node project only', () => {
  const { docs, stamp } = project({ 'quickstart.md': flavoured(bad, good) });
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failed, ['react+node']);
  assert.match(result.output, /node\/quickstart\.md block 1/);
  assert.throws(() => readFileSync(stamp));
});

test('a failing Nest snippet fails the react+nest project only', () => {
  const { docs, stamp } = project({ 'quickstart.md': flavoured(good, bad) });
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.deepEqual(result.failed, ['react+nest']);
  assert.match(result.output, /nest\/quickstart\.md block 1/);
});

test('decorators typecheck in the Nest project and fail in the Node project', () => {
  const nestOnly = project({ 'quickstart.md': flavoured(good, decorated) });
  assert.equal(checkSnippets({ docsDir: nestOnly.docs, stampFile: nestOnly.stamp }).ok, true);
  const nodeToo = project({ 'quickstart.md': flavoured(decorated, good) });
  assert.deepEqual(checkSnippets({ docsDir: nodeToo.docs, stampFile: nodeToo.stamp }).failed, ['react+node']);
});

test('a client-only snippet is checked in every pair that shows it', () => {
  const page = `<!-- flavour react -->\n${bad}\n<!-- /flavour -->\n`;
  const { docs, stamp } = project({ 'recipes/list.md': page });
  assert.deepEqual(checkSnippets({ docsDir: docs, stampFile: stamp }).failed, ['react+node', 'react+nest']);
});

test('a neutral snippet is checked once, from source', () => {
  const { docs, stamp } = project({ 'plain.md': bad, 'quickstart.md': flavoured(good, good) });
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.deepEqual(result.failed, ['neutral']);
  assert.equal(result.output.match(/plain\.md block 1/g).length, 1);
});

test('counts each snippet once per project that checks it', () => {
  const { docs, stamp } = project({ 'plain.md': good, 'quickstart.md': flavoured(good, good) });
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.count, 3);
});

test('title prefixes are checked on the source page, markers included', () => {
  const page = flavoured(`${ticks}ts title="src/a.ts"\nexport const a = 1;\n${ticks}`, good);
  const { docs, stamp } = project({ 'recipes/page.md': page });
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.match(result.output, /recipes\/page\.md: src\/a\.ts/);
});

test('titled blocks of one tree page resolve each other and the shared package', () => {
  const sharedBlock = `${ticks}ts title="shared/src/index.ts"\nexport const name = 'x';\n${ticks}`;
  const serverBlock = `${ticks}ts title="server/src/a.ts"\nimport { name } from '@hello-app/shared';\nexport const n: string = name;\n${ticks}`;
  const { docs, stamp } = project({ 'recipes/page.md': flavoured(`${sharedBlock}\n\n${serverBlock}`, `${sharedBlock}\n\n${serverBlock}`) });
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
});

test('stops with a pointer to the generator when the trees are missing', () => {
  const { docs, stamp } = project({ 'plain.md': good });
  rmSync(join(docs, '..', 'docs-gen'), { recursive: true });
  assert.throws(() => checkSnippets({ docsDir: docs, stampFile: stamp }), /pnpm generate/);
});
