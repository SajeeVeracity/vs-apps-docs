// Helpers shared by the page tests.

/** The `## ` section whose heading line starts with `title`, or '' when absent. */
export const section = (text, title) => text.split(/^## /m).find((s) => s.startsWith(title)) ?? '';

export const linksOf = (text) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);

export const nextLinks = (text) => linksOf(section(text, 'Next step'));

/** Fenced blocks of the given languages, bodies joined by newlines. */
export const snippetsOf = (text, langs = 'tsx?') =>
  [...text.matchAll(new RegExp(`^\`\`\`(?:${langs})[^\\n]*\\n([\\s\\S]*?)^\`\`\``, 'gm'))].map(([, body]) => body).join('\n');

/** Every ts or tsx block that has a `title="..."` attribute. */
export const titledSnippets = (text) =>
  [...text.matchAll(/^```tsx?\s+title="([^"]+)"[^\n]*\n([\s\S]*?)^```/gm)].map(([, title, body]) => ({ title, body }));

/** Body of the titled snippet whose title ends with `titleFile`, or ''. */
export const codeOf = (text, titleFile) => titledSnippets(text).find(({ title }) => title.endsWith(titleFile))?.body ?? '';
