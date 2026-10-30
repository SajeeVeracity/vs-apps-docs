import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkFences } from './starter-sync.mjs';
import { STARTER_URL } from './starter-url.mjs';
import { voiceViolations } from './voice.mjs';

const text = readFileSync(new URL('../docs/quickstart.md', import.meta.url), 'utf8');
const sections = text.split(/^## /m).slice(1);
const titles = sections.map((s) => s.split('\n')[0]);
const section = (prefix) => sections.find((s) => s.startsWith(prefix));
const fences = [...text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)].map(([, lang, meta, body]) => ({ lang, meta, body }));
const part1 = section('Part 1');
const part2 = section('Part 2');
const goal = section('Goal');
const result = section('Result');
const subsections = (part) => part.split(/^### /m).slice(1);
const steps = (part) => subsections(part).filter((s) => /^\d+\. /.test(s));
const title = (step) => step.split('\n')[0];
const hasCheck = (step) => step.includes('**Check**');
const count = (re) => (text.match(re) ?? []).length;
const prose = text
  .replace(/^---\n[\s\S]*?\n---\n/, '')
  .replace(/^```[\s\S]*?^```/gm, '')
  .replace(/^#{1,6} .*$/gm, '');

test('follows the tutorial voice checked by voiceViolations', () => {
  assert.deepEqual(voiceViolations(text), []);
});

test('follows the page order', () => {
  assert.deepEqual(titles, [
    'Goal',
    'Prerequisites',
    'Part 1: Run the app locally',
    'Part 2: Add the app to a Space',
    'Result',
    'Next steps',
  ]);
});

test('has the Quickstart frontmatter title and a one-paragraph opening that links Space', () => {
  assert.match(text, /^---\ntitle: Quickstart\n/);
  const opening = text.replace(/^---\n[\s\S]*?\n---\n/, '').trim().split('\n\n')[0];
  assert.doesNotMatch(opening, /^#/);
  assert.match(opening, /\(\.\/glossary\.md#space\)/);
});

test('Goal names both end states and ends with the Mermaid diagram and its caption', () => {
  assert.match(goal, /harness/);
  assert.match(goal, /open in a Space/);
  const diagrams = fences.filter((f) => f.lang === 'mermaid');
  assert.equal(diagrams.length, 1);
  const [{ body }] = diagrams;
  assert.match(body, /^sequenceDiagram$/m);
  assert.match(body, /^\s+accTitle: \S/m);
  assert.match(body, /^\s+accDescr: \S/m);
  assert.equal(count(/^\s+participant \w+ as /gm), 4);
  assert.match(body, /display only/);
  assert.ok(goal.includes('```mermaid'));
  assert.match(goal.split('```mermaid')[1].split(/^```$/m)[1], /Only the server check protects data\./);
});

test('the one mermaid fence sits inside DiagramControls, imported right after the opening paragraph', () => {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const [opening, importLine] = body.split('\n\n');
  assert.doesNotMatch(opening, /DiagramControls/);
  assert.equal(importLine, "import DiagramControls from '@site/src/components/DiagramControls';");
  assert.match(text, /<DiagramControls>\n\n```mermaid\n[\s\S]*?\n```\n\n<\/DiagramControls>\n\nSpace mints the token/);
  assert.equal(count(/<DiagramControls>/g), 1);
});

test('prerequisites are one app-side checklist and state the baseline once', () => {
  const prerequisites = section('Prerequisites');
  const items = prerequisites.split('\n').filter((l) => /^- /.test(l));
  assert.ok(items.length >= 2);
  for (const line of items) assert.match(line, /^- \[ \] /);
  assert.match(prerequisites, /Node\.js 20\.19/);
  assert.match(prerequisites, /`read:packages`/);
  assert.equal(count(/20\.19/g), 1);
  assert.doesNotMatch(prerequisites, /space manager|published agent|Space server/i);
});

test('Part 1 has the six steps, numbered from 1', () => {
  const list = steps(part1);
  assert.deepEqual(list.map(title), [
    '1. Clone the starter and install',
    '2. Read the app definition',
    '3. Serve the manifest and client config',
    '4. Verify the token on the server',
    '5. Read the token in the page',
    '6. Run the app in the harness',
  ]);
});

test('Part 2 has Before you start, then six steps with roles only on steps 3, 4 and 5', () => {
  const [intro, ...rest] = subsections(part2);
  assert.equal(title(intro), 'Before you start');
  const items = intro.split('\n').filter((l) => /^- /.test(l));
  assert.equal(items.length, 3);
  for (const line of items) assert.match(line, /^- \[ \] /);
  assert.deepEqual(rest.map(title), [
    '1. Point the app at your Space',
    '2. Ask Vector to register the app',
    '3. Publish the space agent (space manager)',
    '4. Add the app to a space (space manager)',
    '5. Share the app with a user (space manager)',
    '6. Open the page',
  ]);
  assert.match(intro, /\]\(#3-publish-the-space-agent-space-manager\)/);
  assert.equal(count(/\(space manager\)$/gm), 3);
  assert.match(text, /ready to do steps 3, 4 and 5\./);
  assert.match(text, /In step 4, \*\*Hello app\*\* appears/);
  assert.doesNotMatch(text, /Each step names the role/);
});

test('Checks sit in Part 1 steps 1 and 6 and in every Part 2 step', () => {
  assert.deepEqual(steps(part1).map(hasCheck), [true, false, false, false, false, true]);
  for (const step of steps(part2)) assert.ok(hasCheck(step), title(step));
});

test('one tree of the cloned layout, after clone, with no per-step trees or new markers', () => {
  const trees = fences.filter((f) => f.lang === 'text' && /^hello-app\/$/m.test(f.body));
  assert.equal(trees.length, 1);
  assert.ok(steps(part1)[0].includes(trees[0].body));
  for (const name of ['client/', 'server/', 'shared/', '.env.example', 'index.html', 'main.tsx', 'vite.config.ts']) {
    assert.ok(trees[0].body.includes(name), name);
  }
  assert.doesNotMatch(trees[0].body, /node_modules|package-lock|agent-catalog/);
  assert.doesNotMatch(text, /# new\b/);
});

test('the clone command uses the one shared starter URL', () => {
  assert.match(STARTER_URL, /^https:\/\/github\.com\/[\w-]+\/vector-app-quickstart\.git$/);
  assert.match(steps(part1)[0], new RegExp(`^git clone ${STARTER_URL.replaceAll('.', '\\.')} hello-app$`, 'm'));
  const urls = text.match(/https:\/\/github\.com\/\S*vector-app-quickstart\S*/g) ?? [];
  assert.ok(urls.length >= 1);
  for (const url of urls) assert.equal(url, STARTER_URL);
});

test('commands run in the step that needs them', () => {
  const list = steps(part1);
  assert.equal(count(/export GITHUB_PACKAGES_TOKEN=/g), 1);
  assert.match(list[0], /^export GITHUB_PACKAGES_TOKEN=/m);
  assert.match(list[0], /^npm install$/m);
  assert.match(list[0], /^\*\*Check\*\*: run `npm ls @vectoragents\/vs-apps`/m);
  assert.doesNotMatch(text, /_authToken=[A-Za-z0-9_]{20,}/);
  assert.match(list[5], /^npm run dev$/m);
  assert.match(list[5], /http:\/\/localhost:5173\/harness\.html/);
  assert.match(list[5], /^Waiting for Space\.$|Waiting for Space\./m);
  const space = steps(part2)[0];
  assert.match(space, /^cp \.env\.example \.env$/m);
  assert.match(space, /^npm run dev:space$/m);
  for (const name of ['SPACE_JWKS_URL', 'ALLOWED_PARENT_ORIGIN', 'PUBLIC_BASE_URL', 'SERVER_PORT', 'CLIENT_PORT']) {
    assert.match(space, new RegExp(`^- \`${name}\``, 'm'), name);
  }
  assert.match(space, /^\{"keys":\[$/m);
  assert.match(space, /\/api\/\.well-known\/apps\/jwks\.json/);
  for (const dropped of ['dev:server', 'dev:client', 'check:server', 'SPACE_BASE_URL']) {
    assert.doesNotMatch(text, new RegExp(dropped));
  }
});

test('the harness Check shows three lines and a limits sentence follows it', () => {
  const step = steps(part1)[5];
  const [, afterCheck] = step.split(/^\*\*Check\*\*/m);
  assert.match(
    afterCheck,
    /^Verified in the browser: user dev-user in space 1\.\nCapabilities: hello:view\nVerified on the server: space 1, user dev-user$/m,
  );
  const afterBlock = afterCheck.split(/^```$/m).at(-1);
  assert.match(afterBlock, /The harness signs its own tokens, so it proves your page and server but not your registration or Space access\./);
  assert.match(afterBlock, /Part 2 covers those\./);
});

test('the page says a client check is display only and the server check decides', () => {
  assert.match(steps(part1)[4], /display only/);
  assert.match(steps(part1)[4], /server check/);
});

test('every ts and tsx block is a starter excerpt of a named file with no ellipsis', () => {
  const code = fences.filter((f) => f.lang === 'ts' || f.lang === 'tsx');
  assert.ok(code.length >= 6);
  for (const f of code) {
    assert.match(f.meta, /title="[\w./-]+"/);
    assert.match(f.meta.replace(/title="[^"]*"/, ''), /(^|\s)starter(\s|$)/);
    assert.doesNotMatch(f.meta, /\badd\b/);
    assert.doesNotMatch(f.body, /\.\.\.|…/);
  }
});

test('shell blocks have no prompt and one command per line', () => {
  const shell = fences.filter((f) => f.lang === 'bash');
  assert.ok(shell.length >= 3);
  for (const f of shell) {
    for (const line of f.body.trim().split('\n')) {
      assert.doesNotMatch(line, /^\$ /);
      assert.doesNotMatch(line, /&&|;\s*\w|\\$/);
    }
  }
});

test('covers the server and client symbols and gates one page with one capability', () => {
  for (const s of [
    'defineApp',
    'buildManifests',
    'createSpaceTokenVerifier',
    'extractBearer',
    'assertCapability',
    'verifyAppUserToken',
    'verifyProvisioningToken',
    'AppProvider',
    'BootGate',
    'loadAppClientConfig',
    'RequireCapability',
  ]) {
    assert.match(text, new RegExp(s), s);
  }
  assert.match(text, /from 'node:http'/);
  assert.doesNotMatch(text, /@vectoragents\/vs-apps\/nest/);
  assert.equal(count(/'hello:view'/g), 1);
});

test('names Vite once the page shows it, so the baseline allowance holds', () => {
  assert.match(text, /\bVite\b/);
});

test('Part 2 click paths and Checks', () => {
  const [, , publish, addApp, share, open] = steps(part2);
  assert.match(publish, /\*\*Agent Studio\*\*/);
  assert.match(publish, /\*\*Publish All\*\*/);
  assert.match(publish, /All published/);
  assert.match(addApp, /\*\*Add an app\*\*/);
  assert.match(addApp, /App enabled/);
  assert.match(share, /\*\*Access\*\*/);
  assert.match(share, /\*\*Direct access\*\*/);
  assert.match(share, /Member added/);
  assert.match(share, /Save changes/);
  assert.match(share.split(/^\*\*Check\*\*/m).at(-1), /Access saved/);
  assert.match(
    open,
    /^Verified in the browser: user <id> in space <id>\.\nCapabilities: hello:view\nVerified on the server: space <id>, user <id>$/m,
  );
  assert.doesNotMatch(steps(part2)[1], /Auto-apply/);
});

test('the Result summarises the last Check and has no second output block', () => {
  assert.doesNotMatch(result, /^```/m);
  assert.match(result, /same three lines as the last Check/);
  assert.match(result, /one token/);
});

test('links the four glossary terms, the concept page and the harness reference', () => {
  assert.match(text, /\(\.\/app-definition\.md\)/);
  const links = [...text.matchAll(/\]\(\.\/glossary\.md#([\w-]+)\)/g)].map((m) => m[1]);
  assert.deepEqual([...links].sort(), ['app-definition', 'app-registration', 'harness', 'space']);
  assert.match(section('Next steps'), /\(\.\/reference\/harness\.md\)/);
});

test('defines capability, space manager and manifest in one clause at first use', () => {
  for (const term of ['capability', 'space manager', 'manifest']) {
    const at = prose.indexOf(term);
    assert.ok(at >= 0, term);
    assert.match(prose.slice(at + term.length), /^,\s(a|the)\s[^.]*?[,.]/, term);
  }
});

test('follows the writing standard', () => {
  assert.doesNotMatch(text, /—|–/);
  assert.doesNotMatch(text, /\b(we|our|let's)\b/i);
  assert.doesNotMatch(text, /\b(simply|just|easy|easily)\b/i);
});

// STARTER_DIR names a clone of the starter repo.
test('every starter fence is a verbatim substring of the starter file it names', { skip: !process.env.STARTER_DIR }, () => {
  assert.deepEqual(checkFences(text, process.env.STARTER_DIR), []);
});
