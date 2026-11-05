import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `## ` section whose heading line starts with `title`, or '' when absent. */
export const section = (text, title) => text.split(/^## /m).find((s) => s.startsWith(title)) ?? '';

export const linksOf = (text) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);

export const nextLinks = (text) => linksOf(section(text, 'Next step'));

/** Code blocks of the given languages, bodies joined by newlines. */
export const snippetsOf = (text, langs = 'tsx?') =>
  [...text.matchAll(new RegExp(`^\`\`\`(?:${langs})[^\\n]*\\n([\\s\\S]*?)^\`\`\``, 'gm'))].map(([, body]) => body).join('\n');

/** Every ts or tsx block that has a `title="..."` attribute. */
export const titledSnippets = (text) =>
  [...text.matchAll(/^```tsx?\s+title="([^"]+)"[^\n]*\n([\s\S]*?)^```/gm)].map(([, title, body]) => ({ title, body }));

/** Body of the titled snippet whose title ends with `titleFile`, or ''. */
export const codeOf = (text, titleFile) => titledSnippets(text).find(({ title }) => title.endsWith(titleFile))?.body ?? '';

const defaultGenDir = fileURLToPath(new URL('../docs-gen/', import.meta.url));

/**
 * The generated copies of the source page `source` (path under `docs/`), one `{ tree, text }` per tree.
 * `tree` is the tree path (`node`, `react/nest`); a neutral page has one copy with `tree` ''.
 * Run the same assertions on every entry so a flavoured page is checked in each tree.
 */
export const treesOf = (source, { genDir = defaultGenDir } = {}) => {
  const manifestFile = join(genDir, 'flavours.json');
  if (!existsSync(manifestFile)) throw new Error(`${genDir} has no flavours.json: run pnpm generate first`);
  const page = JSON.parse(readFileSync(manifestFile, 'utf8')).pages.find((p) => p.source === source);
  if (!page) return [{ tree: '', text: readFileSync(join(genDir, source), 'utf8') }];
  return page.trees.map(({ flavours }) => {
    const tree = Object.values(flavours).join('/');
    return { tree, text: readFileSync(join(genDir, tree, source), 'utf8') };
  });
};
