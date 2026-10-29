import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileMeta, readEmbedded } from '../src/plugins/embed-file.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nestPage = 'recipes/nest-adapter.md';
const nestDir = 'nest';
const fence = /^```(ts|tsx)\b([^\n]*)\n([\s\S]*?)^```/gm;

function docFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return docFiles(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

/** Typechecks every ts/tsx fence under `docsDir`; writes `stampFile` only when all pass. */
export function checkSnippets({
  docsDir = join(root, 'docs'),
  baseDir = root,
  stampFile = join(root, 'static', 'verified.json'),
} = {}) {
  const work = mkdtempSync(join(root, '.snippets-'));
  try {
    const origins = new Map();
    for (const [fileIndex, file] of docFiles(docsDir).entries()) {
      let index = 0;
      const titled = new Set();
      const blocks = [];
      for (const [, lang, meta, body] of readFileSync(file, 'utf8').matchAll(fence)) {
        index++;
        const title = /title="([^"]+)"/.exec(meta)?.[1];
        // The starter's CI typechecks a `starter` fence.
        if (/(^|\s)starter(\s|$)/.test(meta.replace(/title="[^"]*"/, ''))) continue;
        const code = fileMeta(meta) ? readEmbedded(baseDir, fileMeta(meta)) : body;
        // A titled block is written at its title path so relative imports between a page's blocks resolve.
        const placed = title && !titled.has(title);
        if (placed) titled.add(title);
        const dir = relative(docsDir, file).replaceAll('\\', '/') === nestPage ? `${nestDir}/` : '';
        const name = dir + (placed ? `page-${fileIndex}/${title}` : `snippet-${origins.size + blocks.length}.${lang}`);
        blocks.push({ name, code, origin: `${relative(docsDir, file)} block ${index}` });
      }
      for (const { name, code, origin } of blocks) {
        mkdirSync(dirname(join(work, name)), { recursive: true });
        // `export {}` keeps import-less snippets from sharing one global scope.
        writeFileSync(join(work, name), `${code}\nexport {};\n`);
        origins.set(name, origin);
      }
    }
    writeFileSync(
      join(work, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ['node'],
        },
        include: ['**/*.ts', '**/*.tsx'],
        exclude: [nestDir],
      }),
    );
    mkdirSync(join(work, nestDir), { recursive: true });
    writeFileSync(
      join(work, nestDir, 'tsconfig.json'),
      JSON.stringify({
        extends: '../tsconfig.json',
        compilerOptions: { experimentalDecorators: true, emitDecoratorMetadata: true },
        include: ['**/*.ts', '**/*.tsx'],
        // Overrides the parent's exclude of this folder.
        exclude: [],
      }),
    );
    let output = '';
    const nestCount = [...origins.keys()].filter((name) => name.startsWith(`${nestDir}/`)).length;
    const projects = [
      ...(nestCount < origins.size ? [work] : []),
      ...(nestCount > 0 ? [join(work, nestDir)] : []),
    ];
    for (const project of projects) {
      try {
        execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', project], { encoding: 'utf8', stdio: 'pipe' });
      } catch (error) {
        output += String(error.stdout ?? error.message);
      }
    }
    for (const [name, origin] of origins) output = output.replaceAll(`${relative(process.cwd(), work)}/${name}`, origin);
    if (output) return { ok: false, count: origins.size, output };

    const installed = JSON.parse(
      readFileSync(join(root, 'node_modules/@vectoragents/vs-apps/package.json'), 'utf8'),
    ).version;
    mkdirSync(dirname(stampFile), { recursive: true });
    writeFileSync(
      stampFile,
      `${JSON.stringify({ package: installed, verifiedAt: new Date().toISOString(), snippets: origins.size }, null, 2)}\n`,
    );
    return { ok: true, count: origins.size, output: '' };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkSnippets();
  if (!result.ok) {
    console.error(result.output);
    process.exit(1);
  }
  console.log(`${result.count} snippets typechecked`);
}
