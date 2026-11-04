import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStarterCodeBlock } from './check-snippets.mjs';
import { STARTER_URL } from './starter-url.mjs';

const SDK = '@vectoragents/vs-apps';
const root = fileURLToPath(new URL('..', import.meta.url));
const pagePath = join(root, 'docs/quickstart.md');
const PIN_FILES = ['package.json', 'client/package.json', 'server/package.json', 'shared/package.json'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const installedSdkVersion = () => readJson(join(root, 'node_modules', SDK, 'package.json')).version;

export const codeBlocksOf = (text) =>
  [...text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)].map(([, lang, meta, body]) => ({ lang, meta, body }));

/** Fails for every pin of the SDK in the starter that differs from the installed version. */
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
  const lockPath = join(starterDir, 'package-lock.json');
  if (existsSync(lockPath)) {
    const locked = readJson(lockPath).packages?.[`node_modules/${SDK}`]?.version;
    if (locked !== undefined) {
      pins += 1;
      if (locked !== installed) problems.push(`package-lock.json resolves ${SDK} ${locked}, installed ${installed}`);
    }
  }
  if (pins === 0) problems.push(`the starter pins no ${SDK} version`);
  return problems;
}

const START_FOLDERS = ['recipes/leads-app'];

/** Fails for every start folder the starter lacks or whose SDK pin differs from the installed version. */
export function checkStartFolders(starterDir, installed) {
  return START_FOLDERS.flatMap((folder) =>
    existsSync(join(starterDir, folder))
      ? checkSdkPin(join(starterDir, folder), installed).map((problem) => `${folder}: ${problem}`)
      : [`${folder} is missing from the starter`],
  );
}

const VERSION_PAGES = ['docs/quickstart.md', 'docs/reference/harness.md'];
const SDK_VERSION_STRING = /@vectoragents\/vs-apps(?:\/[\w-]+)?(?:@|`? )(\d+\.\d+\.\d+)/g;

const readVersionPages = () => Object.fromEntries(VERSION_PAGES.map((path) => [path, readFileSync(join(root, path), 'utf8')]));

/** Fails for every SDK version string on the pages that differs from the installed version. */
export function checkPageVersions(pages = readVersionPages(), installed = installedSdkVersion()) {
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
const ENV_PAGE_DIRS = ['docs/recipes', 'docs/guides', 'docs/nest'];

const readEnvPages = () =>
  Object.fromEntries(
    ENV_PAGE_DIRS.flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter((file) => file.endsWith('.md'))
        .map((file) => [`${dir}/${file}`, readFileSync(join(root, dir, file), 'utf8')]),
    ),
  );

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
 * Fails for every environment variable that a recipe, guide or Nest page uses when neither the starter nor the page defines it.
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

// The page clones the default branch, so the check reads main and not a tag.
const gitClone = (url, dir) => execFileSync('git', ['clone', '--depth', '1', '--branch', 'main', url, dir], { stdio: 'pipe' });

export async function main({
  env = process.env,
  clone = gitClone,
  page = readFileSync(pagePath, 'utf8'),
  sdkVersion = installedSdkVersion(),
  versionPages = readVersionPages(),
  envPages = readEnvPages(),
  log = console.log,
  warn = console.warn,
  error = console.error,
} = {}) {
  let dir = env.STARTER_DIR;
  let temp;
  if (!dir) {
    temp = mkdtempSync(join(tmpdir(), 'starter-sync-'));
    try {
      clone(STARTER_URL, temp);
    } catch (cause) {
      rmSync(temp, { recursive: true, force: true });
      const reason = `cannot clone ${STARTER_URL}: ${String(cause.stderr ?? cause.message).trim()}`;
      if (env.CI) {
        error(reason);
        return 1;
      }
      warn(`warning: ${reason}\nskipping the starter sync check outside CI`);
      return 0;
    }
    dir = temp;
  }
  try {
    const problems = [...checkSdkPin(dir, sdkVersion), ...checkStartFolders(dir, sdkVersion), ...checkPageVersions(versionPages, sdkVersion), ...checkCodeBlocks(page, dir), ...checkTree(page, dir), ...checkPorts(page, dir), ...checkEnvExamples(page, dir), ...checkEnvVars(envPages, dir)];
    for (const problem of problems) error(`starter-sync: ${problem}`);
    if (problems.length === 0) log(`starter-sync: ok (SDK ${sdkVersion}, ${STARTER_URL})`);
    return problems.length === 0 ? 0 : 1;
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main();
