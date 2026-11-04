import assert from 'node:assert/strict';
import { test } from 'node:test';
import { section, treesOf } from './page-helpers.mjs';

const trees = treesOf('reference/harness.md');
const text = trees.find(({ tree }) => tree === 'node').text;
const nestText = trees.find(({ tree }) => tree === 'nest').text;

test('the page is emitted once for each server', () => {
  assert.deepEqual(trees.map(({ tree }) => tree), ['node', 'nest']);
});

test('the Nest.js tree shows a notice that links the Node.js version, and no dev-issuer setup', () => {
  assert.match(nestText, /^:::warning\nNot yet written for Nest\.js\. Read the \[Node\.js \+ TypeScript version\]\(\.\.\/\.\.\/node\/reference\/harness\.md\)\.\n:::$/m);
  assert.equal(section(nestText, 'Accept dev tokens'), '');
  assert.doesNotMatch(nestText, /createDevIssuer|AppPlatformModule|devIssuer|node:http/);
});

test('both trees keep the shared reference text', () => {
  for (const tree of [text, nestText]) {
    for (const heading of ['`VectorAppsHarness`', 'Dev routes', 'Turn the harness on and off', 'Limits']) assert.ok(section(tree, heading), heading);
    assert.match(tree, /GET \/api\/__dev\/manifests/);
    assert.match(tree, /VA_DEV_ISSUER=true/);
  }
});

test('prerequisites state React 18 and the dev-issuer flag', () => {
  const prerequisites = text.split(/^## /m).find((s) => s.startsWith('Prerequisites'));
  assert.match(prerequisites, /React 18/);
  assert.match(prerequisites, /VA_DEV_ISSUER=true/);
  assert.doesNotMatch(prerequisites, /React 19/);
});

test('both dev routes have a shape and the handler uses createDevIssuer on node:http', () => {
  for (const route of ['GET /api/__dev/manifests', 'POST /api/__dev/token']) assert.match(text, new RegExp(route));
  for (const field of ['appKey', 'appId', 'manifest', 'token', 'expiresIn', 'claims', 'kind', 'ttlSeconds']) {
    assert.match(text, new RegExp(`\`${field}\``), field);
  }
  assert.match(text, /from 'node:http'/);
  assert.match(text, /createDevIssuer/);
});

test('serves harness.html with "your bundler" and keeps the development-only warning', () => {
  assert.match(text, /your bundler/);
  assert.match(text, /Serve it only in development/);
});

const intro = text.split(/^## /m)[0];

test('intro says the starter includes the harness and makes no debugging-aside claim', () => {
  assert.match(intro, /starter includes the harness/);
  assert.match(intro, /not built from the starter/);
  assert.doesNotMatch(text, /debugging aside|to follow the quickstart/);
});

test('has no quickstart-specific main.ts paragraph or quickstart proxy wording', () => {
  assert.doesNotMatch(text, /quickstart/i);
  assert.doesNotMatch(text, /only when `VA_DEV_ISSUER=true`/);
});

test('documents the three changes that make the app accept dev tokens', () => {
  const changes = section(text, 'Accept dev tokens');
  assert.ok(changes, 'section "Accept dev tokens"');
  assert.match(changes, /ALLOWED_PARENT_ORIGIN/);
  assert.match(changes, /harness origin/);
  assert.match(changes, /client-config/);
  assert.match(changes, /spaceJwksUrl/);
  assert.match(changes, /\/api\/__dev\/jwks\.json/);
  assert.match(changes, /server\/src\/auth\.ts/);
  assert.match(changes, /verifyAppUserToken/);
  assert.match(changes, /devIssuer/);
});

test('harness.html has a root element and loads harness.tsx', () => {
  const html = /```html title="harness\.html"\n([\s\S]*?)```/.exec(text)?.[1];
  assert.ok(html, 'harness.html code block');
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module" src="\/src\/harness\.tsx"><\/script>/);
});

test('types appId as a UUID', () => {
  assert.match(text, /\| `appId` \| UUID \|/);
});

test('says where VA_DEV_ISSUER=true goes and that the server needs a restart', () => {
  const place = section(text, 'Turn the harness on and off');
  assert.ok(place, 'section "Turn the harness on and off"');
  assert.match(place, /environment of the app server process/);
  assert.match(place, /VA_DEV_ISSUER=true/);
  assert.match(place, /restart/i);
});

test('lists the five limits in full', () => {
  const limits = section(text, 'Limits');
  assert.ok(limits, 'section "Limits"');
  const items = limits.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(items.length, 5);
  for (const pattern of [/registration/, /fetch.*manifest/, /license.*space access/, /key set.*iframe URL/, /origin.*token/]) {
    assert.ok(items.some((i) => pattern.test(i)), String(pattern));
  }
});

test('follows the writing standard', () => {
  assert.doesNotMatch(text, /—|–/);
  assert.doesNotMatch(text, /\b(we|our|ours|us|let's)\b/i);
});
