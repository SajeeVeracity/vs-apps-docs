import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the browser needs to route flavours: the axes, the defaults and the redirect table.
 * The table maps each stub address to the axes of its page, plus the old addresses in `config.legacyRedirects`.
 */
export function loadFlavourSite({ root, config }) {
  const { pages } = JSON.parse(readFileSync(join(root, config.outDir, 'flavours.json'), 'utf8'));
  const redirects = Object.fromEntries(pages.map((page) => [page.url, { axes: page.axes }]));
  for (const { from, to, fixed } of config.legacyRedirects ?? []) {
    const page = pages.find((p) => p.url === to);
    if (!page) throw new Error(`legacyRedirects: ${from} points to ${to}, which is not a flavoured page`);
    redirects[from] = { to, axes: page.axes, ...(fixed && { fixed }) };
  }
  return { axes: config.axes, defaults: config.defaults, redirects };
}
