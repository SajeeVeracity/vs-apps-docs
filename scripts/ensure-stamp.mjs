import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Writes an empty stamp when none exists, so the stamp import resolves before `check:snippets` has run. */
export function ensureStamp(stampFile = join(root, 'static', 'verified.json')) {
  if (existsSync(stampFile)) return false;
  mkdirSync(dirname(stampFile), { recursive: true });
  writeFileSync(stampFile, `${JSON.stringify({ package: '', verifiedAt: '', snippets: 0 }, null, 2)}\n`);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) ensureStamp();
