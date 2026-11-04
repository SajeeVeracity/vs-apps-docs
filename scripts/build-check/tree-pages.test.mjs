import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(readFileSync(join(root, 'flavours.config.json'), 'utf8'));
const { pages } = JSON.parse(readFileSync(join(root, config.outDir, 'flavours.json'), 'utf8'));
const html = (url) => readFileSync(join(root, 'build', url, 'index.html'), 'utf8');

const CATEGORY = '<li class="theme-doc-sidebar-item-category theme-doc-sidebar-item-category-level-1';

for (const { url, flavours } of pages.flatMap((page) => page.trees)) {
  test(`${url} has an active sidebar link, an open category, breadcrumbs and pagination`, () => {
    const page = html(url);
    assert.match(page, new RegExp(`aria-current="page"[^>]*href="${url}"`));
    const category = page.split(CATEGORY).find((part) => part.includes('aria-current="page"'));
    assert.ok(category, 'the active link sits in a category');
    assert.doesNotMatch(category.slice(0, category.indexOf('>')), /menu__list-item--collapsed/);
    assert.ok((page.match(/class="breadcrumbs__item/g) ?? []).length >= 3, 'home, section and page');
    assert.match(page, /pagination-nav__link--(prev|next)/);
  });
}

test('the site has flavoured pages to check', () => assert.ok(pages.length > 0));
