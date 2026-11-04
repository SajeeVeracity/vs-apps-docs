import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Page URLs held by the search index of `context` (`react/node`, or '' for the root index) under `buildDir`. */
export function indexedUrls(buildDir, context) {
  const file = `search-index${context ? `-${context.replaceAll('/', '-')}` : ''}.json`;
  const versions = JSON.parse(readFileSync(join(buildDir, file), 'utf8'));
  const urls = versions.flatMap(({ documents }) => documents.map(({ u }) => u.replace(/[#?].*$/, '').replace(/(?<=.)\/$/, '')));
  return [...new Set(urls)].sort();
}
