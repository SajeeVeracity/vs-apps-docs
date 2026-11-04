---
title: Call a model from your server
---

Ask [Space](../glossary.md#space) for a model from a NestJS server and call it. The guide uses `SpaceAiService` from the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk) and one [model slot](../glossary.md#model-slot), a named model request that your app declares and a [space manager](../glossary.md#space-manager) fills with one model.

Your server never holds a model key. `SpaceAiService` trades the [service secret](../glossary.md#service-secret) for a short-lived key and returns it as the `apiKey` of a client configuration. The configuration also holds the `baseUrl` of Space's model gateway and the `model` name to send.

## Goal

End with `GET /api/summary` on the server from [`nest-adapter`](./nest-adapter.md). The route asks Space for the model set on the `lead-summary` slot, calls it once and returns the reply.

## Prerequisites

- The NestJS server from [`nest-adapter`](./nest-adapter.md), installed and running with `npm run dev:space`, and the app added to a Space as in [Part 2 of the quickstart](../quickstart.md#part-2-add-the-app-to-a-space).
- A space manager who can reach at least one Anthropic model in that Space.
- Background: the [`/server` reference](../reference/server.md), and the [same guide without the framework adapter](../guides/call-a-model-from-your-server.md).

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

### 2. Call the model

`getClientConfig(appId, spaceId, slot)` returns `{ provider, baseUrl, apiKey, model, expiresAt }`. `expiresAt` is a time in seconds since 1970. Do not store the configuration: call `getClientConfig` on each request. The service reuses a ticket until one minute before it expires.

The key works for this slot only. `model` is the slot's alias, not the model name that the space manager picked. Send it as it is.

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

The controller reads the caller with `appCaller`, as in [open a route and read the caller](../guides/open-route-and-read-caller.md). The `appId` and `spaceId` claims name the app and the Space that the token came from.

If no one sets the slot, Space refuses the call with status `409`. Space refuses a slot key that the manifest does not declare with status `400`. `SpaceAiService` throws a `SpaceActionError` that carries the status, so the controller turns it into an `HttpException` with the same status.

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

### 3. Register the route

Put the controller in a module. `AppPlatformModule` is global, so the module needs no import to inject `SpaceAiService`.

```ts title="server/src/lead-summary.module.ts"
import { Module } from '@nestjs/common';
import { LeadSummaryController } from './lead-summary.controller';

@Module({
  controllers: [LeadSummaryController],
})
export class LeadSummaryModule {}
```

Import `LeadSummaryModule` in `server/src/app.module.ts`: add it to the `imports` array, after `AppPlatformModule.forRoot(...)`.

### 4. Set the model and check the route

**Role**: space manager. Restart `npm run dev:space`, so that the module pings Space with the new manifest. In Space, open the configuration of the app and choose a model for **Lead summary**.

The model call needs the app secret that Space pushed when it added the app. The `AppCredentialStore` from `nest-adapter` keeps it in memory, so a restart loses it. Until Space pushes it again, `getClientConfig` fails with status `401`.

In a second terminal, request the route without a token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/summary
```

**Check**: the command prints `401`, because the guard refuses a request with no user token. Call the route from a page of the app with the user token, as `fetchHello` does in the quickstart. With a model set, it answers `200` and `{ "summary": "..." }`. With no model set, it answers `409`.

## Result

`GET /api/summary` verifies the caller, asks Space for the model that a space manager set on the `lead-summary` slot, and returns that model's reply. Your server holds no model key.

## Next step

Change which models a space manager can pick for the slot with the [`resources.models[]` fields](../app-definition.md#resourcesmodels).
