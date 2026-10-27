import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ensureStamp } from './ensure-stamp.mjs';

test('writes an empty stamp when absent and keeps an existing one', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'stamp-')), 'static', 'verified.json');
  assert.equal(ensureStamp(file), true);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).verifiedAt, '');
  writeFileSync(file, '{"package":"0.2.4","verifiedAt":"2026-01-01T00:00:00.000Z","snippets":1}');
  assert.equal(ensureStamp(file), false);
  assert.ok(existsSync(file));
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).package, '0.2.4');
});
