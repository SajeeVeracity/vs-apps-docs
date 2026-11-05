import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeOf, nextLinks, section, titledSnippets, treesOf } from './page-helpers.mjs';

const NOTICE = /^:::warning\nNot yet written for Node\.js \+ TypeScript\. Read the \[Nest\.js version\]\(\.\.\/\.\.\/nest\/guides\/([\w-]+)\.md\)\.\n:::$/m;

for (const name of ['open-route-and-read-caller', 'handle-connector-events']) {
  const trees = treesOf(`guides/${name}.md`);
  const nest = trees.find(({ tree }) => tree === 'nest')?.text ?? '';
  const node = trees.find(({ tree }) => tree === 'node')?.text ?? '';

  test(`${name}: emitted once for each server`, () => {
    assert.deepEqual(trees.map(({ tree }) => tree), ['node', 'nest']);
  });

  test(`${name}: the Node.js tree is a notice that links the Nest.js version`, () => {
    assert.match(node, NOTICE);
    assert.equal(node.match(NOTICE)[1], name);
    assert.doesNotMatch(node, /^## /m);
  });

  test(`${name}: the Nest.js tree has the guide sections and no notice`, () => {
    assert.doesNotMatch(nest, /Not yet written/);
    const titles = nest.split(/^## /m).slice(1).map((s) => s.split('\n')[0]);
    assert.deepEqual(titles, ['Goal', 'Prerequisites', 'Steps', 'Result', 'Next step']);
  });

  test(`${name}: builds on the quickstart app, not on nest-adapter`, () => {
    const prerequisites = section(nest, 'Prerequisites');
    assert.match(prerequisites, /quickstart/);
    assert.doesNotMatch(nest, /nest-adapter/);
  });

  test(`${name}: every snippet title starts with client/, server/ or shared/ and the blocks keep type-only injection`, () => {
    for (const { title } of titledSnippets(nest)) assert.match(title, /^(server|shared)\//);
    assert.doesNotMatch(nest, /@Inject\(/);
  });

  test(`${name}: Next step is one link to the quickstart`, () => {
    assert.deepEqual(nextLinks(nest).map((l) => l.replace(/^(\.\.\/)+/, '')), ['quickstart.md']);
  });
}

const openRoute = treesOf('guides/open-route-and-read-caller.md').find(({ tree }) => tree === 'nest').text;

test('the open-route guide shows @Public, appCaller and AppRequest in labelled server files', () => {
  const body = titledSnippets(openRoute).filter(({ title }) => title.startsWith('server/')).map(({ body }) => body).join('\n');
  assert.match(body, /@Public\(\)/);
  assert.match(body, /\bappCaller\(/);
  assert.match(body, /\bAppRequest\b/);
  assert.match(body, /\bimport \{[^}]*\bappCaller\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
});

test('the open-route guide checks that the open route answers 200 and the caller route answers 401 with no token', () => {
  const steps = section(openRoute, 'Steps');
  const curls = [...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/([\w-]+)$/gm)].map((m) => m[1]);
  assert.equal(curls.length, 2);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`200`[^\n]*`401`/);
});

const connector = treesOf('guides/handle-connector-events.md').find(({ tree }) => tree === 'nest').text;
const connectorCode = titledSnippets(connector)
  .filter(({ title }) => /^(server|shared)\//.test(title))
  .map(({ body }) => body)
  .join('\n');

test('the connector-events guide says in one line why the framework-free subpath has no twin', () => {
  const lines = connector.split('\n').filter((line) => /`assertSpaceEvents`/.test(line));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /`\/server`/);
});

test('the connector-events guide registers a handler with ConnectorEventsService and checks a ConnectorExecuteResult', () => {
  assert.match(connectorCode, /\bimport \{[^}]*\bConnectorEventsService\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
  assert.match(connectorCode, /\.on\(\s*\{[^}]*\bappKey\b[^}]*\bslot\b[^}]*\bhandler\b/);
  assert.match(connectorCode, /\bimport type \{[^}]*\bConnectorExecuteResult\b[^}]*\} from '@vectoragents\/vs-apps'/);
  assert.match(connectorCode, /\bPromise<ConnectorExecuteResult>/);
  assert.match(connectorCode, /\.status\b/);
});

test('the connector-events guide declares the slot with a handler key that the code registers', () => {
  const declared = [...connector.matchAll(/^\s+key: '([\w-]+)',\n\s+label: '[^']+',\n\s+defaultEventTypes/gm)].map((m) => m[1]);
  assert.equal(declared.length, 1);
  assert.match(connectorCode, new RegExp(`handler: '${declared[0]}'`));
  assert.ok(codeOf(connector, 'support-slot.ts'));
});

test('the connector-events guide checks that the events route refuses a request with no token', () => {
  const steps = section(connector, 'Steps');
  assert.equal([...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/events\/hello-app$/gm)].length, 1);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`401`/);
});
