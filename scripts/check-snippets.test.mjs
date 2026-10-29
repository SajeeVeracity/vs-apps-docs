import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSnippets, isStarterFence } from './check-snippets.mjs';

const fence = '```';

function docsDir(body) {
  const root = mkdtempSync(join(tmpdir(), 'snip-'));
  const docs = join(root, 'docs');
  mkdirSync(docs);
  writeFileSync(join(docs, 'page.md'), body);
  return { docs, stamp: join(root, 'stamp.json') };
}

test('passes a valid snippet and writes the stamp', () => {
  const { docs, stamp } = docsDir(
    `${fence}ts title="a.ts"\nimport { defineApp } from '@vectoragents/vs-apps';\nexport const d = defineApp;\n${fence}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(JSON.parse(readFileSync(stamp, 'utf8')).package, '0.2.4');
});

test('fails a snippet that does not typecheck and writes no stamp', () => {
  const { docs, stamp } = docsDir(`${fence}ts\nconst n: number = 'x';\n${fence}\n`);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.throws(() => readFileSync(stamp));
});

const decorated = `${fence}ts title="a.ts"
import { Get } from '@nestjs/common';
export class X {
  @Get()
  list() {}
}
${fence}
`;

test('fails a decorator snippet on a page that is not the Nest page', () => {
  const { docs, stamp } = docsDir(decorated);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, false);
  assert.match(result.output, /page\.md block 1/);
});

test('passes a decorator snippet on the Nest page', () => {
  const { docs, stamp } = docsDir('');
  mkdirSync(join(docs, 'recipes'));
  writeFileSync(join(docs, 'recipes', 'nest-adapter.md'), decorated);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
});

test('skips a starter fence with a type error and does not count it', () => {
  const { docs, stamp } = docsDir(
    `${fence}ts title="a.ts" starter\nconst n: number = 'x';\n${fence}\n\n${fence}ts title="b.ts"\nexport const b = 1;\n${fence}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
  assert.equal(result.count, 1);
  assert.equal(JSON.parse(readFileSync(stamp, 'utf8')).snippets, 1);
});

test('accepts a mermaid fence and does not count it', () => {
  const { docs, stamp } = docsDir(`${fence}mermaid\nsequenceDiagram\n  A->>B: hi\n${fence}\n`);
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
  assert.equal(result.count, 0);
});

test('isStarterFence reads the starter word in the fence meta, not in a title', () => {
  assert.equal(isStarterFence('title="a.ts" starter'), true);
  assert.equal(isStarterFence('starter title="a.ts"'), true);
  assert.equal(isStarterFence('title="starter"'), false);
  assert.equal(isStarterFence('title="a.ts" starters'), false);
  assert.equal(isStarterFence(''), false);
});

test('resolves @hello-app/shared to the shared/src/index.ts block on the Nest page', () => {
  const { docs, stamp } = docsDir('');
  mkdirSync(join(docs, 'recipes'));
  writeFileSync(
    join(docs, 'recipes', 'nest-adapter.md'),
    `${fence}ts title="shared/src/index.ts"\nexport const CAPABILITY = 'hello:view';\n${fence}\n\n` +
      `${fence}ts title="server/src/use.ts"\nimport { CAPABILITY } from '@hello-app/shared';\nexport const c: string = CAPABILITY;\n${fence}\n`,
  );
  const result = checkSnippets({ docsDir: docs, stampFile: stamp });
  assert.equal(result.ok, true, result.output);
});
