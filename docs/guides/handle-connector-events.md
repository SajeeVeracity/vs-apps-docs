---
title: Handle connector events
---

Receive an inbound event from a connector in your server, and answer it through the same connector.

<!-- flavour nest -->
The guide uses `ConnectorEventsService` and the `ConnectorExecuteResult` type from the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk).

A [connector slot](../glossary.md#connector-slot) can declare event handlers. When a [space manager](../glossary.md#space-manager) routes an event type of the attached connector to a handler, [Space](../glossary.md#space) sends each event to your server. `ConnectorEventsService` holds the function that runs for each handler. `ConnectorExecuteResult` is what a call back to the connector returns.

## Goal

End with a handler for the inbound events of one connector slot. The handler replies through the connector, checks the `ConnectorExecuteResult`, and lets Space send the event again when the reply fails.

## Prerequisites

- The Nest.js app from Part 1 of the [quickstart](../quickstart.md), running with `npm run dev:space`. Part 2, step 1 of the quickstart sets up the `.env` file that command reads.
- Background: the [server primitives](../reference/root.md) and the [connector slot fields](../app-definition.md#resourcesconnectors) of the app definition. The framework-free `/server` subpath serves the events route and holds the handler registry, `platform.connectorEvents`, but this guide has no Node.js version yet.

## Steps

### 1. Declare the slot and its handler

Space routes events only to a handler that the manifest declares. Put the slot in its own file, so that `shared/src/index.ts` changes by two lines.

```ts title="shared/src/support-slot.ts"
import type { AppConnectorRequirement } from '@vectoragents/vs-apps';

export const supportSlot: AppConnectorRequirement = {
  key: 'support',
  provider: 'REST',
  label: 'Support inbox',
  required: false,
  eventHandlers: [
    {
      key: 'inbound-message',
      label: 'Inbound message',
      defaultEventTypes: ['message-received'],
    },
  ],
};
```

In `shared/src/index.ts`, import `supportSlot` from `./support-slot`. Add `resources: { connectors: [supportSlot] }` to the object that `defineApp` takes.

A handler makes `eventsUrl` required in the manifest. `buildManifests` builds it as `<PUBLIC_BASE_URL>/api/events/hello-app`, so set `PUBLIC_BASE_URL` in `.env` to an address that Space can reach.

### 2. Reply through the connector

A handler gets the event and no user token. To call the connector back, ask `SpaceS2sService` for a service-to-service token, then call `connectorExecute`. The call runs with the permissions of the app alone, not those of a member.

`connectorExecute` returns a `ConnectorExecuteResult`: `status` (a number), `data`, and on failure `errorCode` and `retryAfterSeconds`. A failed call comes back as a result with `status` 400 or higher. It does not throw, so the caller must read `status`.

```ts title="server/src/support-reply.service.ts"
import { Injectable } from '@nestjs/common';
import { SpaceActionsService, SpaceS2sService } from '@vectoragents/vs-apps/nest';
import type { ConnectorEventDelivery, ConnectorExecuteResult } from '@vectoragents/vs-apps';

@Injectable()
export class SupportReplyService {
  constructor(
    private readonly space: SpaceActionsService,
    private readonly s2s: SpaceS2sService,
  ) {}

  async reply(appId: string, event: ConnectorEventDelivery, text: string): Promise<ConnectorExecuteResult> {
    const token = await this.s2s.getToken(appId, event.spaceId);
    return this.space.connectorExecute(token, {
      spaceId: event.spaceId,
      connectorId: event.connectorId,
      operationId: 'send_message',
      args: { text },
    });
  }
}
```

`operationId` names an operation of the attached connector. `send_message` is an example: use an identifier that your connector defines.

### 3. Register the handler

`ConnectorEventsService.on` takes a target and a handler function. The target is the `appKey`, the slot key and the handler key from step 1. It throws if you register the same target twice. Register in `onModuleInit`, so that every handler exists before the server takes requests.

The function gets the event and a context with the verified `claims` of the events token and the `traceparent` header. It returns nothing. The SDK answers `{ handled: true }` when the function returns, and answers `500` when it throws.

Space delivers each event at least once, up to three times. Skip an event identifier that you already handled.

```ts title="server/src/support-events.service.ts"
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConnectorEventsService } from '@vectoragents/vs-apps/nest';
import type { ConnectorEventDelivery, EventsTokenClaims } from '@vectoragents/vs-apps';
import { SupportReplyService } from './support-reply.service';

@Injectable()
export class SupportEventsService implements OnModuleInit {
  private readonly handled = new Set<number>();

  constructor(
    private readonly events: ConnectorEventsService,
    private readonly replies: SupportReplyService,
  ) {}

  onModuleInit() {
    this.events.on({ appKey: 'hello-app', slot: 'support', handler: 'inbound-message' }, (event, { claims }) =>
      this.inboundMessage(event, claims),
    );
  }

  private async inboundMessage(event: ConnectorEventDelivery, claims: EventsTokenClaims): Promise<void> {
    if (this.handled.has(event.eventId)) return;
    const result = await this.replies.reply(claims.appId, event, 'Message received.');
    if (result.status >= 400) {
      throw new Error(`Reply failed with status ${result.status} (${result.errorCode ?? 'no error code'})`);
    }
    this.handled.add(event.eventId);
  }
}
```

The throw makes the SDK answer `500`, and Space sends the event again. The set keeps its identifiers in memory, so a restart forgets them. Keep the identifiers in your own storage if a second reply is a problem.

A delivery for a handler that no one registered gets `{ handled: false }` and is not sent again. `event.payload` is the body of the provider, unchanged.

### 4. Register the module

The platform module is global, so the module needs no import for `ConnectorEventsService`, `SpaceActionsService` or `SpaceS2sService`.

```ts title="server/src/support-events.module.ts"
import { Module } from '@nestjs/common';
import { SupportEventsService } from './support-events.service';
import { SupportReplyService } from './support-reply.service';

@Module({
  providers: [SupportReplyService, SupportEventsService],
})
export class SupportEventsModule {}
```

Import `SupportEventsModule` in `server/src/app.module.ts`: add it to the `imports` array, after `AppPlatformModule.forRoot(...)`.

### 5. Check the events route

Restart `npm run dev:space`. In a second terminal, post an event with no token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"eventId":1,"slot":"support","handler":"inbound-message","provider":"REST","connectorId":1,"connectorName":"Support inbox","eventType":"message-received","spaceId":1,"occurredAt":"2026-01-01T00:00:00Z","payload":{}}' http://localhost:<SERVER_PORT>/api/events/hello-app
```

**Check**: the command prints `401`, because the route accepts only an events token that Space signs. A body that fails the event schema prints `400` first.

## Result

The server mounts `POST /api/events/hello-app`, verifies the events token of each delivery and runs `inbound-message` for the events that Space routes to it. The handler replies through the connector and reads the `ConnectorExecuteResult`. A failed reply makes Space send the event again. A space manager attaches a connector to the `support` slot and routes its event types after the app is registered in Space.

## Next step

Register the app in Space with Part 2 of the [quickstart](../quickstart.md), so that a space manager can attach a connector to the `support` slot and route its events.
<!-- /flavour -->
<!-- flavour node todo -->
<!-- /flavour -->
