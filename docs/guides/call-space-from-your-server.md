---
title: Call Space from your server
start: leads-app
---

Make your server call [Space](../glossary.md#space) in two ways: as the signed-in user, and as the app itself.

<!-- flavour node -->
Both use the `@vectoragents/vs-apps/server` subpath of the [SDK](../glossary.md#sdk) on a plain `node:http` server.
<!-- /flavour -->
<!-- flavour nest -->
Both use the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk) on a Nest.js server.
<!-- /flavour -->

A call as the user carries the user's token, so Space limits it to what that user may do. A call as the app carries a short-lived token that Space issues in exchange for a [service secret](../glossary.md#service-secret). Space limits it to what the app may do, with no user present.

## Goal

End with two routes on the server from [`expose-agent-actions`](../recipes/expose-agent-actions.md). `POST /api/space/agent` starts a conversation with the Space agent as the caller. `GET /api/space/connectors` lists the connectors of the caller's space as the app.

## Prerequisites

- The app from [`expose-agent-actions`](../recipes/expose-agent-actions.md), running with `npm run dev:space`. Work in its folder. If you do not have it, set up registry access as in step 0 of the [quickstart](../quickstart.md), then scaffold the `leads-app` start of the starter into a new folder. The folder name `leads-guide` differs from `leads-app`, the folder of the recipe, so the two do not clash:

<!-- flavour node -->
```bash
npm create @vectoragents/app leads-guide -- --client react --server node --start leads-app
cd leads-guide
```
<!-- /flavour -->
<!-- flavour nest -->
```bash
npm create @vectoragents/app leads-guide -- --client react --server nest --start leads-app
cd leads-guide
```
<!-- /flavour -->

- Background: the [server primitives](../reference/root.md), and the [quickstart](../quickstart.md) that registers the app in Space.

## Steps

### 1. Point the server at Space

The server calls Space at its origin. The `SPACE_API_URL` value is that origin plus `/api`, the same shape as `SPACE_JWKS_URL`. Skip this step if `.env` already has it.

```bash
echo 'SPACE_API_URL=YOUR_SPACE_API_URL' >> .env
```

<!-- flavour node -->
### 2. Know the platform clients

The app platform of the starter, `platform` in `server/src/platform.ts`, holds the clients that call Space. Space creates a [service secret](../glossary.md#service-secret) for each pair of app and space and pushes it to `POST /api/provision`, as in step 4 of the [quickstart](../quickstart.md). The platform serves that route and keeps the secret in its credential store.

- `platform.spaceActions` has one method for each Space action. Each method takes a bearer token as its first argument.
- `platform.s2s(appId, spaceId)` exchanges the service secret for a short-lived [app token](../glossary.md#app-token). It asks the store for the secret on every exchange and caches only the token.

The store of the starter keeps the secrets in memory and loses them on restart. `AppCredentialStore` is the one interface you implement over your own storage, so plan a persistent store before production. After a restart, `platform.s2s` fails until the binding secret is rotated in Space, which pushes it again.

### 3. Add the handlers

The agent handler passes the caller's own token to `agentInvoke`. The connectors handler passes an app token to `connectorsList`. No user limits that call, so the route must check the capability first.

Each handler takes the platform, and the verified claims that `requireCapability` returns, as in step 3 of [gate a page and an endpoint](../recipes/gate-by-capability.md).

```ts title="server/src/space-calls.ts"
import type { IncomingMessage } from 'node:http';
import type { UserTokenClaims } from '@vectoragents/vs-apps';
import { readBearer, readJsonBody, type AppPlatform } from '@vectoragents/vs-apps/server';

export async function startConversation(platform: AppPlatform, req: IncomingMessage, claims: UserTokenClaims) {
  // The route has verified the token, so the header holds it.
  const userToken = readBearer(req.headers) as string;
  const { message } = (await readJsonBody(req)) as { message: string };
  return platform.spaceActions.agentInvoke(userToken, { spaceId: claims.spaceId, message });
}

export async function listConnectors(platform: AppPlatform, claims: UserTokenClaims) {
  const token = await platform.s2s(claims.appId, claims.spaceId);
  return platform.spaceActions.connectorsList(token, { spaceId: claims.spaceId });
}
```

### 4. Register the routes

In `server/src/main.ts`, import the two handlers from `./space-calls`. Add the two lines below inside the `try`, after the `platform.fetch` check and before the check for `/api/hello`. Each line verifies first and then calls the handler.

```text
if (pathname === '/api/space/agent') return send(res, 200, await startConversation(platform, req, await requireCapability(req, 'lead:manage')));
if (pathname === '/api/space/connectors') return send(res, 200, await listConnectors(platform, await requireCapability(req, 'lead:manage')));
```

A failed call throws `SpaceActionError`, which has a `status` and an optional `code`. The `catch` block in `main.ts` answers `500` for it. Add `if (error instanceof SpaceActionError) return send(res, error.status, { error: error.message });` after the `AppAuthError` line to answer with the status that Space sent. Import `SpaceActionError` from `@vectoragents/vs-apps/server`, next to `AppAuthError`.
<!-- /flavour -->
<!-- flavour nest -->
### 2. Know the three services

`AppPlatformModule` provides all three services to every module, so you import nothing to inject them.

- `SpaceActionsService` has one method for each Space action. Each method takes a bearer token as its first argument.
- `AppActionsService` wraps `SpaceActionsService` for a caller. It reads the token and the `spaceId` from the request, so you pass only the request and the input.
- `SpaceS2sService` exchanges the service secret for a short-lived [app token](../glossary.md#app-token). Space creates the secret for each pair of app and space and pushes it to the credential store, `MemoryCredentialStore` in `server/src/credential-store.ts`.

The store keeps the secrets in memory and loses them on restart. `AppCredentialStore` is the one interface you implement over your own storage, so plan a persistent store before production. After a restart, `getToken` fails until the binding secret is rotated in Space, which pushes it again.

### 3. Add the routes

The agent route passes the request to `AppActionsService`, which sends the caller's own token. The connectors route sends an app token, which no user limits. Its `@RequireCapability` check therefore decides who may use the route.

`getToken` takes the `appId` and the `spaceId` that `appCaller` reads from the verified claims, as in [open a route and read the caller](./open-route-and-read-caller.md). A failed Space call reaches your caller as an HTTP error with the status that Space sent.

```ts title="server/src/space-calls.controller.ts"
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  AppActionsService,
  RequireCapability,
  SpaceActionsService,
  SpaceS2sService,
  appCaller,
  type AppRequest,
} from '@vectoragents/vs-apps/nest';

@Controller('space')
export class SpaceCallsController {
  constructor(
    private readonly actions: AppActionsService,
    private readonly space: SpaceActionsService,
    private readonly s2s: SpaceS2sService,
  ) {}

  @Post('agent')
  @RequireCapability('lead:manage')
  startConversation(@Req() req: AppRequest, @Body() body: { message: string }) {
    return this.actions.agentInvoke(req, { message: body.message });
  }

  @Get('connectors')
  @RequireCapability('lead:manage')
  async listConnectors(@Req() req: AppRequest) {
    const { claims } = appCaller(req);
    const token = await this.s2s.getToken(claims.appId, claims.spaceId);
    return this.space.connectorsList(token, { spaceId: claims.spaceId });
  }
}
```

### 4. Register the controller

In `server/src/app.module.ts`, import `SpaceCallsController` from `./space-calls.controller`. Add it to the `controllers` array, next to `HelloController`.

```text
controllers: [HelloController, SpaceCallsController],
```
<!-- /flavour -->

### 5. Check the routes

Restart `npm run dev:space`. In a second terminal, call both routes with no token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:<SERVER_PORT>/api/space/agent
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/space/connectors
```

**Check**: both commands print `401`, because each route refuses a request with no user token before it calls Space.

## Result

A signed-in caller of `/api/space/agent` starts a conversation with the Space agent and receives its `threadId`. A caller of `/api/space/connectors` receives the connector registry of their space, fetched with an app token. After Space provisions the app, the platform finds the service secret of each space.

## Next step

Let the Space agent call your app in return with [agent action trees](./agent-action-trees.md).
