---
title: Open a route and read the caller
---

Leave one route of your server open to anyone, and read who is calling on another route.

<!-- flavour nest -->
Both use the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk).

By default the adapter's global guard verifies the user token of every route. `@Public` opts one route out of that check. `appCaller` returns the verified claims and the raw token for a route that stays behind the guard.

## Goal

End with two routes on the server of the quickstart app: `GET /api/open`, which answers with no token, and `GET /api/caller`, which answers with the caller's claims and refuses a request with no token.

## Prerequisites

- The Nest.js app from [Part 1 of the quickstart](../quickstart.md#part-1-run-the-app-locally), running with `npm run dev:space`. [Part 2, step 1](../quickstart.md#1-point-the-app-at-your-space) sets up the `.env` file that command reads.
- Background: the [server primitives](../reference/root.md) that the adapter wraps.

## Steps

### 1. Open a route with `@Public`

The global guard rejects a request that has no user token. Put `@Public()` on a route to skip the guard for it. The route then runs for every caller, so return nothing that belongs to one [Space](../glossary.md#space) or one user.

```ts title="server/src/open-route.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { Public } from '@vectoragents/vs-apps/nest';

@Controller('open')
export class OpenRouteController {
  @Public()
  @Get()
  open() {
    return { status: 'ok' };
  }
}
```

`@Public()` also works on a controller class. Every route of the class is then open.

### 2. Read the caller with `appCaller`

`CurrentUser`, which the quickstart controller uses, gives a controller the verified claims. `appCaller` gives the claims and the raw token string, and works in any function that receives the request.

`AppRequest` is the request type that `appCaller` takes. It lists only the fields the SDK reads, so you need no HTTP framework types. Inject the request with `@Req()` and type it as `AppRequest`.

```ts title="server/src/caller.controller.ts"
import { Controller, Get, Req } from '@nestjs/common';
import { appCaller, type AppRequest } from '@vectoragents/vs-apps/nest';

@Controller('caller')
export class CallerController {
  @Get()
  caller(@Req() req: AppRequest) {
    const { claims } = appCaller(req);
    return {
      sub: claims.sub,
      appKey: claims.appKey,
      spaceId: claims.spaceId,
      capabilities: claims.capabilities,
    };
  }
}
```

`appCaller` returns `{ userJwt, claims }`. `userJwt` is the token string the caller sent. `claims` is the verified payload, with `sub` (the user identifier), `appKey`, `spaceId` and `capabilities`.

The guard attaches both values to every route that is not `@Public`. On a `@Public` route the guard attaches nothing, so `appCaller` throws a `401` there.

### 3. Register the routes

Put both controllers in one module, so that `server/src/app.module.ts` changes by one line.

```ts title="server/src/open-route.module.ts"
import { Module } from '@nestjs/common';
import { CallerController } from './caller.controller';
import { OpenRouteController } from './open-route.controller';

@Module({
  controllers: [OpenRouteController, CallerController],
})
export class OpenRouteModule {}
```

Import `OpenRouteModule` in `server/src/app.module.ts`: add it to the `imports` array, after `AppPlatformModule.forRoot(...)`.

### 4. Check the routes

Restart `npm run dev:space`. In a second terminal, request both routes without a token. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/open
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/caller
```

**Check**: the first command prints `200`, because `@Public` skips the guard. The second prints `401`, because the guard refuses a request with no user token.

## Result

The server answers `/api/open` for anyone. It answers `/api/caller` only for a request that carries a valid user token, and returns that caller's `sub`, `appKey`, `spaceId` and `capabilities`. To add a capability check to the caller route, use `RequireCapability`, as the quickstart controller does.

## Next step

Register the app in Space with [Part 2 of the quickstart](../quickstart.md#part-2-add-the-app-to-a-space), so that a page of the app sends a real user token to `/api/caller`.
<!-- /flavour -->
<!-- flavour node todo -->
<!-- /flavour -->
