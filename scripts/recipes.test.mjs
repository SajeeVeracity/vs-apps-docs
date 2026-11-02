import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const recipeNames = ['gate-by-capability', 'read-app-context', 'list-members', 'expose-agent-actions', 'add-page-and-capability'];
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

test('has one recipe per ranked task, the Nest recipe and the Nest guides in the Nest folder and at least one guide', () => {
  assert.deepEqual(recipes.map((r) => r.name).sort(), [...recipeNames].sort());
  assert.ok(nest.some((page) => page.name === nestRecipe));
  assert.ok(nest.some((page) => page.name === openRouteGuide));
  assert.ok(nest.some((page) => page.name === connectorGuide));
  assert.ok(nest.some((page) => page.name === modelGuide));
  assert.ok(guides.some((page) => page.name === modelGuide));
});

test('every page follows the template and ends with a result and a next step', () => {
  for (const { name, text } of all) {
    const titles = text.split(/^## /m).slice(1).map((s) => s.split('\n')[0]);
    assert.deepEqual([titles[0], titles[1], titles[2]], ['Goal', 'Prerequisites', 'Steps'], name);
    assert.deepEqual(titles.slice(-2), ['Result', 'Next step'], name);
    assert.match(text, /^---\ntitle: .+\n---\n/, name);
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

test('never uses the csr-agents page and uses SDR examples', () => {
  for (const { name, text } of all) {
    assert.doesNotMatch(text, /csr-agents|csr:agents|csr\.agents/i, name);
  }
  // nest-adapter mirrors the quickstart hello-app, which has no SDR example.
  assert.ok(recipes.every((r) => /sdr|lead|icp/i.test(r.text)));
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
const section = (text, title) => text.split(/^## /m).find((s) => s.startsWith(`${title}\n`)) ?? '';

test('gate-by-capability starts from the leads-app start folder of the starter', () => {
  const prerequisites = section(gate.text, 'Prerequisites');
  assert.match(prerequisites, /`recipes\/leads-app`/);
  assert.match(prerequisites, /git clone https:\/\/github\.com\/VectorAgents\/vector-app-quickstart\.git/);
});

test('gate-by-capability snippets use only the shared page and capability keys', () => {
  const code = [...gate.text.matchAll(/^```tsx?[^\n]*\n([\s\S]*?)^```/gm)].map(([, body]) => body).join('\n');
  const keys = (pattern) => [...code.matchAll(pattern)].map(([, key]) => key);
  assert.deepEqual(keys(/\bkey: '([^']+)'/g).filter((k) => !['hello-app', 'home', 'leads', 'icp', 'hello:view', 'lead:manage', 'icp:manage'].includes(k)), []);
  assert.deepEqual(keys(/\bcapability(?:: |=)['"]([^'"]+)['"]/g).filter((k) => !['hello:view', 'lead:manage', 'icp:manage'].includes(k)), []);
  assert.doesNotMatch(gate.text, /sdr/i);
});

test('gate-by-capability closes by sharing one fallback across at least two pages', () => {
  const steps = section(gate.text, 'Steps').split(/^### /m).slice(1);
  assert.match(steps.at(-1), /^\d+\. Share one fallback across pages\n/);
  assert.equal([...steps.at(-1).matchAll(/^```tsx title="client\/src\/\w+\.tsx"/gm)].length >= 2, true);
  assert.ok([...gate.text.matchAll(/<GatedPage\b/g)].length >= 2);
  assert.equal([...gate.text.matchAll(/fallback=/g)].length, 2);
});

test('gate-by-capability ends with one Next step: read-app-context', () => {
  const next = section(gate.text, 'Next step');
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map(([, link]) => link), ['./read-app-context.md']);
});

const readContext = recipes.find((r) => r.name === 'read-app-context');

test('read-app-context snippets use only the shared capability and page keys', () => {
  const code = [...readContext.text.matchAll(/^```tsx?[^\n]*\n([\s\S]*?)^```/gm)].map(([, body]) => body).join('\n');
  const capabilities = [...code.matchAll(/\bhasCapability\('([^']+)'\)/g)].map(([, key]) => key);
  assert.ok(capabilities.length >= 1);
  assert.deepEqual(capabilities.filter((k) => !['lead:manage', 'icp:manage'].includes(k)), []);
  assert.deepEqual([...code.matchAll(/\bhref="\/([^"]*)"/g)].map(([, path]) => path).filter((p) => !['leads', 'icp'].includes(p)), []);
});

test('read-app-context ends with one Next step: list-members', () => {
  const next = section(readContext.text, 'Next step');
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map(([, link]) => link), ['./list-members.md']);
});

test('nest-adapter claims no bodyParser setting and warns that the credential store is in memory', () => {
  const { text } = nest.find((r) => r.name === nestRecipe);
  assert.doesNotMatch(text, /bodyParser/);
  const warning = text.split('\n').filter((line) => /in memory/.test(line) && /loses them on restart/.test(line));
  assert.equal(warning.length, 1);
  assert.match(warning[0], /`AppCredentialStore`/);
  assert.match(warning[0], /your own storage/);
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

test('the open-route guide names nest-adapter as its prerequisite', () => {
  assert.match(section(guide(), 'Prerequisites'), /\]\(\.\/nest-adapter\.md\)/);
});

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

test('the open-route guide next step links one related page', () => {
  const next = section(guide(), 'Next step');
  const links = [...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(links.length, 1);
  assert.ok(existsSync(join(docs, 'nest', links[0].split('#')[0])), links[0]);
});

const connector = () => nest.find((r) => r.name === connectorGuide)?.text ?? '';
const connectorCode = () =>
  [...connector().matchAll(/^```tsx?\s+title="(server\/[^"]+|shared\/[^"]+)"\n([\s\S]*?)^```/gm)].map(([, , body]) => body).join('\n');

test('the connector-events guide names nest-adapter as its prerequisite', () => {
  assert.match(section(connector(), 'Prerequisites'), /\]\(\.\/nest-adapter\.md\)/);
});

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

test('the connector-events guide next step links one related page', () => {
  const links = [...section(connector(), 'Next step').matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(links.length, 1);
  assert.ok(existsSync(join(docs, 'nest', links[0].split('#')[0])), links[0]);
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
const exposeCode = expose.text.match(/^```tsx?[^\n]*\n[\s\S]*?^```/gm).join('\n');
const exposeSection = (title) => expose.text.split(/^## /m).find((s) => s.startsWith(`${title}\n`));

test('expose-agent-actions starts from recipes/leads-app and installs zod 3', () => {
  assert.match(exposeSection('Prerequisites'), /`recipes\/leads-app\/`/);
  assert.match(expose.text, /^npm install zod@3\b.*$/m);
  assert.doesNotMatch(expose.text, /npm install zod(?!@3)/);
});

test('expose-agent-actions binds the action to a shared page key and names it leads.open_lead_list', () => {
  const pageIds = [...exposeCode.matchAll(/pageId: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(pageIds, ['leads']);
  assert.match(expose.text, /`leads\.open_lead_list`/);
  assert.doesNotMatch(expose.text, /sdr-leads/);
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

test('expose-agent-actions next step links agent-action-trees only', () => {
  const next = exposeSection('Next step');
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]), ['../guides/agent-action-trees.md']);
});

const callSpaceName = 'call-space-from-your-server';
const callSpace = {
  nest: nest.find((r) => r.name === callSpaceName)?.text ?? '',
  plain: guides.find((r) => r.name === callSpaceName)?.text ?? '',
};
const snippetsOf = (text) => [...text.matchAll(/^```tsx?[^\n]*\n([\s\S]*?)^```/gm)].map(([, body]) => body).join('\n');

test('Call Space from your server exists as a Nest guide and a plain guide', () => {
  assert.notEqual(callSpace.nest, '');
  assert.notEqual(callSpace.plain, '');
});

test('the Nest guide names nest-adapter and the plain guide names expose-agent-actions as prerequisite', () => {
  assert.match(section(callSpace.nest, 'Prerequisites'), /\]\(\.\/nest-adapter\.md\)/);
  assert.match(section(callSpace.plain, 'Prerequisites'), /\]\(\.\.\/recipes\/expose-agent-actions\.md\)/);
});

test('each Call Space guide links its twin in Background', () => {
  const background = (text) => section(text, 'Prerequisites').split('\n').find((line) => /^- Background:/.test(line)) ?? '';
  assert.match(background(callSpace.nest), new RegExp(`\\]\\(\\.\\./guides/${callSpaceName}\\.md\\)`));
  assert.match(background(callSpace.plain), new RegExp(`\\]\\(\\.\\./nest/${callSpaceName}\\.md\\)`));
});

test('the Nest guide shows SpaceClientService, SpaceS2sService and AppActionsService in labelled server files', () => {
  const code = snippetsOf(callSpace.nest);
  for (const symbol of ['SpaceClientService', 'SpaceS2sService', 'AppActionsService']) {
    assert.match(code, new RegExp(`\\b${symbol}\\b`));
  }
  assert.match(code, /from '@vectoragents\/vs-apps\/nest'/);
  for (const [, title] of callSpace.nest.matchAll(/^```tsx?[^\n]*title="([^"]+)"/gm)) assert.match(title, /^server\//);
});

test('the plain guide uses createSpaceActionsClient and createSpaceS2sTokenProvider from the server subpath', () => {
  const code = snippetsOf(callSpace.plain);
  assert.match(code, /\bcreateSpaceActionsClient\(/);
  assert.match(code, /\bcreateSpaceS2sTokenProvider\(/);
  assert.match(code, /from '@vectoragents\/vs-apps\/server'/);
  assert.doesNotMatch(callSpace.plain, /\bNest(JS)?\b|@nestjs\/|@Injectable|AppActionsService|SpaceClientService|SpaceS2sService/);
});

test('both Call Space guides use only the shared capability keys', () => {
  for (const text of Object.values(callSpace)) {
    const keys = [...text.matchAll(/'([a-z]+:[a-z]+)'/g)].map((m) => m[1]).filter((k) => !k.startsWith('node:'));
    assert.ok(keys.length >= 1);
    assert.deepEqual(keys.filter((k) => !['lead:manage', 'icp:manage'].includes(k)), []);
  }
});

test('the Nest Call Space guide warns that the credential store is in memory and is the one interface to implement', () => {
  const warning = callSpace.nest.split('\n').filter((line) => /in memory/.test(line) && /loses them on restart/.test(line));
  assert.equal(warning.length, 1);
  assert.match(warning[0], /`AppCredentialStore`/);
  assert.match(warning[0], /your own storage/);
});

test('each Call Space guide ends with one Next step link that resolves', () => {
  for (const [dir, text] of [['nest', callSpace.nest], ['guides', callSpace.plain]]) {
    const links = [...section(text, 'Next step').matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    assert.equal(links.length, 1, dir);
    assert.ok(existsSync(join(docs, dir, links[0].split('#')[0])), links[0]);
  }
});

const members = recipes.find((r) => r.name === 'list-members');
const codeOf = (page, titleFile) =>
  [...page.text.matchAll(/^```tsx? title="([^"]+)"[^\n]*\n([\s\S]*?)^```/gm)].find(([, title]) => title.endsWith(titleFile))?.[2] ?? '';

test('list-members needs the starter env var and a Space run, not the harness', () => {
  const prerequisites = section(members.text, 'Prerequisites');
  assert.match(prerequisites, /`SPACE_API_URL`/);
  assert.match(prerequisites, /`npm run dev:space`/);
  assert.match(prerequisites, /harness/);
});

test('list-members and the useUsers reference drop the stable array instruction', () => {
  const reference = readFileSync(join(docs, 'reference', 'react.md'), 'utf8');
  assert.doesNotMatch(members.text, /stable array/i);
  assert.doesNotMatch(reference, /stable array/i);
});

test('list-members builds the roster from groups then useUsers of the group user ids', () => {
  assert.match(codeOf(members, 'TeamGroups.tsx'), /directory\s*\??\.groups\(\)/);
  assert.match(codeOf(members, 'GroupRoster.tsx'), /useUsers\(group\.userIds\)/);
});

test('list-members search and groups snippets catch a rejected call and render an error line', () => {
  for (const file of ['OwnerPicker.tsx', 'TeamGroups.tsx']) {
    const code = codeOf(members, file);
    assert.match(code, /\.catch\(|catch \(/, file);
    assert.match(code, /setError\(/, file);
    assert.match(code, /role="alert"/, file);
  }
});

test('list-members debounces search by a 300 ms effect timer that cleanup cancels', () => {
  const picker = codeOf(members, 'OwnerPicker.tsx');
  assert.match(picker, /useEffect\(/);
  assert.match(picker, /setTimeout\([\s\S]*?,\s*300\)/);
  assert.match(picker, /return \(\) => (?:\{[^}]*)?clearTimeout\(/);
});

test('list-members states the deleted flag as Space sends it and groups as the space lists them', () => {
  assert.match(members.text, /`deleted: true`/);
  assert.match(members.text, /cannot show/);
});

test('list-members snippets use only the shared keys', () => {
  assert.doesNotMatch(members.text, /sdr/i);
  assert.deepEqual([...members.text.matchAll(/\b(?:key|capability): '([^']+)'/g)].map(([, key]) => key).filter((k) => !['hello-app', 'leads', 'icp', 'lead:manage', 'icp:manage'].includes(k)), []);
});

test('list-members ends with one Next step: expose-agent-actions', () => {
  const next = section(members.text, 'Next step');
  assert.deepEqual([...next.matchAll(/\]\(([^)]+)\)/g)].map(([, link]) => link), ['./expose-agent-actions.md']);
});

const nestModel = () => nest.find((r) => r.name === modelGuide)?.text ?? '';
const plainModel = () => guides.find((r) => r.name === modelGuide)?.text ?? '';
const linksOf = (text) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
const titledSnippets = (text) => [...text.matchAll(/^```tsx?\s+title="([^"]+)"\n([\s\S]*?)^```/gm)].map(([, title, body]) => ({ title, body }));

test('the call-a-model guides name their prerequisite recipe', () => {
  assert.match(section(nestModel(), 'Prerequisites'), /\]\(\.\/nest-adapter\.md\)/);
  assert.match(section(plainModel(), 'Prerequisites'), /\]\(\.\.\/recipes\/expose-agent-actions\.md\)/);
});

test('the call-a-model guides link their twin in Background, and the plain guide names no Nest term', () => {
  assert.ok(linksOf(section(nestModel(), 'Prerequisites')).includes(`../guides/${modelGuide}.md`));
  assert.ok(linksOf(section(plainModel(), 'Prerequisites')).includes(`../nest/${modelGuide}.md`));
  assert.doesNotMatch(plainModel(), /\bNest(JS)?\b|@nestjs\/|@vectoragents\/vs-apps\/nest/);
});

test('each call-a-model guide links the glossary at the first model slot and says what an unset slot does', () => {
  for (const text of [nestModel(), plainModel()]) {
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    assert.equal(body.search(/model slot/i), body.indexOf('[model slot](') + 1);
    assert.match(body, /\[model slot\]\([./]+\/glossary\.md#model-slot\)/);
    assert.match(body, /If no one sets the slot, Space refuses the call with status `409`/);
  }
});

test('the Nest call-a-model guide injects SpaceAiService and passes the model slot key', () => {
  const body = titledSnippets(nestModel()).map((c) => c.body).join('\n');
  assert.ok(titledSnippets(nestModel()).every((c) => /^(client|server|shared)\//.test(c.title)));
  assert.match(body, /import \{[^}]*\bSpaceAiService\b[^}]*\} from '@vectoragents\/vs-apps\/nest'/);
  assert.match(body, /\.getClientConfig\(\s*claims\.appId,\s*claims\.spaceId,\s*'lead-summary'/);
  assert.match(body, /\bkey: 'lead-summary'/);
  assert.match(body, /\bSpaceActionError\b/);
});

test('the plain call-a-model guide builds createSpaceAiConfigProvider from the stored service secret', () => {
  const body = titledSnippets(plainModel()).map((c) => c.body).join('\n');
  assert.match(body, /import \{[^}]*\bcreateSpaceAiConfigProvider\b[^}]*\} from '@vectoragents\/vs-apps\/server'/);
  assert.match(body, /^\s+getServiceSecret,$/m);
  assert.match(body, /\bkey: 'lead-summary'/);
  assert.match(plainModel(), /requireCapability\(req, 'lead:manage'\)/);
  assert.match(plainModel(), /`\/api\/provision`/);
});

test('the call-a-model guides call the model with the returned config, never a fixed key or model', () => {
  for (const text of [nestModel(), plainModel()]) {
    const body = titledSnippets(text).map((c) => c.body).join('\n');
    assert.match(body, /config\.apiKey/);
    assert.match(body, /config\.baseUrl/);
    assert.match(body, /model: config\.model/);
    assert.doesNotMatch(body, /process\.env\.\w*(API_KEY|ANTHROPIC)/);
  }
});

test('the call-a-model guides each end with one related Next step that resolves', () => {
  for (const [dir, text] of [['nest', nestModel()], ['guides', plainModel()]]) {
    const links = linksOf(section(text, 'Next step'));
    assert.equal(links.length, 1);
    assert.ok(existsSync(join(docs, dir, links[0].split('#')[0])), links[0]);
  }
});

const a2aName = 'expose-app-as-a2a-agent';
const a2a = guides.find((r) => r.name === a2aName)?.text ?? '';
const a2aCode = () => titledSnippets(a2a).map((c) => c.body).join('\n');

test('the A2A guide names expose-agent-actions as prerequisite and defines A2A at first use with a glossary link', () => {
  assert.notEqual(a2a, '');
  assert.match(section(a2a, 'Prerequisites'), /\]\(\.\.\/recipes\/expose-agent-actions\.md\)/);
  const first = a2a.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').find((line) => /A2A/.test(line));
  assert.match(first, /\[A2A\]\(\.\.\/glossary\.md#a2a\)/);
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

test('the A2A guide uses only the shared keys and names no Nest term', () => {
  const keys = [...a2a.matchAll(/'([a-z]+:[a-z]+)'/g)].map((m) => m[1]).filter((k) => !k.startsWith('node:'));
  assert.deepEqual(keys.filter((k) => !['hello:view', 'lead:manage', 'icp:manage'].includes(k)), []);
  assert.doesNotMatch(a2a, /\bNest(JS)?\b|@nestjs\/|@Injectable/);
});

test('the A2A guide checks the card and a refused call, and ends with one related Next step', () => {
  const steps = section(a2a, 'Steps');
  assert.equal([...steps.matchAll(/^curl .*localhost:<SERVER_PORT>\/api\/a2a\/1(?:\/\.well-known\/agent-card\.json)?$/gm)].length, 2);
  assert.match(steps, /\*\*Check\*\*:[^\n]*`401`/);
  const links = linksOf(section(a2a, 'Next step'));
  assert.equal(links.length, 1);
  assert.ok(existsSync(join(docs, 'guides', links[0].split('#')[0])), links[0]);
});

const trees = guides.find((r) => r.name === 'agent-action-trees');
const filterNav = guides.find((r) => r.name === 'filter-navigation-by-capability');
const nestAdapter = nest.find((r) => r.name === nestRecipe);
const sharedKeys = (text) => [...snippetsOf(text).matchAll(/\b(?:key|capability|pageId): '([^']+)'/g)].map(([, key]) => key);

test('the plain guides that predate the recipe chain name expose-agent-actions as prerequisite and use no sdr key', () => {
  for (const page of [trees, filterNav]) {
    assert.match(section(page.text, 'Prerequisites'), /\]\(\.\.\/recipes\/expose-agent-actions\.md\)/, page.name);
    assert.doesNotMatch(page.text, /sdr/i, page.name);
  }
});

test('agent-action-trees uses the leads page and the shared action ids', () => {
  assert.deepEqual(sharedKeys(trees.text), ['leads']);
  assert.match(trees.text, /`leads\.export_leads`/);
  assert.match(trees.text, /dispatch\('leads\.open_lead_list'/);
  assert.doesNotMatch(trees.text, /sdr-leads/);
});

test('filter-navigation-by-capability snippets use only the shared page and capability keys', () => {
  const allowed = ['hello-app', 'home', 'leads', 'icp', 'lead:manage', 'icp:manage'];
  assert.deepEqual(sharedKeys(filterNav.text).filter((k) => !allowed.includes(k)), []);
  assert.doesNotMatch(filterNav.text, /hello:view/);
  for (const key of ['leads', 'icp', 'lead:manage', 'icp:manage']) assert.ok(snippetsOf(filterNav.text).includes(`'${key}'`), key);
});

test('the Nest pages gate with the shared lead:manage capability and name no hello:view', () => {
  for (const { name, text } of nest) assert.doesNotMatch(text, /hello:view/, name);
  assert.match(nestAdapter.text, /refuses a token that lacks the `lead:manage` \[capability\]/);
  assert.match(snippetsOf(nestAdapter.text), /@RequireCapability\('lead:manage'\)/);
  assert.match(snippetsOf(nestAdapter.text), /export const CAPABILITY = 'lead:manage';/);
  assert.deepEqual(sharedKeys(nestAdapter.text).filter((k) => !['hello-app', 'leads', 'lead:manage'].includes(k)), []);
});

test('the guides that predate the recipe chain each end with one related Next step that resolves', () => {
  for (const page of [trees, filterNav]) {
    const links = linksOf(section(page.text, 'Next step'));
    assert.equal(links.length, 1, page.name);
    assert.ok(existsSync(join(docs, 'guides', links[0].split('#')[0])), links[0]);
  }
});
