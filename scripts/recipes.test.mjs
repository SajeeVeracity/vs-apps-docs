import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { codeOf, linksOf, nextLinks, section, snippetsOf, titledSnippets, treesOf } from './page-helpers.mjs';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
// The Next-step chain order of the five client recipes.
const recipeNames = ['add-page-and-capability', 'gate-by-capability', 'read-app-context', 'list-members', 'expose-agent-actions'];
const nestRecipe = 'nest-adapter';
const openRouteGuide = 'open-route-and-read-caller';
const modelGuide = 'call-a-model-from-your-server';
const connectorGuide = 'handle-connector-events';
const pagesIn = (dir) =>
  readdirSync(join(docs, dir))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ path: join(docs, dir, name), name: name.replace(/\.md$/, ''), text: readFileSync(join(docs, dir, name), 'utf8') }));

const recipes = existsSync(join(docs, 'recipes')) ? pagesIn('recipes') : [];
const guides = existsSync(join(docs, 'guides')) ? pagesIn('guides') : [];
const nest = existsSync(join(docs, 'nest')) ? pagesIn('nest') : [];
const all = [...recipes, ...nest, ...guides];

test('has one recipe per ranked task, the Nest recipe, the two Nest-only guides and the call-a-model guide', () => {
  assert.deepEqual(recipes.map((r) => r.name).sort(), [...recipeNames].sort());
  const sixRecipes = [...recipes, ...nest.filter((page) => page.name === nestRecipe)].map((page) => page.name);
  assert.deepEqual(sixRecipes.sort(), [...recipeNames, nestRecipe].sort());
  assert.ok(nest.some((page) => page.name === nestRecipe));
  assert.ok(nest.some((page) => page.name === openRouteGuide));
  assert.ok(nest.some((page) => page.name === connectorGuide));
  assert.deepEqual(nest.map((page) => page.name).sort(), [connectorGuide, nestRecipe, openRouteGuide]);
  assert.ok(guides.some((page) => page.name === modelGuide));
});

test('every page follows the template and ends with a result and a next step', () => {
  for (const { name, text } of all) {
    const titles = text.split(/^## /m).slice(1).map((s) => s.split('\n')[0]);
    assert.deepEqual([titles[0], titles[1], titles[2]], ['Goal', 'Prerequisites', 'Steps'], name);
    assert.deepEqual(titles.slice(-2), ['Result', 'Next step'], name);
    assert.match(text, /^---\ntitle: .+\n(start: leads-app\n)?---\n/, name);
  }
});

test('every ts and tsx block is a labelled complete file with no ellipsis', () => {
  for (const { name, text } of all) {
    const code = [...text.matchAll(/^```(tsx?)([^\n]*)\n([\s\S]*?)^```/gm)];
    assert.ok(code.length >= 1, name);
    for (const [, , meta, body] of code) {
      assert.match(meta, /title="[\w./-]+"/, name);
      assert.doesNotMatch(body, /\.\.\.|…/, name);
    }
  }
});

test('links the reference, the quickstart and the glossary, and every link resolves', () => {
  for (const { path, name, text } of all) {
    assert.match(text, /\]\([./]+\/reference\/[\w-]+\.md/, name);
    assert.match(text, /\]\([./]+\/quickstart\.md/, name);
    assert.match(text, /\]\([./]+\/glossary\.md#[\w-]+\)/, name);
    for (const [, target] of text.matchAll(/\]\((\.[^)#]*\.md)(?:#[^)]*)?\)/g)) {
      assert.ok(existsSync(join(dirname(path), target)), `${name}: ${target}`);
    }
  }
});

test('never uses the csr-agents page', () => {
  for (const { name, text } of all) {
    assert.doesNotMatch(text, /csr-agents|csr:agents|csr\.agents/i, name);
  }
});

// Docusaurus slug of a heading: lowercase, drop punctuation, spaces to hyphens, or the explicit {#id}.
const slugOf = (heading) => {
  const explicit = heading.match(/\{#([\w-]+)\}\s*$/);
  if (explicit) return explicit[1];
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
};
const anchorsOf = (text) =>
  new Set([...text.replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) => slugOf(heading)));

test('every #anchor link from a recipe, guide or Nest page targets a heading that exists', () => {
  let checked = 0;
  for (const { path, name, text } of all) {
    for (const [, target, anchor] of text.matchAll(/\]\((\.[^)#]*\.md)#([^)]+)\)/g)) {
      const file = join(dirname(path), target);
      assert.ok(anchorsOf(readFileSync(file, 'utf8')).has(anchor), `${name}: ${target}#${anchor}`);
      checked += 1;
    }
  }
  assert.ok(checked > 20);
});

test('follows the writing standard', () => {
  for (const { name, text } of all) {
    assert.doesNotMatch(text, /—|–/, name);
    assert.doesNotMatch(text, /\b(we|our|let's)\b/i, name);
    assert.doesNotMatch(text, /\b(simply|just|easy|easily)\b/i, name);
  }
});

test('shell blocks have no prompt and one command per line', () => {
  for (const { name, text } of all) {
    for (const [, body] of text.matchAll(/^```bash\n([\s\S]*?)^```/gm)) {
      for (const line of body.trim().split('\n')) {
        assert.doesNotMatch(line, /^\$ /, name);
        assert.doesNotMatch(line, /&&|;\s*\w|\\$/, name);
      }
    }
  }
});

const docFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return docFiles(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });

test('no page names a script the starter lacks or the old Part 2 anchor', () => {
  for (const path of docFiles(docs)) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /check:server|dev:server|#part-2-add-the-app-to-space\b/, path);
  }
});

test('nest-adapter checks the server with dev:space and two curl lines', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  assert.match(text, /npm run dev:space/);
  assert.match(text, /curl .*localhost:<SERVER_PORT>\/api\/client-config/);
  assert.match(text, /curl .*localhost:<SERVER_PORT>\/api\/manifest\/hello-app/);
});

const gate = recipes.find((r) => r.name === 'gate-by-capability');
const gateTrees = treesOf('recipes/gate-by-capability.md');

test('gate-by-capability is a page for each pair and starts from the leads-app overlay', () => {
  assert.deepEqual(gateTrees.map(({ tree }) => tree), ['react/node', 'react/nest']);
  assert.match(gate.text, /^---\n[\s\S]*?^start: leads-app$[\s\S]*?\n---\n/m);
  for (const { tree, text } of gateTrees) {
    const prerequisites = section(text, 'Prerequisites');
    const server = tree.split('/')[1];
    assert.match(prerequisites, new RegExp(`^npm create @vectoragents/app leads-app -- --client react --server ${server} --start leads-app$`, 'm'), tree);
    assert.doesNotMatch(text, /git clone|recipes\/leads-app/, tree);
  }
});

test('gate-by-capability enforces lead:manage on GET /api/leads in each flavour', () => {
  const [node, nestTree] = gateTrees.map(({ text }) => snippetsOf(text));
  assert.match(gateTrees[0].text, /requireCapability\(req, 'lead:manage'\)/);
  assert.match(nestTree, /@RequireCapability\('lead:manage'\)/);
  assert.match(nestTree, /@Controller\('leads'\)/);
  assert.doesNotMatch(nestTree, /requireCapability\(req/);
  assert.doesNotMatch(node, /@RequireCapability|@nestjs\//);
  for (const { tree, text } of gateTrees) {
    assert.doesNotMatch(text, /<!--\s*\/?flavour/, tree);
    assert.match(text, /GET \/api\/leads/, tree);
    assert.match(snippetsOf(text), /<RequireCapability\b/, tree);
  }
});

test('gate-by-capability Nest block registers the controller in AppModule and uses no @Inject', () => {
  const nestText = gateTrees[1].text;
  assert.match(nestText, /`server\/src\/app\.module\.ts`[^\n]*`controllers`/);
  assert.doesNotMatch(nestText, /@Inject\(/);
});

test('gate-by-capability closes by sharing one fallback across at least two pages', () => {
  const steps = section(gate.text, 'Steps').split(/^### /m).slice(1);
  assert.match(steps.at(-1), /^\d+\. Share one fallback across pages\n/);
  assert.equal([...steps.at(-1).matchAll(/^```tsx title="client\/src\/\w+\.tsx"/gm)].length >= 2, true);
  assert.ok([...gate.text.matchAll(/<GatedPage\b/g)].length >= 2);
  assert.equal([...gate.text.matchAll(/fallback=/g)].length, 2);
});

const readContext = recipes.find((r) => r.name === 'read-app-context');

test('nest-adapter claims no bodyParser setting and warns that the credential store is in memory', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  assert.doesNotMatch(text, /bodyParser/);
  const warning = text.split('\n').filter((line) => /in memory/.test(line) && /loses them on restart/.test(line));
  assert.equal(warning.length, 1);
  assert.match(warning[0], /`AppCredentialStore`/);
  assert.match(warning[0], /your own storage/);
  assert.match(warning[0], /persistent store before production/);
});

test('nest-adapter next step links quickstart Part 2, then the open-route guide', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  const next = text.split(/^## /m).at(-1);
  assert.match(next, /^Next step\n/);
  assert.deepEqual(
    [...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]),
    ['../quickstart.md#part-2-add-the-app-to-a-space', `./${openRouteGuide}.md`],
  );
});

test('Nest pages share one snippet project, so no two Nest pages use the same snippet title', () => {
  const owners = new Map();
  for (const { name, text } of nest) {
    for (const [, title] of text.matchAll(/^```(?:tsx?|json)[^\n]*title="([^"]+)"/gm)) {
      assert.ok(!owners.has(title) || owners.get(title) === name, `${title} is in ${owners.get(title)} and ${name}`);
      owners.set(title, name);
    }
  }
});

const guide = () => nest.find((r) => r.name === openRouteGuide)?.text ?? '';

test('the open-route guide shows @Public, appCaller and AppRequest in labelled server files', () => {
  const code = [...guide().matchAll(/^```tsx?\s+title="(server\/[^"]+)"\n([\s\S]*?)^```/gm)];
  assert.ok(code.length >= 1);
  const body = code.map(([, , b]) => b).join('\n');
  assert.match(body, /@Public\(\)/);
  assert.match(body, /\bappCaller\(/);
  assert.match(body, /\bAppRequest\b/);
  assert.match(body, /\bimport \{[^}]*\bappCaller\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
});

test('the open-route guide checks that the open route answers 200 and the caller route answers 401 with no token', () => {
  const steps = section(guide(), 'Steps');
  const curls = [...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/([\w-]+)$/gm)].map((m) => m[1]);
  assert.equal(curls.length, 2);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`200`[^\n]*`401`/);
});

const connector = () => nest.find((r) => r.name === connectorGuide)?.text ?? '';
const connectorCode = () =>
  titledSnippets(connector()).filter(({ title }) => /^(server|shared)\//.test(title)).map(({ body }) => body).join('\n');

test('the connector-events guide says in one line why it has no plain twin', () => {
  const lines = connector().split('\n').filter((line) => /no plain twin/.test(line));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /`assertSpaceEvents`/);
  assert.match(lines[0], /`\/server`/);
});

test('the connector-events guide registers a handler with ConnectorEventsService and checks a ConnectorExecuteResult', () => {
  const body = connectorCode();
  assert.match(body, /\bimport \{[^}]*\bConnectorEventsService\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
  assert.match(body, /\.on\(\s*\{[^}]*\bappKey\b[^}]*\bslot\b[^}]*\bhandler\b/);
  assert.match(body, /\bimport type \{[^}]*\bConnectorExecuteResult\b[^}]*\} from '@vectoragents\/vs-apps'/);
  assert.match(body, /\bPromise<ConnectorExecuteResult>/);
  assert.match(body, /\.status\b/);
});

test('the connector-events guide declares the slot with a handler key that the code registers', () => {
  const declared = [...connector().matchAll(/^\s+key: '([\w-]+)',\n\s+label: '[^']+',\n\s+defaultEventTypes/gm)].map((m) => m[1]);
  assert.equal(declared.length, 1);
  assert.match(connectorCode(), new RegExp(`handler: '${declared[0]}'`));
});

test('the connector-events guide checks that the events route refuses a request with no token', () => {
  const steps = section(connector(), 'Steps');
  assert.equal([...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/events\/hello-app$/gm)].length, 1);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`401`/);
});

test('every link to nest-adapter points at its Nest folder location', () => {
  for (const path of docFiles(docs)) {
    const text = readFileSync(path, 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)#]*nest-adapter\.md)/g)) {
      assert.match(target, /(^|\/)nest\/nest-adapter\.md$|^\.\/nest-adapter\.md$/, `${path}: ${target}`);
      assert.ok(existsSync(join(dirname(path), target)), `${path}: ${target}`);
    }
  }
});

const expose = recipes.find((r) => r.name === 'expose-agent-actions');
const exposeCode = snippetsOf(expose.text);

test('expose-agent-actions starts from the leads-app overlay and installs zod 3', () => {
  assert.match(expose.text, /^---\n[\s\S]*?^start: leads-app$[\s\S]*?\n---\n/m);
  assert.match(section(expose.text, 'Prerequisites'), /^npm create @vectoragents\/app leads-app -- --client react --server node --start leads-app$/m);
  assert.doesNotMatch(expose.text, /recipes\/leads-app|git clone/);
  assert.match(expose.text, /^npm install zod@3\b.*$/m);
});

test('expose-agent-actions binds the action to a shared page key and names it leads.open_lead_list', () => {
  const pageIds = [...exposeCode.matchAll(/pageId: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(pageIds, ['leads']);
  assert.match(expose.text, /`leads\.open_lead_list`/);
});

test('expose-agent-actions names the catalog command, its entry file and the dev dependency', () => {
  assert.match(expose.text, /^npm install --save-dev vite-node --workspace client$/m);
  assert.match(expose.text, /^npm exec --workspace client -- vs-apps catalog extract scripts\/agent-catalog\.ts$/m);
  assert.match(expose.text, /```ts title="client\/scripts\/agent-catalog\.ts"/);
  assert.match(exposeCode, /extractAgentCatalog/);
  assert.match(exposeCode, /outPath: '\.\.\/server\/agent-catalog\.json'/);
  assert.doesNotMatch(expose.text, /Regenerate `agent-catalog\.json`/);
});

test('expose-agent-actions limits description and mounted-action claims to the SDK', () => {
  assert.doesNotMatch(expose.text, /only guidance/);
  assert.match(expose.text, /The SDK puts it in the manifest, which Space reads\./);
  assert.match(expose.text, /After each successful call, the SDK reports the mounted actions\./);
  assert.doesNotMatch(expose.text, /agent sees `leads/);
});

const callSpaceName = 'call-space-from-your-server';
const callSpace = Object.fromEntries(treesOf(`guides/${callSpaceName}.md`).map(({ tree, text }) => [tree.split('/')[0], text]));

test('Call Space from your server has a Node.js and a Nest.js tree, and no twin in the Nest folder', () => {
  assert.deepEqual(Object.keys(callSpace), ['node', 'nest']);
  assert.ok(!nest.some((page) => page.name === callSpaceName));
});

test('the Nest.js Call Space tree shows SpaceClientService, SpaceS2sService and AppActionsService in labelled server files', () => {
  const code = snippetsOf(callSpace.nest);
  for (const symbol of ['SpaceClientService', 'SpaceS2sService', 'AppActionsService']) {
    assert.match(code, new RegExp(`\\b${symbol}\\b`));
  }
  assert.match(code, /from '@vectoragents\/vs-apps\/nest'/);
  for (const [, title] of callSpace.nest.matchAll(/^```tsx?[^\n]*title="([^"]+)"/gm)) assert.match(title, /^server\//);
});

test('the Node.js Call Space tree uses createSpaceActionsClient and createSpaceS2sTokenProvider from the server subpath', () => {
  const code = snippetsOf(callSpace.node);
  assert.match(code, /\bcreateSpaceActionsClient\(/);
  assert.match(code, /\bcreateSpaceS2sTokenProvider\(/);
  assert.match(code, /from '@vectoragents\/vs-apps\/server'/);
  assert.doesNotMatch(callSpace.node, /\bNest(\.js|JS)?\b|@nestjs\/|@Injectable|AppActionsService|SpaceClientService|SpaceS2sService/);
});

test('the Nest.js Call Space tree warns that the credential store is in memory and is the one interface to implement', () => {
  const warning = callSpace.nest.split('\n').filter((line) => /in memory/.test(line) && /loses them on restart/.test(line));
  assert.equal(warning.length, 1);
  assert.match(warning[0], /`AppCredentialStore`/);
  assert.match(warning[0], /your own storage/);
  assert.match(warning[0], /persistent store before production/);
});

test('the Nest.js Call Space tree adds its controller to AppModule and keeps type-only constructor injection', () => {
  assert.match(callSpace.nest, /`server\/src\/app\.module\.ts`[^\n]*`controllers`/);
  assert.match(snippetsOf(callSpace.nest), /constructor\(\n\s+private readonly actions: AppActionsService,/);
  assert.doesNotMatch(callSpace.nest, /@Inject\(/);
});

test('both Call Space trees check that the two routes answer 401 with no token', () => {
  for (const text of Object.values(callSpace)) {
    const steps = section(text, 'Steps');
    assert.equal([...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/space\/(?:agent|connectors)$/gm)].length, 2);
    assert.match(steps, /\*\*Check\*\*:[^\n]*`401`/);
  }
});

const members = recipes.find((r) => r.name === 'list-members');

test('list-members needs the starter env var and a Space run, not the harness', () => {
  const prerequisites = section(members.text, 'Prerequisites');
  assert.match(prerequisites, /`SPACE_API_URL`/);
  assert.match(prerequisites, /`npm run dev:space`/);
  assert.match(prerequisites, /harness/);
});

test('list-members builds the roster from groups then useUsers of the group user ids', () => {
  assert.match(codeOf(members.text, 'TeamGroups.tsx'), /directory\s*\??\.groups\(\)/);
  assert.match(codeOf(members.text, 'GroupRoster.tsx'), /useUsers\(group\.userIds\)/);
});

test('list-members search and groups snippets catch a rejected call and render an error line', () => {
  for (const file of ['OwnerPicker.tsx', 'TeamGroups.tsx']) {
    const code = codeOf(members.text, file);
    assert.match(code, /\.catch\(|catch \(/, file);
    assert.match(code, /setError\(/, file);
    assert.match(code, /role="alert"/, file);
  }
});

test('list-members debounces search by a 300 ms effect timer that cleanup cancels', () => {
  const picker = codeOf(members.text, 'OwnerPicker.tsx');
  assert.match(picker, /useEffect\(/);
  assert.match(picker, /setTimeout\([\s\S]*?,\s*300\)/);
  assert.match(picker, /return \(\) => (?:\{[^}]*)?clearTimeout\(/);
});

test('list-members states the deleted flag as Space sends it and groups as the space lists them', () => {
  assert.match(members.text, /`deleted: true`/);
  assert.match(members.text, /cannot show/);
});

test('list-members mounts every component it builds in the leads page', () => {
  const steps = section(members.text, 'Steps').split(/^### /m).slice(1);
  const mount = steps.at(-1);
  assert.match(mount, /^5\. Mount the components\n/);
  assert.match(mount, /`client\/src\/LeadsPage\.tsx`/);
  for (const component of ['LeadOwners', 'OwnerPicker', 'TeamGroups']) assert.match(mount, new RegExp(`<${component}\\b`), component);
});

const addPage = recipes.find((r) => r.name === 'add-page-and-capability');
const addPageSteps = () => section(addPage.text, 'Steps').split(/^### /m).slice(1);

test('add-page-and-capability restart step says the starter tells Space and keeps Check for updates as the fallback', () => {
  const restart = addPageSteps().find((s) => /^\d+\. .*Space/.test(s));
  assert.ok(restart, 'a step about Space reading the manifest');
  assert.match(restart, /`SPACE_API_URL`/);
  assert.match(restart, /`npm run dev:space`/);
  assert.match(restart, /\*\*Check for updates\*\*/);
  assert.doesNotMatch(restart, /Restart the server\. A manifest change/);
});

test('add-page-and-capability links between pages without a reload through navigate and one shared pages array', () => {
  const step = addPageSteps().find((s) => /^\d+\. Link between pages without a reload\n/.test(s));
  assert.ok(step, 'a step named "Link between pages without a reload"');
  assert.match(step, /iframe/);
  assert.match(step, /history\.pushState\(/);
  assert.match(step, /<AppProvider[^>]*\bnavigate=|\bnavigate=\{navigate\}/);
  assert.match(step, /\bappPages\(/);
  assert.match(step, /\bPagePath\b/);
  assert.match(step, /event\.preventDefault\(\)/);
  assert.match(addPage.text, /^export type PagePath = \(typeof pages\)\[number\]\['path'\];$/m);
});

const modelTrees = Object.fromEntries(treesOf(`guides/${modelGuide}.md`).map(({ tree, text }) => [tree.split('/')[0], text]));

test('the Node.js call-a-model tree names no Nest term', () => {
  assert.doesNotMatch(modelTrees.node, /\bNest(\.js|JS)?\b|@nestjs\/|@vectoragents\/vs-apps\/nest/);
});

test('each call-a-model tree links the glossary at the first model slot and says what an unset slot does', () => {
  assert.deepEqual(Object.keys(modelTrees), ['node', 'nest']);
  for (const text of Object.values(modelTrees)) {
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    assert.equal(body.search(/model slot/i), body.indexOf('[model slot](') + 1);
    assert.match(body, /\[model slot\]\([./]+\/glossary\.md#model-slot\)/);
    assert.match(body, /If no one sets the slot, Space refuses the call with status `409`/);
  }
});

test('the Nest.js call-a-model tree injects SpaceAiService and passes the model slot key', () => {
  const body = titledSnippets(modelTrees.nest).map((c) => c.body).join('\n');
  assert.ok(titledSnippets(modelTrees.nest).every((c) => /^(client|server|shared)\//.test(c.title)));
  assert.match(body, /import \{[^}]*\bSpaceAiService\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
  assert.match(body, /\.getClientConfig\(\s*claims\.appId,\s*claims\.spaceId,\s*'lead-summary'/);
  assert.match(body, /\bkey: 'lead-summary'/);
  assert.match(body, /\bSpaceActionError\b/);
  assert.match(modelTrees.nest, /`server\/src\/app\.module\.ts`[^\n]*`controllers`/);
  assert.doesNotMatch(modelTrees.nest, /@Inject\(/);
});

test('the Node.js call-a-model tree builds createSpaceAiConfigProvider from the stored service secret', () => {
  const body = titledSnippets(modelTrees.node).map((c) => c.body).join('\n');
  assert.match(body, /import \{[^}]*\bcreateSpaceAiConfigProvider\b[^}]*\} from '@vectoragents\/vs-apps\/server'/);
  assert.match(body, /^\s+getServiceSecret,$/m);
  assert.match(body, /\bkey: 'lead-summary'/);
  assert.match(modelTrees.node, /requireCapability\(req, 'lead:manage'\)/);
  assert.match(modelTrees.node, /`\/api\/provision`/);
});

test('the call-a-model trees call the model with the returned config, never a fixed key or model', () => {
  for (const text of Object.values(modelTrees)) {
    const body = titledSnippets(text).map((c) => c.body).join('\n');
    assert.match(body, /config\.apiKey/);
    assert.match(body, /config\.baseUrl/);
    assert.match(body, /model: config\.model/);
    assert.doesNotMatch(body, /process\.env\.\w*(API_KEY|ANTHROPIC)/);
  }
});

test('the Nest.js call-a-model tree keeps the in-memory credential store warning', () => {
  const warning = modelTrees.nest.split('\n').filter((line) => /in memory/.test(line) && /loses (them|it) on restart/.test(line));
  assert.ok(warning.length >= 1);
  assert.match(warning.join('\n'), /`AppCredentialStore`/);
});

const a2aName = 'expose-app-as-a2a-agent';
const a2aTrees = Object.fromEntries(treesOf(`guides/${a2aName}.md`).map(({ tree, text }) => [tree.split('/')[0], text]));
const a2a = a2aTrees.node;
const a2aCode = () => titledSnippets(a2a).map((c) => c.body).join('\n');

test('the A2A guide defines A2A at first use with a glossary link', () => {
  assert.notEqual(a2a, '');
  const first = a2a.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').find((line) => /A2A/.test(line));
  assert.match(first, /\[A2A\]\((\.\.\/)+glossary\.md#a2a\)/);
});

test('the A2A guide builds the card with buildAppAgentCard and answers with createA2aRequestHandler in labelled server files', () => {
  const body = a2aCode();
  assert.match(body, /import \{[^}]*\bbuildAppAgentCard\b[^}]*\} from '@vectoragents\/vs-apps\/server'/);
  assert.match(body, /import \{[^}]*\bcreateA2aRequestHandler\b[^}]*\} from '@vectoragents\/vs-apps\/server'/);
  assert.match(body, /\bbuildAppAgentCard\(\{/);
  assert.match(body, /\bcreateA2aRequestHandler</);
  assert.match(body, /\bassertSpaceS2s\(/);
  assert.match(body, /kind: 'a2a'/);
  for (const { title } of titledSnippets(a2a)) assert.match(title, /^(server|shared)\//);
});

test('the A2A guide declares the agent in the definition with the card URL template', () => {
  const body = a2aCode();
  assert.match(body, /\bagents: \[/);
  assert.match(body, /protocol: 'a2a'/);
  assert.match(body, /cardUrlTemplate: '\{publicBaseUrl\}\/api\/a2a\/\{spaceId\}'/);
});

test('the A2A guide has a Node.js tree with the steps and a Nest.js tree with the not-yet-written notice', () => {
  assert.deepEqual(Object.keys(a2aTrees), ['node', 'nest']);
  assert.doesNotMatch(a2a, /\bNest(\.js|JS)?\b|@nestjs\/|@Injectable|Not yet written/);
  assert.match(a2aTrees.nest, /Not yet written for Nest\.js\. Read the \[Node\.js \+ TypeScript version\]\(/);
  assert.equal(titledSnippets(a2aTrees.nest).length, 0);
  assert.doesNotMatch(a2aTrees.nest, /@nestjs\//);
});

test('the A2A guide checks the card and a refused call', () => {
  const steps = section(a2a, 'Steps');
  assert.equal([...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/a2a\/1(?:\/\.well-known\/agent-card\.json)?$/gm)].length, 2);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`401`/);
});

const trees = guides.find((r) => r.name === 'agent-action-trees');
const filterNav = guides.find((r) => r.name === 'filter-navigation-by-capability');
const nestAdapter = nest.find((r) => r.name === nestRecipe);
const sharedKeys = (text) => [...snippetsOf(text).matchAll(/\b(?:key|capability|pageId): '([^']+)'/g)].map(([, key]) => key);

test('agent-action-trees uses the leads page and the shared action ids', () => {
  assert.deepEqual(sharedKeys(trees.text), ['leads']);
  assert.match(trees.text, /`leads\.export_leads`/);
  assert.match(trees.text, /dispatch\('leads\.open_lead_list'/);
});

test('filter-navigation-by-capability gates leads and icp and leaves home ungated', () => {
  assert.doesNotMatch(filterNav.text, /hello:view/);
  for (const key of ['leads', 'icp', 'lead:manage', 'icp:manage']) assert.ok(snippetsOf(filterNav.text).includes(`'${key}'`), key);
});

test('filter-navigation-by-capability names the leads-app start and its scaffold command, not the old folder', () => {
  assert.match(filterNav.text, /^---\n[\s\S]*?^start: leads-app$[\s\S]*?\n---\n/m);
  const [{ text }] = treesOf('guides/filter-navigation-by-capability.md');
  assert.match(section(text, 'Prerequisites'), /`npm create @vectoragents\/app leads-app -- --client react --server node --start leads-app`/);
  assert.doesNotMatch(text, /recipes\/leads-app|git clone/);
});

test('nest-adapter gates with the shared lead:manage capability', () => {
  assert.match(nestAdapter.text, /refuses a token that lacks the `lead:manage` \[capability\]/);
  assert.match(snippetsOf(nestAdapter.text), /@RequireCapability\('lead:manage'\)/);
  assert.match(snippetsOf(nestAdapter.text), /export const CAPABILITY = 'lead:manage';/);
  assert.deepEqual(sharedKeys(nestAdapter.text).filter((k) => !['hello-app', 'leads', 'lead:manage'].includes(k)), []);
});

test('each guide Next step has one link that resolves', () => {
  for (const page of [...guides, ...nest.filter((p) => p.name !== nestRecipe)]) {
    const links = nextLinks(page.text);
    assert.equal(links.length, 1, page.path);
    assert.ok(existsSync(join(dirname(page.path), links[0].split('#')[0])), `${page.path}: ${links[0]}`);
  }
});

test('each recipe Next step links the next recipe in the chain, and the last links agent-action-trees', () => {
  const targets = [...recipeNames.slice(1).map((name) => `./${name}.md`), '../guides/agent-action-trees.md'];
  recipeNames.forEach((name, index) => {
    assert.deepEqual(nextLinks(recipes.find((r) => r.name === name).text), [targets[index]], name);
  });
});

const bracketBody = (code, open) => {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '[') depth++;
    if (code[i] === ']' && --depth === 0) return code.slice(open, i);
  }
  return code.slice(open);
};
const keyUse = (text) => {
  const code = snippetsOf(text, 'tsx?|json');
  const first = (pattern) => [...code.matchAll(pattern)].map(([, key]) => key);
  const pageArrays = [...code.matchAll(/\bpages\b[^=\[:\n]*[=:]\s*\[/g)].map((m) => bracketBody(code, m.index + m[0].length - 1));
  return {
    app: [...first(/\bdefineApp\(\{\s*key: '([^']+)'/g), ...first(/\bappKey: '([^']+)'/g)],
    pages: [
      ...pageArrays.flatMap((body) => [...body.matchAll(/\bkey: '([^']+)'/g)].map(([, key]) => key)),
      ...first(/\b(?:pageId|defaultPageKey): '([^']+)'/g),
      ...first(/\bhref="\/([^"]*)"/g),
    ],
    capabilities: first(/['"]([a-z]+:[a-z]+)['"]/g).filter((key) => !['node'].includes(key.split(':')[0])),
  };
};
// The starter's own `home` page and `hello:view` capability, kept where a page extends the starter definition.
const starterOwned = {
  home: ['add-page-and-capability', 'gate-by-capability', 'filter-navigation-by-capability', 'expose-app-as-a2a-agent'],
  'hello:view': ['add-page-and-capability', 'gate-by-capability', 'expose-app-as-a2a-agent'],
};

test('every recipe and guide snippet uses only the shared app, page and capability keys', () => {
  const shared = { app: ['hello-app'], pages: ['leads', 'icp'], capabilities: ['lead:manage', 'icp:manage'] };
  const seen = { app: new Set(), pages: new Set(), capabilities: new Set() };
  for (const { name, text } of all) {
    const use = keyUse(text);
    for (const kind of Object.keys(shared)) {
      const owned = Object.entries(starterOwned).filter(([, names]) => names.includes(name)).map(([key]) => key);
      assert.deepEqual(use[kind].filter((key) => !shared[kind].includes(key) && !owned.includes(key)), [], `${name} ${kind}`);
      use[kind].forEach((key) => seen[kind].add(key));
    }
  }
  for (const kind of Object.keys(shared)) assert.deepEqual(shared[kind].filter((key) => !seen[kind].has(key)), [], kind);
});

test('a starter-owned key is allowed only on a page whose snippets still use it', () => {
  for (const [key, names] of Object.entries(starterOwned)) {
    for (const name of names) {
      const use = keyUse(all.find((page) => page.name === name).text);
      assert.ok([...use.pages, ...use.capabilities].includes(key), `${name} no longer uses ${key}`);
    }
  }
});

test('no recipe, guide or Nest page except read-app-context names an SDR key', () => {
  for (const { name, text } of all.filter((page) => page.name !== 'read-app-context')) assert.doesNotMatch(text, /sdr/i, name);
});

test('the guides that moved start from the leads-app overlay and scaffold it for the pair of each tree', () => {
  for (const name of [callSpaceName, modelGuide, a2aName]) {
    const page = guides.find((g) => g.name === name);
    assert.match(page.text, /^---\n[\s\S]*?^start: leads-app$[\s\S]*?\n---\n/m, name);
    for (const { tree, text } of treesOf(`guides/${name}.md`)) {
      const server = tree.split('/')[0];
      assert.match(section(text, 'Prerequisites'), new RegExp(`^npm create @vectoragents/app leads-app -- --client react --server ${server} --start leads-app$`, 'm'), `${name} ${tree}`);
      assert.doesNotMatch(text, /recipes\/leads-app|git clone/, `${name} ${tree}`);
    }
  }
});

test('no moved page keeps a link into the deleted Nest twins', () => {
  for (const path of docFiles(docs)) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /nest\/(call-space-from-your-server|call-a-model-from-your-server)/, path);
    if (path.includes(`${join(docs, 'nest')}`)) assert.doesNotMatch(text, /\]\(\.\/(call-space-from-your-server|call-a-model-from-your-server)\.md/, path);
  }
});

const nestGuides = nest.filter((page) => page.name !== nestRecipe);
const prerequisiteLinks = (page) => linksOf(section(page.text, 'Prerequisites'));

test('every Nest-only guide names nest-adapter and every guide names expose-agent-actions as prerequisite', () => {
  assert.equal(nestGuides.length, 2);
  for (const page of nestGuides) assert.ok(prerequisiteLinks(page).includes('./nest-adapter.md'), page.name);
  assert.ok(guides.length >= 5);
  for (const page of guides) assert.ok(prerequisiteLinks(page).includes('../recipes/expose-agent-actions.md'), page.name);
});

test('the Space origin comes from SPACE_API_URL on every page, never SPACE_BASE_URL', () => {
  for (const { name, text } of all) assert.doesNotMatch(text, /SPACE_BASE_URL/, name);
});

test('no page tells the reader to install zod without version 3, disable bodyParser or pass a stable array', () => {
  for (const path of docFiles(docs)) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /npm install zod(?!@3)/, path);
    assert.doesNotMatch(text, /bodyParser: false/, path);
    assert.doesNotMatch(text, /pass a stable array/i, path);
    assert.doesNotMatch(text, /sdr-leads/, path);
    assert.doesNotMatch(text, /A deleted user (stays|keeps)/, path);
  }
});
