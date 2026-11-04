import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStarterCodeBlock } from './check-snippets.mjs';
import { combinations } from './generate.mjs';
import { CLI_PACKAGE, DEFAULT_REF, STARTER_REPO } from './starter-source.mjs';

const SDK = '@vectoragents/vs-apps';
const root = fileURLToPath(new URL('..', import.meta.url));
const PIN_FILES = ['package.json', 'client/package.json', 'server/package.json', 'shared/package.json'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const installedSdkVersion = () => readJson(join(root, 'node_modules', SDK, 'package.json')).version;

export const codeBlocksOf = (text) =>
  [...text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)].map(([, lang, meta, body]) => ({ lang, meta, body }));

/** Fails for every pin of the SDK in the generated project that differs from the installed version. */
export function checkSdkPin(starterDir, installed) {
  const problems = [];
  let pins = 0;
  for (const file of PIN_FILES) {
    const path = join(starterDir, file);
    if (!existsSync(path)) continue;
    const manifest = readJson(path);
    const version = { ...manifest.peerDependencies, ...manifest.devDependencies, ...manifest.dependencies }[SDK];
    if (version === undefined) continue;
    pins += 1;
    if (version !== installed) problems.push(`${file} pins ${SDK} ${version}, installed ${installed}`);
  }
  if (pins === 0) problems.push(`the project pins no ${SDK} version`);
  return problems;
}

const VERSION_PAGES = ['quickstart.md', 'reference/harness.md'];
const SDK_VERSION_STRING = /@vectoragents\/vs-apps(?:\/[\w-]+)?(?:@|`? )(\d+\.\d+\.\d+)/g;

/** Fails for every SDK version string on the pages that differs from the installed version. */
export function checkPageVersions(pages, installed) {
  return Object.entries(pages).flatMap(([path, text]) =>
    [...text.matchAll(SDK_VERSION_STRING)]
      .filter(([, version]) => version !== installed)
      .map(([string, version]) => `${path} names ${SDK} ${version} (\`${string}\`), installed ${installed}`),
  );
}

/** Fails for every `starter` code block that is not a verbatim substring of the starter file its title names. */
export function checkCodeBlocks(pageText, starterDir) {
  const problems = [];
  for (const codeBlock of codeBlocksOf(pageText).filter((codeBlock) => isStarterCodeBlock(codeBlock.meta))) {
    const path = /title="([^"]+)"/.exec(codeBlock.meta)?.[1];
    if (!path) {
      problems.push(`a starter code block has no title: ${codeBlock.body.split('\n')[0]}`);
      continue;
    }
    const file = join(starterDir, path);
    if (!existsSync(file)) problems.push(`${path} is missing from the starter`);
    else if (!readFileSync(file, 'utf8').includes(codeBlock.body.trimEnd())) problems.push(`${path} excerpt differs from the starter`);
  }
  return problems;
}

/** Paths of the `hello-app/` tree code block, directories without the trailing slash. */
export function pageTreePaths(pageText) {
  const codeBlock = codeBlocksOf(pageText).find((f) => f.lang === 'text' && /^hello-app\/$/m.test(f.body));
  if (!codeBlock) return [];
  const paths = [];
  const stack = [];
  for (const line of codeBlock.body.split('\n')) {
    const entry = /^((?:│ {3}| {4})*)(?:├── |└── )(.+)$/.exec(line);
    if (!entry) continue;
    const depth = entry[1].length / 4;
    const name = entry[2].replace(/\/$/, '');
    stack.length = depth;
    stack[depth] = name;
    paths.push(stack.join('/'));
  }
  return paths;
}

/** Fails for every path of the page tree that the starter lacks. */
export function checkTree(pageText, starterDir) {
  return pageTreePaths(pageText)
    .filter((path) => !existsSync(join(starterDir, path)))
    .map((path) => `${path} is listed in the page tree but missing from the starter`);
}

const RUN_STEP_HEADING = /^#{2,4} (?:\d+\. )?Run the app in the harness\s*$/m;

/** The text up to the first heading outside a code block, so a `# comment` in a code block does not end it. */
function sliceToHeading(text) {
  const lines = text.split('\n');
  let inCodeBlock = false;
  const end = lines.findIndex((line) => {
    if (line.startsWith('```')) inCodeBlock = !inCodeBlock;
    return !inCodeBlock && /^#{1,4} /.test(line);
  });
  return (end === -1 ? lines : lines.slice(0, end)).join('\n');
}

/** Fails when the run step lacks `port N` for the `SERVER_PORT` or `CLIENT_PORT` in the starter's env preset. */
export function checkPorts(pageText, starterDir) {
  const start = RUN_STEP_HEADING.exec(pageText);
  if (!start) return ['the page has no run step'];
  const step = sliceToHeading(pageText.slice(start.index + start[0].length));
  const presetPath = join(starterDir, 'scripts/env-preset.mjs');
  const preset = readFileSync(presetPath, 'utf8');
  const problems = [];
  for (const name of ['SERVER_PORT', 'CLIENT_PORT']) {
    const port = new RegExp(`\\b${name}\\b\\s*[:=]\\s*'(\\d+)'`).exec(preset)?.[1];
    if (!port) problems.push(`scripts/env-preset.mjs sets no ${name}`);
    else if (!new RegExp(`port ${port}(?!\\d)`).test(step)) problems.push(`the run step does not contain \`port ${port}\` (${name} in the starter)`);
  }
  return problems;
}

export function checkEnvExamples(pageText, starterDir) {
  const origins = new Set(pageText.match(/https:\/\/[\w-]+\.example\.com/g));
  const path = join(starterDir, '.env.example');
  const example = existsSync(path) ? readFileSync(path, 'utf8') : '';
  return [...origins].filter((origin) => !example.includes(origin)).map((origin) => `.env.example lacks ${origin}, which the page names`);
}

const ENV_NAME = '[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*';
// Inline code names need an underscore, so words such as `CAPABILITY` are not read as variables.
const INLINE_NAME = '[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+';
// Inline code that is an UPPER_SNAKE name but an error code of the SDK, not an environment variable.
const ERROR_CODES = new Set(['UNAVAILABLE_ACTION', 'INVALID_PARAMS']);
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'env', 'dotenv']);
const ENV_PAGE_DIRS = ['recipes', 'guides'];
const RUN_STEP_PAGE = 'quickstart.md';

/** Names that a page assigns (`NAME=` in a shell or env code block). */
function assignedEnvNames(text) {
  const shell = codeBlocksOf(text).filter((codeBlock) => SHELL_LANGS.has(codeBlock.lang));
  return shell.flatMap((codeBlock) => [...codeBlock.body.matchAll(new RegExp(`(?:^|[\\s'"])(?:export\\s+)?(${ENV_NAME})=`, 'gm'))].map((m) => m[1]));
}

/** Names that a page uses: `process.env.NAME`, an assignment, or an UPPER_SNAKE word alone in inline code. */
export function usedEnvNames(text) {
  const prose = text.replace(/^```[\s\S]*?^```/gm, '');
  const inline = [...prose.matchAll(new RegExp(`\`(${INLINE_NAME})\``, 'g'))].map((m) => m[1]).filter((name) => !ERROR_CODES.has(name));
  const read = [...text.matchAll(new RegExp(`process\\.env\\.(${ENV_NAME})`, 'g'))].map((m) => m[1]);
  return [...new Set([...inline, ...read, ...assignedEnvNames(text)])];
}

const readNames = (path, pattern) => (existsSync(path) ? [...readFileSync(path, 'utf8').matchAll(pattern)].map((m) => m[1]) : []);

/**
 * Fails for every environment variable that a recipe or guide uses when neither the starter nor the page defines it.
 * The starter defines a name in `.env.example` (`NAME=`) or `.npmrc` (`${NAME}`); the page defines it with `NAME=` in a shell code block.
 */
export function checkEnvVars(pages, starterDir) {
  const known = new Set([...readNames(join(starterDir, '.env.example'), /^(?:export\s+)?([A-Z][A-Z0-9_]*)=/gm), ...readNames(join(starterDir, '.npmrc'), /\$\{([A-Z][A-Z0-9_]*)\}/g)]);
  return Object.entries(pages).flatMap(([path, text]) => {
    const assigned = new Set(assignedEnvNames(text));
    return usedEnvNames(text)
      .filter((name) => !known.has(name) && !assigned.has(name))
      .map((name) => `${path} uses ${name}, which the starter .env.example and .npmrc lack and the page does not set`);
  });
}

const gitClone = (url, dir, ref) => execFileSync('git', ['clone', '--depth', '1', '--branch', ref, url, dir], { stdio: 'pipe' });

/** Command that runs the CLI non-interactively: the checkout's own CLI for a local `starterDir`, else the published one at `ref`. */
export function cliCommand({ starterDir, dir, client, server, start, ref = DEFAULT_REF }) {
  const flags = [dir, '--client', client, '--server', server, '--start', start];
  if (starterDir) return { command: process.execPath, args: [join(starterDir, 'packages/create-app/bin/create-app.mjs'), ...flags, '--starter', starterDir, '--no-install'] };
  return { command: 'npm', args: ['exec', '--yes', `--package=${CLI_PACKAGE}@latest`, '--', 'create-app', ...flags, '--ref', ref, '--no-install'] };
}

/** A `scaffold({ dir, client, server, start })` that runs the CLI and throws its error output on failure. */
export const scaffoldWith = ({ starterDir, ref }) => (project) => {
  const { command, args } = cliCommand({ starterDir, ref, ...project });
  try {
    execFileSync(command, args, { stdio: 'pipe', encoding: 'utf8' });
  } catch (cause) {
    throw new Error(String(cause.stderr || cause.message).trim());
  }
};

/** `{ row, name }` of every template directory that holds a `flavour.json`; the name is the directory suffix after `<row>-`. */
export function readTemplates(starterDir) {
  const templates = join(starterDir, 'templates');
  return readdirSync(templates, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(templates, entry.name, 'flavour.json')))
    .map((entry) => {
      const { row } = readJson(join(templates, entry.name, 'flavour.json'));
      return { row, name: entry.name.slice(row.length + 1) };
    });
}

/**
 * Fails for every flavour a flavoured page names that no template names, and for every template
 * that a flavoured page of its axis has no block or `todo` for. `pages` are the generator manifest pages.
 */
export function checkFlavourSet(pages, templates) {
  return pages.flatMap(({ source, axes, trees }) =>
    axes.flatMap((axis) => {
      const named = [...new Set(trees.map(({ flavours }) => flavours[axis]))];
      const own = templates.filter((t) => t.row === axis);
      return [
        ...named.filter((name) => !own.some((t) => t.name === name)).map((name) => `${source} names ${axis} flavour "${name}", which no template names in flavour.json`),
        ...own.filter((t) => !named.includes(t.name)).map((t) => `template ${axis}-${t.name} has no block or todo on ${source}`),
      ];
    }),
  );
}

/** The overlay a page asks for with `start:` in its front matter; `hello` when it names none. */
export const startOf = (text) => /^---\n[\s\S]*?^start:\s*(\S+)\s*$[\s\S]*?\n---\n/m.exec(text)?.[1] ?? 'hello';

const markdownIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.md')) : []);

/**
 * Every page to check, as `{ source, path, text, pair, start }`. A flavoured page contributes one entry per generated
 * tree, checked against the project of that tree's pair; a neutral page is checked against the default pair.
 */
export function readPages({ root, config, manifest }) {
  const flavoured = new Set(manifest.pages.map((page) => page.source));
  const neutral = [...new Set([...VERSION_PAGES, ...ENV_PAGE_DIRS.flatMap((dir) => markdownIn(join(root, config.docsRoot, dir)).map((file) => `${dir}/${file}`))])].filter((source) => !flavoured.has(source));
  const entry = (source, path, text, pair) => ({ source, path, text, pair: { ...config.defaults, ...pair }, start: startOf(text) });
  return [
    ...neutral.map((source) => entry(source, `${config.docsRoot}/${source}`, readFileSync(join(root, config.docsRoot, source), 'utf8'), {})),
    ...manifest.pages.flatMap(({ source, trees }) =>
      trees.map(({ flavours }) => {
        const path = `${config.outDir}/${Object.values(flavours).join('/')}/${source}`;
        return entry(source, path, readFileSync(join(root, path), 'utf8'), flavours);
      }),
    ),
  ];
}

const readConfig = () => readJson(join(root, 'flavours.config.json'));

function readManifest(config) {
  const file = join(root, config.outDir, 'flavours.json');
  if (!existsSync(file)) throw new Error(`${file} is missing: run pnpm generate first`);
  return readJson(file);
}

/** The checks that read a page against the generated project it describes. */
function checkPage({ source, path, text }, project, installed) {
  const named = { 'the page': text };
  return [
    ...checkCodeBlocks(text, project),
    ...checkTree(text, project),
    ...(source === RUN_STEP_PAGE ? checkPorts(text, project) : []),
    ...checkEnvExamples(text, project),
    ...(ENV_PAGE_DIRS.some((dir) => source.startsWith(`${dir}/`)) ? checkEnvVars(named, project) : []),
    ...(VERSION_PAGES.includes(source) ? checkPageVersions(named, installed) : []),
  ];
}

const labelOf = (pair, start) => Object.values(pair).join('+') + (start === 'hello' ? '' : `, ${start}`);

export async function main({
  env = process.env,
  clone = gitClone,
  config,
  manifest,
  pages,
  scaffold,
  sdkVersion = installedSdkVersion(),
  log = console.log,
  warn = console.warn,
  error = console.error,
} = {}) {
  const ref = env.STARTER_REF ?? DEFAULT_REF;
  let dir = env.STARTER_DIR;
  let temp;
  if (!dir) {
    const url = `https://github.com/${STARTER_REPO}.git`;
    temp = mkdtempSync(join(tmpdir(), 'starter-sync-'));
    try {
      clone(url, temp, ref);
    } catch (cause) {
      rmSync(temp, { recursive: true, force: true });
      const reason = `cannot clone ${url}: ${String(cause.stderr ?? cause.message).trim()}`;
      if (env.CI) {
        error(reason);
        return 1;
      }
      warn(`warning: ${reason}\nskipping the starter sync check outside CI`);
      return 0;
    }
    dir = temp;
  }
  const projects = mkdtempSync(join(tmpdir(), 'starter-projects-'));
  try {
    config ??= readConfig();
    manifest ??= readManifest(config);
    pages ??= readPages({ root, config, manifest });
    scaffold ??= scaffoldWith({ starterDir: env.STARTER_DIR, ref });

    const templates = readTemplates(dir);
    const hasTemplates = (pair) => Object.entries(pair).every(([axis, name]) => templates.some((t) => t.row === axis && t.name === name));
    const problems = checkFlavourSet(manifest.pages, templates).map((problem) => `flavours: ${problem}`);

    const built = new Map();
    /** The generated project of a pair and start, or null when the CLI failed. */
    const projectOf = (pair, start) => {
      const label = labelOf(pair, start);
      if (!built.has(label)) {
        const project = join(projects, `${built.size}`);
        try {
          scaffold({ dir: project, ...pair, start });
          problems.push(...checkSdkPin(project, sdkVersion).map((problem) => `(${label}) ${problem}`));
          built.set(label, project);
        } catch (cause) {
          problems.push(`(${label}) the CLI failed: ${cause.message}`);
          built.set(label, null);
        }
      }
      return built.get(label);
    };

    for (const pair of combinations(config.axes, Object.keys(config.axes)).filter(hasTemplates)) projectOf(pair, 'hello');
    for (const page of pages.filter((p) => hasTemplates(p.pair))) {
      const project = projectOf(page.pair, page.start);
      if (project) problems.push(...checkPage(page, project, sdkVersion).map((problem) => `${page.path} (${labelOf(page.pair, page.start)}): ${problem}`));
    }
    for (const problem of problems) error(`starter-sync: ${problem}`);
    if (problems.length === 0) log(`starter-sync: ok (SDK ${sdkVersion}, ${built.size} generated project(s) from ${env.STARTER_DIR ?? `${STARTER_REPO}@${ref}`})`);
    return problems.length === 0 ? 0 : 1;
  } finally {
    rmSync(projects, { recursive: true, force: true });
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main();
