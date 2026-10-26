import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineApp } from '@vectoragents/vs-apps';
import { buildOutput, emitFile, toDefinition } from '../src/builder/index.ts';
import { presets } from '../src/builder/presets.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clone = (value) => structuredClone(value);

const invalid = {
  'bad app key': (d) => ((d.key = 'Bad_Key'), d),
  'empty version': (d) => ((d.version = ''), d),
  'name over 80 chars': (d) => ((d.name = 'a'.repeat(81)), d),
  'no pages': (d) => ((d.pages = []), d),
  'bad page key': (d) => ((d.pages[0].key = 'Home Page'), d),
  'page path without slash': (d) => ((d.pages[0].path = 'home'), d),
  'empty page label': (d) => ((d.pages[0].label = ''), d),
  'page capability not group:action': (d) => ((d.pages[0].capability = 'view'), d),
  'defaultPageKey names no page': (d) => ((d.defaultPageKey = 'missing'), d),
  'capability key without colon': (d) => ((d.capabilities[0].key = 'view'), d),
  'bad effect': (d) => ((d.capabilities[0].effect = 'delete'), d),
  'duplicate model slot': (d) => (d.resources.models.push(clone(d.resources.models[0])), d),
  'duplicate connector slot': (d) => (d.resources.connectors.push(clone(d.resources.connectors[0])), d),
  'duplicate module': (d) => (d.resources.modules.push(clone(d.resources.modules[0])), d),
  'duplicate event handler': (d) => {
    const handlers = d.resources.connectors[0].eventHandlers;
    handlers.push(clone(handlers[0]));
    return d;
  },
  'model without providers': (d) => ((d.resources.models[0].providers = []), d),
  'bad model modality': (d) => ((d.resources.models[0].modality = 'audio'), d),
  'bad connector provider': (d) => ((d.resources.connectors[0].provider = 'FTP'), d),
};

// Every invalid case starts from a draft that carries one of each resource.
const rich = () => {
  const d = clone(presets.csr);
  d.resources.modules = [{ key: 'crm', required: true }];
  return d;
};

test('presets validate clean and emit a complete file', () => {
  for (const [name, draft] of Object.entries(presets)) {
    const out = buildOutput(draft);
    assert.equal(out.ok, true, name);
    assert.deepEqual(out.warnings, [], name);
    assert.match(out.file.path, /^src\/[a-z][a-z0-9-]*\.definition\.ts$/);
    assert.ok(out.file.code.includes(`// ${out.file.path}`), name);
    assert.ok(out.file.code.includes(`import { defineApp } from '@vectoragents/vs-apps';`), name);
    assert.doesNotMatch(out.file.code, /\.\.\./, name);
  }
});

test('presets come from the example definitions', () => {
  assert.equal(presets.sdr.key, 'sdr');
  assert.equal(presets.csr.resources.connectors[0].eventHandlers.length, 2);
  assert.equal(presets.minimal.pages.length, 1);
});

test('invalid fixtures fail the builder and defineApp alike', () => {
  for (const [name, mutate] of Object.entries(invalid)) {
    const draft = mutate(rich());
    assert.equal(buildOutput(draft).ok, false, `builder accepted: ${name}`);
    assert.throws(() => defineApp(toDefinition(draft)), `defineApp accepted: ${name}`);
  }
  assert.equal(buildOutput(rich()).ok, true);
});

test('a page capability that is not declared warns but does not reject', () => {
  const draft = clone(presets.minimal);
  draft.pages[0].capability = 'ghost:view';
  const out = buildOutput(draft);
  assert.equal(out.ok, true);
  assert.equal(out.warnings.length, 1);
  assert.match(out.warnings[0].message, /ghost:view/);
  defineApp(toDefinition(draft));
});

test('empty optional fields are omitted from the output', () => {
  const draft = clone(presets.minimal);
  draft.name = '';
  draft.defaultPageKey = '';
  const code = emitFile(draft).code;
  assert.doesNotMatch(code, /name:|defaultPageKey:|resources:/);
});

test('emitted files typecheck and run through the real defineApp', async () => {
  const work = mkdtempSync(join(root, '.builder-'));
  try {
    const drafts = { ...presets, rich: rich() };
    const files = Object.entries(drafts).map(([name, draft]) => {
      const file = join(work, `${name}.ts`);
      writeFileSync(file, emitFile(draft).code);
      return { name, file, draft };
    });
    writeFileSync(
      join(work, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ['node'],
        },
        include: ['*.ts'],
      }),
    );
    execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', work], { encoding: 'utf8', stdio: 'pipe' });
    for (const { name, file, draft } of files) {
      const mod = await import(pathToFileURL(file).href);
      const [exported] = Object.values(mod);
      assert.deepEqual(exported, toDefinition(draft), name);
    }

    // The same pipeline rejects an invalid draft at import time.
    const bad = join(work, 'bad.ts');
    writeFileSync(bad, emitFile(invalid['bad app key'](rich())).code);
    await assert.rejects(import(pathToFileURL(bad).href));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
