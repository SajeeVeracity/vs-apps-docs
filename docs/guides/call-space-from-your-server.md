---
title: Call Space from your server
---

Make your server call [Space](../glossary.md#space) in two ways: as the signed-in user, and as the app itself. Both use the `@vectoragents/vs-apps/server` subpath of the [SDK](../glossary.md#sdk) on a plain `node:http` server.

A call as the user carries the user's token, so Space limits it to what that user may do. A call as the app carries a short-lived token that Space issues in exchange for a service secret. Space limits it to what the app may do, with no user present.

## Goal

End with two routes on the server from [`expose-agent-actions`](../recipes/expose-agent-actions.md). `POST /api/space/agent` starts a conversation with the Space agent as the caller. `GET /api/space/connectors` lists the connectors of the caller's space as the app.

## Prerequisites

- The `recipes/leads-app/` server from [`expose-agent-actions`](../recipes/expose-agent-actions.md), installed and running with `npm run dev:space`.
- Background: the [server primitives](../reference/root.md), the [quickstart](../quickstart.md) that registers the app in Space, and the [framework version](../nest/call-space-from-your-server.md) of this guide.

## Steps

### 1. Point the server at Space

The actions client needs the origin of Space. The `SPACE_API_URL` value is that origin plus `/api`, the same shape as `SPACE_JWKS_URL`. Skip this step if `.env` already has it.

```bash
echo 'SPACE_API_URL=YOUR_SPACE_API_URL' >> .env
```

### 2. Create the client and the token provider

`createSpaceActionsClient` returns one object with a method for each Space action. Each method takes a bearer token as its first argument.

`createSpaceS2sTokenProvider` exchanges the service secret for that token. Space creates the secret for each pair of app and space and pushes it to `POST /api/provision`, as in step 4 of the [quickstart](../quickstart.md#4-add-the-app-to-a-space). The provider asks for the secret on every exchange and caches only the token.

The store below keeps the secrets in memory and loses them on restart. Replace the `Map` with your own storage before production.

```ts title="server/src/space.ts"
import {
  createSpaceActionsClient,
  createSpaceS2sTokenProvider,
  type SpaceS2sTokenProvider,
} from '@vectoragents/vs-apps/server';

// The origin has no `/api` suffix.
const spaceBaseUrl = (process.env.SPACE_API_URL ?? '').replace(/\/api\/?$/, '');

const secrets = new Map<string, string>();
const providers = new Map<string, SpaceS2sTokenProvider>();

export const actions = createSpaceActionsClient({ spaceBaseUrl });

export function saveSecret(appId: string, spaceId: number, secret: string): void {
  secrets.set(`${appId}:${spaceId}`, secret);
}

export function removeSecret(appId: string, spaceId: number): void {
  secrets.delete(`${appId}:${spaceId}`);
}

export function appToken(appId: string, spaceId: number): Promise<string> {
  let provider = providers.get(appId);
  if (!provider) {
    provider = createSpaceS2sTokenProvider({
      spaceBaseUrl,
      appId,
      getServiceSecret: async (id) => secrets.get(`${appId}:${id}`) ?? null,
    });
    providers.set(appId, provider);
  }
  return provider(spaceId);
}
```

### 3. Add the handlers

The agent handler passes the caller's own token to `agentInvoke`. The connectors handler passes an app token to `connectorsList`. No user limits that call, so the route must check the capability first.

`provisionPushInputSchema` reads the body that Space sends to the provision route. The provision handlers keep and drop the secret that `appToken` reads later. Each handler receives the verified claims, as in [gate a page and an endpoint](../recipes/gate-by-capability.md#3-enforce-the-capability-on-the-server).

```ts title="server/src/space-calls.ts"
import type { IncomingMessage } from 'node:http';
import { provisionPushInputSchema, type ProvisioningClaims, type UserTokenClaims } from '@vectoragents/vs-apps';
import { AppAuthError, extractBearer, readJsonBody } from '@vectoragents/vs-apps/server';
import { actions, appToken, removeSecret, saveSecret } from './space';

function target({ appId, spaceId }: ProvisioningClaims) {
  if (!appId || spaceId === undefined) {
    throw new AppAuthError(403, 'Provisioning token must carry appId and spaceId claims');
  }
  return { appId, spaceId };
}

export async function provision(req: IncomingMessage, claims: ProvisioningClaims) {
  const { appId, spaceId } = target(claims);
  const { serviceSecret } = provisionPushInputSchema.parse(await readJsonBody(req));
  saveSecret(appId, spaceId, serviceSecret);
  return { ok: true };
}

export function deprovision(claims: ProvisioningClaims) {
  const { appId, spaceId } = target(claims);
  removeSecret(appId, spaceId);
  return { ok: true };
}

export async function startConversation(req: IncomingMessage, claims: UserTokenClaims) {
  // The route has verified the token, so the header holds it.
  const userJwt = extractBearer(req.headers) as string;
  const { message } = (await readJsonBody(req)) as { message: string };
  return actions.agentInvoke(userJwt, { spaceId: claims.spaceId, message });
}

export async function listConnectors(claims: UserTokenClaims) {
  const token = await appToken(claims.appId, claims.spaceId);
  return actions.connectorsList(token, { spaceId: claims.spaceId });
}
```

### 4. Register the routes

In `server/src/main.ts`, import the four handlers from `./space-calls`. Replace the `/api/provision` and `/api/deprovision` entries of the `routes` map, and add the two new entries. Each entry verifies first and then calls the handler.

```text
'/api/provision': async (req) => provision(req, await requireProvisioning(req)),
'/api/deprovision': async (req) => deprovision(await requireProvisioning(req)),
'/api/space/agent': async (req) => startConversation(req, await requireCapability(req, 'lead:manage')),
'/api/space/connectors': async (req) => listConnectors(await requireCapability(req, 'lead:manage')),
```

A failed call throws `SpaceActionError`, which has a `status` and an optional `code`. The starter's `catch` answers `500` for it. Read `error.status` there to answer with the status that Space sent.

### 5. Check the routes

Restart `npm run dev:space`. In a second terminal, call both routes with no token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:<SERVER_PORT>/api/space/agent
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/space/connectors
```

**Check**: both commands print `401`, because each route verifies a user token before it calls Space.

## Result

A signed-in caller of `/api/space/agent` starts a conversation with the Space agent and receives its `threadId`. A caller of `/api/space/connectors` receives the connector registry of their space, fetched with an app token. After Space provisions the app, `appToken` finds the service secret of each space.

## Next step

Let the Space agent call your app in return with [agent action trees](./agent-action-trees.md).
