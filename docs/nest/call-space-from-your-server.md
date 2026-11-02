---
title: Call Space from your server
---

Make a NestJS server call [Space](../glossary.md#space) in two ways: as the signed-in user, and as the app itself. Both use the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk).

A call as the user carries the user's token, so Space limits it to what that user may do. A call as the app carries a short-lived token that Space issues in exchange for a service secret. Space limits it to what the app may do, with no user present.

## Goal

End with two routes on the server from [`nest-adapter`](./nest-adapter.md). `POST /api/space/agent` starts a conversation with the Space agent as the caller. `GET /api/space/connectors` lists the connectors of the caller's space as the app.

## Prerequisites

- The NestJS server from [`nest-adapter`](./nest-adapter.md), installed and running with `npm run dev:space`.
- Background: the [server primitives](../reference/root.md) that the adapter wraps, the [quickstart](../quickstart.md) that registers the app in Space, and the [plain `node:http` version](../guides/call-space-from-your-server.md) of this guide.

## Steps

### 1. Know the three services

`AppPlatformModule` provides all three services to every module, so you import nothing to inject them.

- `SpaceClientService` has one method for each Space action. Each method takes a bearer token as its first argument.
- `AppActionsService` wraps `SpaceClientService` for a caller. It reads the token and the `spaceId` from the request, so you pass only the request and the input.
- `SpaceS2sService` exchanges the service secret for a short-lived app token. Space creates the secret for each pair of app and space and pushes it to the credential store from `nest-adapter`.

The store from `nest-adapter` keeps the secrets in memory and loses them on restart. `AppCredentialStore` is the one interface you implement over your own storage. After a restart, `getToken` fails until the binding secret is rotated in Space, which pushes it again.

### 2. Add the routes

The agent route passes the request to `AppActionsService`, which sends the caller's own token. The connectors route sends an app token, which no user limits. Its `@RequireCapability` check therefore decides who may use the route.

`getToken` takes the `appId` and the `spaceId` that `appCaller` reads from the verified claims. A failed Space call reaches your caller as an HTTP error with the status that Space sent.

```ts title="server/src/space-calls.controller.ts"
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  AppActionsService,
  RequireCapability,
  SpaceClientService,
  SpaceS2sService,
  appCaller,
  type AppRequest,
} from '@vectoragents/vs-apps/nest';

@Controller('space')
export class SpaceCallsController {
  constructor(
    private readonly actions: AppActionsService,
    private readonly space: SpaceClientService,
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

### 3. Register the controller

Put the controller in one module, so that `server/src/app.module.ts` changes by one line.

```ts title="server/src/space-calls.module.ts"
import { Module } from '@nestjs/common';
import { SpaceCallsController } from './space-calls.controller';

@Module({
  controllers: [SpaceCallsController],
})
export class SpaceCallsModule {}
```

Import `SpaceCallsModule` in `server/src/app.module.ts`: add it to the `imports` array, after `AppPlatformModule.forRoot(...)`.

### 4. Check the routes

Restart `npm run dev:space`. In a second terminal, call both routes with no token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:<SERVER_PORT>/api/space/agent
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/space/connectors
```

**Check**: both commands print `401`, because the global guard refuses a request with no user token.

## Result

A signed-in caller of `/api/space/agent` starts a conversation with the Space agent and receives its `threadId`. A caller of `/api/space/connectors` receives the connector registry of their space, fetched with an app token.

## Next step

Register the app in Space with [Part 2 of the quickstart](../quickstart.md#part-2-add-the-app-to-a-space), so that Space pushes the service secret to your credential store.
