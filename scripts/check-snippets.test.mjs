import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSnippets, isStarterCodeBlock } from './check-snippets.mjs';

const ticks = '```';

function docsDir(body) {
  const root = mkdtempSync(join(tmpdir(), 'snip-'));
  const docs = join(root, 'docs');
  mkdirSync(docs);
  writeFileSync(join(docs, 'page.md'), body);
  return { docs, stamp: join(root, 'stamp.json') };
}

test('passes a valid snippet and writes the stamp', () => {
  const { docs, stamp } = docsDir(
    `${ticks}ts title="a.ts"\nimport { defineApp } from '@vectoragents/vs-apps';\nexport const d = defineApp;\n${ticks}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(JSON.parse(readFileSync(stamp, 'utf8')).package, '0.2.4');
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

test('fails a decorator snippet on a page that is not the Nest page', () => {
  const { docs, stamp } = docsDir(decorated);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.match(result.output, /page\.md block 1/);
});

test('passes a decorator snippet on a page in the Nest folder', () => {
  for (const name of ['nest-adapter.md', 'another-page.md']) {
    const { docs, stamp } = docsDir('');
    mkdirSync(join(docs, 'nest'));
    writeFileSync(join(docs, 'nest', name), decorated);
    const result = checkSnippets({ docsDir: docs, stampFile: stamp });
    assert.equal(result.ok, true, result.output);
  }
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

test('resolves @hello-app/shared to the shared/src/index.ts block on a Nest page', () => {
  const { docs, stamp } = docsDir('');
  mkdirSync(join(docs, 'nest'));
  writeFileSync(
    join(docs, 'nest', 'nest-adapter.md'),
    `${ticks}ts title="shared/src/index.ts"\nexport const CAPABILITY = 'hello:view';\n${ticks}\n\n` +
      `${ticks}ts title="server/src/use.ts"\nimport { CAPABILITY } from '@hello-app/shared';\nexport const c: string = CAPABILITY;\n${ticks}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
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
  return { docs, stamp };
}

test('fails a recipe, guide or Nest snippet whose title is outside client, server and shared, and writes no stamp', () => {
  for (const folder of ['recipes', 'guides', 'nest']) {
    const { docs, stamp } = pageIn(folder, `${ticks}ts title="src/actions.ts"\nexport const a = 1;\n${ticks}\n`);
    const result = checkSnippets({ docsDir: docs, stampFile: stamp });
    assert.equal(result.ok, false);
    assert.match(result.output, new RegExp(`${folder}/page\\.md: src/actions\\.ts`));
    assert.throws(() => readFileSync(stamp));
  }
});

test('passes a Nest snippet titled under client, server or shared', () => {
  for (const title of ['client/src/a.ts', 'server/src/a.ts', 'shared/src/a.ts']) {
    const { docs, stamp } = pageIn('nest', `${ticks}ts title="${title}"\nexport const a = 1;\n${ticks}\n`);
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
