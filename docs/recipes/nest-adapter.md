---
title: Use the NestJS adapter
---

Map each step of the plain-server [quickstart](../quickstart.md) to the SDK's NestJS adapter. Optional: the quickstart runs without it. This page is for NestJS servers.

The adapter is the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk). It wraps the same primitives as `/server` in a module, a guard and decorators.

## Goal

End with a NestJS server that does what the quickstart server does: it serves the [manifest](../glossary.md#manifest), verifies each user token and refuses a token that lacks the `hello:view` [capability](../glossary.md#capability).

## Prerequisites

- The starter app from the [quickstart](../quickstart.md), cloned and installed (Part 1, step 1), with the `.env` file from Part 2, step 1 in place. Step 3 below reads it. The client is unchanged.
- NestJS 11. The adapter lists `@nestjs/common` and `@nestjs/core` as peer packages.
- Background: the [server primitives](../reference/root.md) that the adapter wraps.

## Steps

### 1. Install NestJS and enable decorators

Install the NestJS packages and `reflect-metadata`. `@nestjs/platform-express` is the HTTP layer that NestJS uses by default.

```bash
npm install @nestjs/common@11 @nestjs/core@11 @nestjs/platform-express@11 reflect-metadata rxjs
```

NestJS needs the decorator options. Add them to `server/tsconfig.json`.

```json title="server/tsconfig.json"
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

The `dev` script in `server/package.json` runs `src/main.ts`, so it needs no change.

### 2. Serve the manifest

The definition and the manifest builder are the starter files, unchanged. They are repeated so that the module below has its input. `AppPlatformModule` serves the result.

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
  ],
  capabilities: [{ key: CAPABILITY, label: 'View hello', effect: 'read' }],
});
```

```ts title="server/src/manifests.ts"
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '@hello-app/shared';

export const manifests = buildManifests([definition], {
  catalogPath: 'agent-catalog.json',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
```

The module calls a credential store when Space provisions the app. The store below keeps the secrets in memory, so a restart loses them. Use a database for anything beyond a first run.

```ts title="server/src/credential-store.ts"
import { Injectable } from '@nestjs/common';
import type { AppCredentialStore } from '@vectoragents/vs-apps/nest';

@Injectable()
export class MemoryCredentialStore implements AppCredentialStore {
  private readonly secrets = new Map<string, string>();

  async upsert(appId: string, spaceId: number, secret: string): Promise<void> {
    this.secrets.set(`${appId}:${spaceId}`, secret);
  }

  async remove(appId: string, spaceId: number): Promise<void> {
    this.secrets.delete(`${appId}:${spaceId}`);
  }

  async get(appId: string, spaceId: number): Promise<string | null> {
    return this.secrets.get(`${appId}:${spaceId}`) ?? null;
  }
}
```

### 3. Verify tokens and gate by capability

In the quickstart, `requireCapability` calls `verifyAppUserToken` and then `assertCapability`. In NestJS, the platform module installs a global guard. The guard verifies every user token against `SPACE_JWKS_URL`. The `RequireCapability` decorator replaces `assertCapability`. `CurrentUser` hands the controller the verified claims.

```ts title="server/src/hello.controller.ts"
import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequireCapability } from '@vectoragents/vs-apps/nest';
import type { UserTokenClaims } from '@vectoragents/vs-apps';

@Controller('hello')
export class HelloController {
  @Get()
  @RequireCapability('hello:view')
  hello(@CurrentUser() user: UserTokenClaims) {
    return { sub: user.sub, spaceId: user.spaceId };
  }
}
```

The module reads the Space values from the `.env` file from Part 2 step 1 of the quickstart. The Nest platform module also needs `SPACE_BASE_URL`, the origin of the Space API. Append it to `.env`.

```bash
echo 'SPACE_BASE_URL=YOUR_SPACE_API_ORIGIN' >> .env
```

The module also serves `GET /api/client-config` and the manifest route, so it replaces the `routes` map of the starter's `server/src/main.ts` and `requireProvisioning` in `server/src/auth.ts`.

```ts title="server/src/app.module.ts"
import { Module } from '@nestjs/common';
import { AppPlatformModule } from '@vectoragents/vs-apps/nest';
import { MemoryCredentialStore } from './credential-store';
import { HelloController } from './hello.controller';
import { manifests } from './manifests';

@Module({
  imports: [
    AppPlatformModule.forRoot({
      options: () => ({
        spaceBaseUrl: process.env.SPACE_BASE_URL ?? '',
        spaceJwksUrl: process.env.SPACE_JWKS_URL ?? '',
        allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN ?? '',
      }),
      manifests,
      credentialStore: MemoryCredentialStore,
    }),
  ],
  controllers: [HelloController],
})
export class AppModule {}
```

### 4. Start the server

The file below replaces the starter's `server/src/main.ts`, which the `dev` script runs. Set `bodyParser: false`. The platform endpoints read the raw request body. The `api` prefix gives the manifest its `/api/manifest/:appKey` path.

```ts title="server/src/main.ts"
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');
  await app.listen(Number(process.env.SERVER_PORT));
}

bootstrap();
```

Run `npm run dev:space`. In a second terminal, request the two routes. `SERVER_PORT` is the value in `.env`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/client-config
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<SERVER_PORT>/api/manifest/hello-app
```

**Check**: the first command prints `200`. The second prints `401`, because the request carries no provisioning token.

## Result

The NestJS server answers `client-config` with `200` and `manifest/hello-app` with `401`, as the starter server does. Registration in Space and the client are the same as in the quickstart.

## Next step

Continue with [Part 2 of the quickstart](../quickstart.md#part-2-add-the-app-to-a-space) to register the app in Space.
