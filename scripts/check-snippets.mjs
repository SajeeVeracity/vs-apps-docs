import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileMeta, readEmbedded } from '../src/plugins/embed-file.mjs';
import { combinations } from './generate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const titleRoots = /^(client|server|shared)\//;
const titleFolders = /^(recipes|guides)\//;
const codeBlock = /^```(ts|tsx)\b([^\n]*)\n([\s\S]*?)^```/gm;

/** True when the code block meta has the `starter` word outside its title. */
export const isStarterCodeBlock = (meta) => /(^|\s)starter(\s|$)/.test(meta.replace(/title="[^"]*"/, ''));

function docFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return docFiles(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

// Compiler options a flavour adds to every project that shows it.
const flavourOptions = { nest: { experimentalDecorators: true, emitDecoratorMetadata: true } };

const baseOptions = {
  target: 'ES2022',
  module: 'NodeNext',
  moduleResolution: 'NodeNext',
  jsx: 'react-jsx',
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: ['node'],
};

/** Typechecks the ts/tsx code blocks: neutral pages once from `docsDir`, flavoured pages once per pair from `genDir`. Writes `stampFile` only on a clean pass. */
export function checkSnippets({
  docsDir = join(root, 'docs'),
  genDir = join(root, 'docs-gen'),
  config = JSON.parse(readFileSync(join(root, 'flavours.config.json'), 'utf8')),
  baseDir = root,
  stampFile = join(root, 'static', 'verified.json'),
} = {}) {
  if (!existsSync(join(genDir, 'flavours.json'))) throw new Error(`${genDir} has no flavours.json: run pnpm generate first`);
  const { pages: flavouredPages } = JSON.parse(readFileSync(join(genDir, 'flavours.json'), 'utf8'));
  const flavouredSources = new Set(flavouredPages.map((page) => page.source));
  const work = mkdtempSync(join(root, '.snippets-'));
  try {
    const origins = new Map();
    const badTitles = [];
    const sources = docFiles(docsDir).map((file) => ({ file, doc: relative(docsDir, file).replaceAll('\\', '/') }));

    // Title rules run on every source page, markers included.
    for (const { file, doc } of sources) {
      for (const [, , meta] of readFileSync(file, 'utf8').matchAll(codeBlock)) {
        const title = /title="([^"]+)"/.exec(meta)?.[1];
        // Recipes and guides build on the quickstart app, so their file paths use its layout.
        if (title && titleFolders.test(doc) && !titleRoots.test(title)) badTitles.push(`${doc}: ${title}`);
      }
    }
    if (badTitles.length) {
      const output = `Snippet titles must start with client/, server/ or shared/:\n${badTitles.join('\n')}\n`;
      return { ok: false, count: 0, failed: [], output };
    }

    /** Writes the blocks of `pages` into the project folder `name`. */
    const writeProject = (name, pages) => {
      for (const [fileIndex, { file, doc }] of pages.entries()) {
        let index = 0;
        const titled = new Set();
        const blocks = [];
        for (const [, lang, meta, body] of readFileSync(file, 'utf8').matchAll(codeBlock)) {
          index++;
          // The starter's CI typechecks a `starter` code block.
          if (isStarterCodeBlock(meta)) continue;
          const title = /title="([^"]+)"/.exec(meta)?.[1];
          const code = fileMeta(meta) ? readEmbedded(baseDir, fileMeta(meta)) : body;
          // A titled block is written at its title path so relative imports between a page's blocks resolve.
          const placed = title && !titled.has(title);
          if (placed) titled.add(title);
          const path = placed ? `page-${fileIndex}/${title}` : `snippet-${fileIndex}-${index}.${lang}`;
          blocks.push({ name: `${name}/${path}`, code, origin: `${doc} block ${index}` });
        }
        // A page that writes `shared/src/index.ts` resolves `@hello-app/shared` to it, as the starter's workspace does.
        if (titled.has('shared/src/index.ts')) {
          const stub = join(work, name, `page-${fileIndex}`, 'node_modules', '@hello-app', 'shared');
          mkdirSync(stub, { recursive: true });
          writeFileSync(join(stub, 'index.ts'), "export * from '../../../shared/src/index';\n");
        }
        for (const { name: path, code, origin } of blocks) {
          mkdirSync(dirname(join(work, path)), { recursive: true });
          // `export {}` keeps import-less snippets from sharing one global scope.
          writeFileSync(join(work, path), `${code}\nexport {};\n`);
          origins.set(path, origin);
        }
      }
    };

    const projects = [];
    projects.push({ name: 'neutral', pages: sources.filter(({ doc }) => !flavouredSources.has(doc)) });

    // A pair project holds every tree page whose flavours the pair contains.
    for (const pair of combinations(config.axes, Object.keys(config.axes))) {
      const pages = flavouredPages.flatMap((page) =>
        page.trees
          .filter(({ flavours }) => Object.entries(flavours).every(([axis, flavour]) => pair[axis] === flavour))
          .map(({ flavours }) => {
            const doc = [...Object.values(flavours), page.source].join('/');
            return { file: join(genDir, doc), doc };
          }),
      );
      const options = Object.assign({}, ...Object.values(pair).map((flavour) => flavourOptions[flavour]));
      projects.push({ name: Object.values(pair).join('+'), pages, options });
    }

    let output = '';
    const failed = [];
    for (const { name, pages, options = {} } of projects) {
      const before = origins.size;
      writeProject(name, pages);
      if (origins.size === before) continue;
      writeFileSync(
        join(work, name, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: { ...baseOptions, ...options },
          include: ['**/*.ts', '**/*.tsx'],
        }),
      );
      try {
        execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(work, name)], { encoding: 'utf8', stdio: 'pipe' });
      } catch (error) {
        failed.push(name);
        output += String(error.stdout ?? error.message);
      }
    }
    for (const [name, origin] of origins) output = output.replaceAll(`${relative(process.cwd(), work)}/${name}`, origin);
    if (output) return { ok: false, count: origins.size, failed, output };

    const installed = JSON.parse(
      readFileSync(join(root, 'node_modules/@vectoragents/vs-apps/package.json'), 'utf8'),
    ).version;
    mkdirSync(dirname(stampFile), { recursive: true });
    writeFileSync(
      stampFile,
      `${JSON.stringify({ package: installed, verifiedAt: new Date().toISOString(), snippets: origins.size }, null, 2)}\n`,
    );
    return { ok: true, count: origins.size, failed, output: '' };
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
