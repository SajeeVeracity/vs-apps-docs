import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkSnippets } from './check-snippets.mjs';

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
