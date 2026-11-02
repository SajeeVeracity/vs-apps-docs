---
title: Expose your app as an A2A agent
---

Let another agent find your app and call it. The guide uses the [A2A](../glossary.md#a2a) protocol (Agent2Agent), where an agent publishes an agent card and answers JSON-RPC calls. An agent card is a JSON file that names the agent, lists its skills and says where to send calls.

You declare the agent in the [app definition](../glossary.md#app-definition). [Space](../glossary.md#space) reads the declaration from the [manifest](../glossary.md#manifest), fetches the card and sends calls to the address in it. The helpers come from the `@vectoragents/vs-apps/server` subpath of the [SDK](../glossary.md#sdk).

## Goal

End with two routes on the server from [`expose-agent-actions`](../recipes/expose-agent-actions.md). `GET /api/a2a/<spaceId>/.well-known/agent-card.json` serves the card. `POST /api/a2a/<spaceId>` answers calls from Space and streams a reply.

## Prerequisites

- The `recipes/leads-app/` server from [`expose-agent-actions`](../recipes/expose-agent-actions.md), installed and running with `npm run dev:space`.
- Background: the [server primitives](../reference/root.md), the [quickstart](../quickstart.md) that registers the app in Space, and the [`/server` reference](../reference/server.md).

## Steps

### 1. Declare the agent

An entry in `agents` tells Space where to find the card. `cardUrlTemplate` is an absolute URL with two tokens. `buildManifests` replaces `{publicBaseUrl}` with the `PUBLIC_BASE_URL` of your server. Space replaces `{spaceId}` with the id of each space.

`key` is a lowercase name with hyphens that stays the same across versions. Replace `shared/src/index.ts` with this file.

```ts title="shared/src/index.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const CAPABILITY = 'hello:view';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  pages: [
    {
      key: 'home',
      label: 'Home',
      path: '/',
      capability: CAPABILITY,
    },
    {
      key: 'leads',
      label: 'Leads',
      path: '/leads',
    },
  ],
  capabilities: [
    { key: CAPABILITY, label: 'View hello', effect: 'read' },
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICP', effect: 'write' },
  ],
  agents: [
    {
      key: 'leads-agent',
      protocol: 'a2a',
      cardUrlTemplate: '{publicBaseUrl}/api/a2a/{spaceId}',
    },
  ],
});
```

### 2. Build the card

`buildAppAgentCard` returns the card as an object. The card is the only place that holds the name, the description and the skills of the agent. The definition holds none of them.

`rpcUrl` is where Space sends calls, so it must match the route in step 3. The card also declares that callers send a bearer token, which Space signs.

```ts title="server/src/a2a-card.ts"
import { buildAppAgentCard } from '@vectoragents/vs-apps/server';

const baseUrl = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

export function agentCard(spaceId: number) {
  return buildAppAgentCard({
    name: 'Leads agent',
    description: 'Answers questions about the leads in a space.',
    rpcUrl: `${baseUrl}/api/a2a/${spaceId}`,
    skills: [
      {
        id: 'answer-lead-question',
        name: 'Answer a lead question',
        description: 'Replies to a question about leads and Lead Lists.',
        tags: ['leads'],
      },
    ],
  });
}
```

### 3. Answer the calls

`createA2aRequestHandler` takes one function, `generate`. It receives the text of the incoming message and yields the reply as an async sequence. A string is a piece of reply text, and the pieces together make the full reply. `{ kind: 'data', data }` adds a JSON result.

The handler answers `message/send` with one JSON body. It answers `message/stream` with a function that writes the events, so your route sets the stream headers. Any other method gets a "Method not found" error.

`assertSpaceS2s` checks the bearer token against Space's public keys. It pins the token to one space and one app, so a token for another space or app gets `403`. A call with no token gets `401`. The second argument of the handler, `ctx`, carries the space id into `generate`.

```ts title="server/src/a2a.ts"
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  assertSpaceS2s,
  createA2aRequestHandler,
  createSpaceTokenVerifier,
  extractBearer,
  readJsonBody,
  type A2aGenerateInput,
} from '@vectoragents/vs-apps/server';
import { agentCard } from './a2a-card';

const verifier = createSpaceTokenVerifier({ jwksUrl: process.env.SPACE_JWKS_URL ?? '' });

type Context = { spaceId: number };

async function* generate({ text }: A2aGenerateInput, ctx: Context) {
  yield `Leads agent of space ${ctx.spaceId}. `;
  yield `You asked: ${text}`;
}

const handleCall = createA2aRequestHandler<Context>({ generate });

const route = /^\/api\/a2a\/(\d+)(\/\.well-known\/agent-card\.json)?$/;

export async function handleA2aRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const match = route.exec(pathname);
  if (!match) return false;
  const spaceId = Number(match[1]);

  if (match[2]) {
    if (req.method !== 'GET') return false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agentCard(spaceId)));
    return true;
  }
  if (req.method !== 'POST') return false;

  await assertSpaceS2s(verifier, { token: extractBearer(req.headers), kind: 'a2a', spaceId, appKey: 'hello-app' });
  const result = await handleCall(await readJsonBody(req), { spaceId });
  if (result.kind === 'json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return true;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  await result.run({
    write: (chunk) => res.write(chunk),
    end: () => res.end(),
    closed: () => res.destroyed,
  });
  return true;
}
```

The card route needs no token, because the card holds no secret. The call route refuses a request before it reads the body.

### 4. Register the route

In `server/src/main.ts`, import `handleA2aRoute` from `./a2a`. Add the line below next to the call to `handleDevRoute`, inside the `try`. A token failure then reaches the existing `catch`, which answers with the status of the `AppAuthError`.

```text
if (await handleA2aRoute(req, res)) return;
```

### 5. Check the routes

Restart `npm run dev:space`. In a second terminal, fetch the card for space `1` and call the route with no token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s http://localhost:<SERVER_PORT>/api/a2a/1/.well-known/agent-card.json
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:<SERVER_PORT>/api/a2a/1
```

**Check**: the first command prints a card whose `url` ends in `/api/a2a/1`. The second prints `401`, because the route verifies a token from Space before it reads the call.

A manifest change waits as a pending review, as in [add a page and a capability](../recipes/add-page-and-capability.md#3-let-space-pull-the-manifest). Ask Vector to apply it, so Space reads the new `agents` entry.

## Result

Space finds `hello-app` as an agent through the manifest and fetches its card for each space. A call that carries a valid token from Space gets the reply of `generate`, as one JSON body for `message/send` and as events for `message/stream`. Any other call gets `401` or `403`.

## Next step

Let `generate` answer with a model, as in [call a model from your server](./call-a-model-from-your-server.md).
