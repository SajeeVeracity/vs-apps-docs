---
title: Call a model from your server
start: leads-app
---

Ask [Space](../glossary.md#space) for a model from your server and call it.

<!-- flavour node -->
The guide uses `createSpaceAiConfigProvider` from the `@vectoragents/vs-apps/server` subpath of the [SDK](../glossary.md#sdk) on a `node:http` server.
<!-- /flavour -->
<!-- flavour nest -->
The guide uses `SpaceAiService` from the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk) on a Nest.js server.
<!-- /flavour -->

The model comes from one [model slot](../glossary.md#model-slot), a named model request that your app declares and a [space manager](../glossary.md#space-manager) fills with one model.

Your server never holds a model key. The SDK trades the [service secret](../glossary.md#service-secret) for a short-lived key and returns it as the `apiKey` of a client configuration. The configuration also holds the `baseUrl` of Space's model gateway and the `model` name to send.

## Goal

End with `GET /api/summary` on the server from [expose agent actions](../recipes/expose-agent-actions.md). The route asks Space for the model set on the `lead-summary` slot, calls it once and returns the reply.

## Prerequisites

- The app from [expose agent actions](../recipes/expose-agent-actions.md), running with `npm run dev:space`. It starts from the `leads-app` start of the starter. Set up registry access as in step 0 of the [quickstart](../quickstart.md), then scaffold the start:

<!-- flavour node -->
```bash
npm create @vectoragents/app leads-app -- --client react --server node --start leads-app
```
<!-- /flavour -->
<!-- flavour nest -->
```bash
npm create @vectoragents/app leads-app -- --client react --server nest --start leads-app
```
<!-- /flavour -->

- The app is added to a Space as in Part 2 of the [quickstart](../quickstart.md).
- A space manager who can reach at least one Anthropic model in that Space.
- Background: the [`/server` reference](../reference/server.md).

## Steps

### 1. Declare the model slot

The slot is a plain object that satisfies `AppModelSlot`. `providers` fixes the wire that your code speaks, so every model that fills the slot answers in the Anthropic format. `required` makes Space show the slot as needing setup until a space manager sets a model.

```ts title="shared/src/lead-summary-slot.ts"
import type { AppModelSlot } from '@vectoragents/vs-apps';

export const leadSummarySlot = {
  key: 'lead-summary',
  label: 'Lead summary',
  description: 'Writes a one-sentence summary of a lead.',
  modality: 'chat',
  providers: ['ANTHROPIC'],
  required: true,
} satisfies AppModelSlot;
```

Add the slot to the definition in `shared/src/index.ts`. Import `leadSummarySlot` from `./lead-summary-slot`, and add `resources: { models: [leadSummarySlot] }` to the object that `defineApp` takes. The slot key is lower kebab-case, as in the [definition fields](../app-definition.md#resourcesmodels).

### 2. Keep the service secret

<!-- flavour node -->
The provider needs the secret that Space pushed when it added the app. Space sends it in the body of `POST /api/provision`. The `/api/provision` entry in `main.ts` checks the token and drops the body.

The file below keeps the secret for each Space in memory. The map loses the secrets on restart, so replace it with your own storage before production. Until Space pushes the secret again, the provider fails with status `401`.

```ts title="server/src/service-secrets.ts"
import type { IncomingMessage } from 'node:http';
import type { ProvisioningClaims } from '@vectoragents/vs-apps';
import { AppAuthError, readJsonBody } from '@vectoragents/vs-apps/server';

const secrets = new Map<number, string>();

function spaceOf(claims: ProvisioningClaims): number {
  if (claims.spaceId === undefined) throw new AppAuthError(403, 'The provisioning token has no spaceId claim');
  return claims.spaceId;
}

export async function saveServiceSecret(claims: ProvisioningClaims, req: IncomingMessage): Promise<void> {
  const body = await readJsonBody(req);
  if (typeof body?.serviceSecret !== 'string') throw new Error('The provision body has no serviceSecret');
  secrets.set(spaceOf(claims), body.serviceSecret);
}

export function removeServiceSecret(claims: ProvisioningClaims): void {
  secrets.delete(spaceOf(claims));
}

export async function getServiceSecret(spaceId: number): Promise<string | null> {
  return secrets.get(spaceId) ?? null;
}
```
<!-- /flavour -->
<!-- flavour nest -->
Space pushes the service secret to `POST /api/provision` when it adds the app. `AppPlatformModule` stores it in the credential store of `AppModule`, `MemoryCredentialStore` in `server/src/credential-store.ts`, so you write no code in this step.

The store keeps the secrets in memory and loses them on restart. `AppCredentialStore` is the one interface you implement over your own storage, so plan a persistent store before production. Until Space pushes the secret again, `getClientConfig` fails with status `401`.
<!-- /flavour -->

### 3. Call the model

<!-- flavour node -->
`createSpaceAiConfigProvider` takes the Space origin, the app identifier and `getServiceSecret`. The function it returns takes `(spaceId, slot)` and resolves to `{ provider, baseUrl, apiKey, model, expiresAt }`. `expiresAt` is a time in seconds since 1970. The provider reuses a ticket until one minute before it expires, so keep one provider for each app identifier and do not store the configuration.

The key works for this slot only. `model` is the slot's alias, not the model name that the space manager picked. Send it as it is.
<!-- /flavour -->
<!-- flavour nest -->
`getClientConfig(appId, spaceId, slot)` returns `{ provider, baseUrl, apiKey, model, expiresAt }`. `expiresAt` is a time in seconds since 1970. Do not store the configuration: call `getClientConfig` on each request. The service reuses a ticket until one minute before it expires.

The key works for this slot only. `model` is the slot's alias, not the model name that the space manager picked. Send it as it is.
<!-- /flavour -->

If no one sets the slot, Space refuses the call with status `409`. Space refuses a slot key that the manifest does not declare with status `400`.

<!-- flavour node -->
The provider throws a `SpaceActionError` that carries the status.

```ts title="server/src/lead-summary.ts"
import type { UserTokenClaims } from '@vectoragents/vs-apps';
import { createSpaceAiConfigProvider, type AiClientConfig } from '@vectoragents/vs-apps/server';
import { getServiceSecret } from './service-secrets';

// The origin has no `/api` suffix.
const spaceBaseUrl = (process.env.SPACE_API_URL ?? '').replace(/\/api\/?$/, '');

const providers = new Map<string, ReturnType<typeof createSpaceAiConfigProvider>>();

function providerFor(appId: string) {
  let provider = providers.get(appId);
  if (!provider) {
    provider = createSpaceAiConfigProvider({
      spaceBaseUrl,
      appId,
      getServiceSecret,
    });
    providers.set(appId, provider);
  }
  return provider;
}

async function completePrompt(config: AiClientConfig, prompt: string): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`The model call failed with status ${response.status}`);
  const reply = (await response.json()) as { content: Array<{ text?: string }> };
  return reply.content.map((block) => block.text ?? '').join('');
}

export async function summarizeLead(claims: UserTokenClaims) {
  const config = await providerFor(claims.appId)(claims.spaceId, 'lead-summary');
  const summary = await completePrompt(config, 'Write one sentence about a lead named Ada Lovelace, who asked for a demo.');
  return { summary };
}
```

The string `'lead-summary'` must equal the `key` from step 1.
<!-- /flavour -->
<!-- flavour nest -->
The helper below sends one message in the Anthropic format. It reads every value from the configuration.

```ts title="server/src/complete-prompt.ts"
import type { AiClientConfig } from '@vectoragents/vs-apps/server';

export async function completePrompt(config: AiClientConfig, prompt: string): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`The model call failed with status ${response.status}`);
  const reply = (await response.json()) as { content: Array<{ text?: string }> };
  return reply.content.map((block) => block.text ?? '').join('');
}
```

The controller reads the caller with `appCaller`, as in [open a route and read the caller](./open-route-and-read-caller.md). The `appId` and `spaceId` claims name the app and the Space that the token came from.

`SpaceAiService` throws a `SpaceActionError` that carries the status, so the controller turns it into an `HttpException` with the same status.

```ts title="server/src/lead-summary.controller.ts"
import { Controller, Get, HttpException, Req } from '@nestjs/common';
import { appCaller, RequireCapability, SpaceAiService, type AppRequest } from '@vectoragents/vs-apps/nest';
import { SpaceActionError } from '@vectoragents/vs-apps/server';
import { completePrompt } from './complete-prompt';

@Controller('summary')
export class LeadSummaryController {
  constructor(private readonly ai: SpaceAiService) {}

  @Get()
  @RequireCapability('lead:manage')
  async summary(@Req() req: AppRequest) {
    const { claims } = appCaller(req);
    try {
      const config = await this.ai.getClientConfig(claims.appId, claims.spaceId, 'lead-summary');
      const summary = await completePrompt(config, 'Write one sentence about a lead named Ada Lovelace, who asked for a demo.');
      return { summary };
    } catch (error) {
      if (error instanceof SpaceActionError) throw new HttpException(error.message, error.status);
      throw error;
    }
  }
}
```

The string `'lead-summary'` must equal the `key` from step 1.
<!-- /flavour -->

### 4. Mount the route

<!-- flavour node -->
The provider reads `SPACE_API_URL` from `.env`, which Part 2 of the quickstart sets. The code in step 3 removes the `/api` suffix, because the provider needs the origin of Space.

In `server/src/main.ts`, make four changes.

1. Import `removeServiceSecret` and `saveServiceSecret` from `./service-secrets`, and `summarizeLead` from `./lead-summary`. Import `SpaceActionError` from `@vectoragents/vs-apps/server`, next to `AppAuthError`.
2. In the `/api/provision` entry, replace `await requireProvisioning(req);` with `await saveServiceSecret(await requireProvisioning(req), req);`.
3. In the `/api/deprovision` entry, replace `await requireProvisioning(req);` with `removeServiceSecret(await requireProvisioning(req));`. Add this entry to the `routes` map: `'/api/summary': async (req) => summarizeLead(await requireCapability(req, 'lead:manage')),`.
4. In the `catch` block, add `if (error instanceof SpaceActionError) return send(res, error.status, { error: error.message });` after the `AppAuthError` line.
<!-- /flavour -->
<!-- flavour nest -->
In `server/src/app.module.ts`, import `LeadSummaryController` from `./lead-summary.controller`. Add it to the `controllers` array, next to `HelloController`. `AppPlatformModule` is global, so `AppModule` needs no import to inject `SpaceAiService`.

```text
controllers: [HelloController, LeadSummaryController],
```
<!-- /flavour -->

### 5. Set the model and check the route

**Role**: space manager. Restart `npm run dev:space`.

<!-- flavour node -->
A change to the manifest reaches Space through [`pingSpaceManifests`](../reference/server.md#pingspacemanifests) or a manual refresh in Space. Then open the configuration of the app and choose a model for **Lead summary**. Remove the app from the Space and add it again, so that Space pushes the secret to the route from step 2.
<!-- /flavour -->
<!-- flavour nest -->
The module pings Space with the new manifest at start. In Space, open the configuration of the app and choose a model for **Lead summary**. Remove the app from the Space and add it again, so that Space pushes the secret to the credential store.
<!-- /flavour -->

In a second terminal, request the route without a token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/summary
```

**Check**: the command prints `401`, because the route refuses a request with no user token. Call the route from a page of the app with the user token, as `fetchHello` does in the quickstart. With a model set, it answers `200` and `{ "summary": "..." }`. With no model set, it answers `409`.

## Result

`GET /api/summary` verifies the caller, asks Space for the model that a space manager set on the `lead-summary` slot, and returns that model's reply. Your server holds no model key.

## Next step

Change which models a space manager can pick for the slot with the [`resources.models[]` fields](../app-definition.md#resourcesmodels).
