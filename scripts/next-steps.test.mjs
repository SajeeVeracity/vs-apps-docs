import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const { default: sidebars } = await import(join(dirname(fileURLToPath(import.meta.url)), '..', 'sidebars.ts'));
const slugs = sidebars.docs.map((item) => item.link?.slug).filter(Boolean);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = {
  'quickstart.md': ['app-definition.md', '/category/recipes', 'reference/harness.md'],
  'examples.md': ['/category/recipes'],
  'app-definition.md': ['examples.md', '/category/recipes', '/category/reference'],
};

const block = (text) => text.split(/^## /m).slice(1).filter((s) => s.startsWith('Next steps\n'));

for (const [file, targets] of Object.entries(pages)) {
  const text = readFileSync(join(root, 'docs', file), 'utf8');

  test(`${file} ends with a Next steps block`, () => {
    assert.equal(block(text).length, 1);
    assert.match(text.split(/^## /m).at(-1), /^Next steps\n/);
  });

  test(`${file} Next steps items are a link plus a one-line reason`, () => {
    const items = block(text)[0].split('\n').slice(1).filter((l) => l.trim());
    assert.equal(items.length, targets.length);
    for (const line of items) assert.match(line, /^- \[[^\]]+\]\([^)]+\): [^\n]*\S\.$/);
    const links = items.map((l) => l.match(/\]\(([^)]+)\)/)[1]);
    assert.deepEqual(links.map((l) => l.replace(/^\.\//, '')), targets);
    for (const l of links) {
      if (l.startsWith('./')) assert.ok(existsSync(join(root, 'docs', l)), l);
      if (l.startsWith('/category/')) assert.ok(slugs.includes(l), l);
    }
  });
}

test('no other page has a Next steps block', () => {
  const files = globSync('docs/**/*.{md,mdx}', { cwd: root });
  const have = files
    .filter((f) => /^## Next steps$/m.test(readFileSync(join(root, f), 'utf8')))
    .map((f) => f.replace('docs/', ''));
  assert.deepEqual(have.sort(), Object.keys(pages).sort());
});
