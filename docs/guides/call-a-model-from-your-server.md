---
title: Call a model from your server
---

Ask [Space](../glossary.md#space) for a model from a `node:http` server and call it. The guide uses `createSpaceAiConfigProvider` from the `@vectoragents/vs-apps/server` subpath of the [SDK](../glossary.md#sdk) and one [model slot](../glossary.md#model-slot), a named model request that your app declares and a [space manager](../glossary.md#space-manager) fills with one model.

Your server never holds a model key. The provider trades the app's secret for a short-lived ticket and returns it as the `apiKey` of a client config. The config also holds the `baseUrl` of Space's model gateway and the `model` name to send.

## Goal

End with `GET /api/summary` on the server from [expose agent actions](../recipes/expose-agent-actions.md). The route asks Space for the model set on the `lead-summary` slot, calls it once and returns the reply.

## Prerequisites

- The `recipes/leads-app/` folder with the result of [expose agent actions](../recipes/expose-agent-actions.md), running with `npm run dev:space`. The app is added to a Space as in [Part 2 of the quickstart](../quickstart.md#part-2-add-the-app-to-a-space).
- A space manager who can reach at least one Anthropic model in that Space.
- Background: the [`/server` reference](../reference/server.md), and the [same guide for the framework adapter](../nest/call-a-model-from-your-server.md).

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

The provider needs the secret that Space pushed when it added the app. Space sends it in the body of `POST /api/provision`. The starter route checks the token and drops the body. The file below keeps the secret for each Space in memory. The map loses the secrets on restart, so replace it with your own storage before production. Until Space pushes the secret again, the provider fails with status `401`.

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

### 3. Call the model

`createSpaceAiConfigProvider` takes the Space origin, the app id and `getServiceSecret`. The function it returns takes `(spaceId, slot)` and resolves to `{ provider, baseUrl, apiKey, model, expiresAt }`. `expiresAt` is a time in seconds since 1970. The provider reuses a ticket until one minute before it expires, so keep one provider for each app id and do not store the config.

The ticket works for this slot only. `model` is the slot's alias, not the model name that the space manager picked. Send it as it is.

If no one sets the slot, Space refuses the call with status `409`. Space refuses a slot key that the manifest does not declare with status `400`. The provider throws a `SpaceActionError` that carries the status.

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

### 4. Mount the routes

The provider reads `SPACE_API_URL` from `.env`, which the starter sets in Part 2 of the quickstart. The code in step 3 removes the `/api` suffix, because the provider needs the origin of Space.

In `server/src/main.ts`, make four changes.

1. Import `removeServiceSecret` and `saveServiceSecret` from `./service-secrets`, and `summarizeLead` from `./lead-summary`. Import `SpaceActionError` from `@vectoragents/vs-apps/server`, next to `AppAuthError`.
2. In the `/api/provision` entry, replace `await requireProvisioning(req);` with `await saveServiceSecret(await requireProvisioning(req), req);`.
3. In the `/api/deprovision` entry, replace `await requireProvisioning(req);` with `removeServiceSecret(await requireProvisioning(req));`. Add this entry to the `routes` map: `'/api/summary': async (req) => summarizeLead(await requireCapability(req, 'lead:manage')),`.
4. In the `catch` block, add `if (error instanceof SpaceActionError) return send(res, error.status, { error: error.message });` after the `AppAuthError` line.

### 5. Set the model and check the route

**Role**: space manager. Restart `npm run dev:space`. A change to the manifest reaches Space through [`pingSpaceManifests`](../reference/server.md#pingspacemanifests) or a manual refresh in Space. Then open the configuration of the app and choose a model for **Lead summary**. Remove the app from the Space and add it again, so that Space pushes the secret to the route from step 2.

In a second terminal, request the route without a token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/summary
```

**Check**: the command prints `401`, because `requireCapability` refuses a request with no user token. Call the route from a page of the app with the user token, as `fetchHello` does in the quickstart. With a model set, it answers `200` and `{ "summary": "..." }`. With no model set, it answers `409`.

## Result

`GET /api/summary` verifies the caller, asks Space for the model that a space manager set on the `lead-summary` slot, and returns that model's reply. Your server holds no model key.

## Next step

Change which models a space manager can pick for the slot with the [`resources.models[]` fields](../app-definition.md#resourcesmodels).
