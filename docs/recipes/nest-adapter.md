---
title: Use the NestJS adapter
---

Map each step of the plain-server [quickstart](../quickstart.md) to the SDK's NestJS adapter. The quickstart does not need this page. Read it only if your server is a NestJS server.

The adapter is the `@vectoragents/vs-apps/nest` subpath of the [SDK](../glossary.md#sdk). It wraps the same primitives as `/server` in a module, a guard and decorators.

## Goal

End with a NestJS server that does what the quickstart server does: it serves the [manifest](../glossary.md#manifest), verifies each user token and refuses a token that lacks the `hello:view` [capability](../glossary.md#capability).

## Prerequisites

- The project from the [quickstart](../quickstart.md), up to step 2 (the app definition). The client is unchanged.
- NestJS 11. The adapter lists `@nestjs/common` and `@nestjs/core` as peer packages.
- Background: the [server primitives](../reference/root.md) that the adapter wraps.

## Steps

### 1. Install NestJS and enable decorators

Install the NestJS packages and `reflect-metadata`. `@nestjs/platform-express` is the HTTP layer that NestJS uses by default.

```bash
npm install @nestjs/common@11 @nestjs/core@11 @nestjs/platform-express@11 reflect-metadata rxjs
```

NestJS needs the decorator options. Add them to the compiler options of the quickstart.

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

Point the `dev:server` script at `src/server/main.ts` as before. It needs no other change.

### 2. Serve the manifest

The manifest builder is the same as in the quickstart. `AppPlatformModule` serves the result, so you write no manifest route.

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  pages: [{ key: 'home', label: 'Home', path: '/', capability: 'hello:view' }],
  capabilities: [{ key: 'hello:view', label: 'View hello', effect: 'read' }],
});
```

```ts title="src/server/manifests.ts"
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '../app.definition';

export const manifests = buildManifests([definition], {
  catalogPath: 'agent-catalog.json',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
```

The module calls a credential store when Space provisions the app. The plain quickstart has no store. This one keeps the secrets in memory, so a restart loses them. Use a database for anything beyond a first run.

```ts title="src/server/credential-store.ts"
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

In the quickstart, `requireHelloUser` calls `verifyAppUserToken` and then `assertCapability`. In NestJS, the platform module installs a global guard that verifies every user token against `SPACE_JWKS_URL`. The `RequireCapability` decorator then replaces `assertCapability`, and `CurrentUser` hands the controller the verified claims.

```ts title="src/server/hello.controller.ts"
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

The module reads the Space values from the `.env` file that you set up in the quickstart. It also serves `GET /api/client-config` and the manifest route, so it replaces `main.ts` routing and `requireProvisioning` from the quickstart.

```ts title="src/server/app.module.ts"
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

Set `bodyParser: false`. The platform endpoints read the raw request body. The `api` prefix gives the manifest its `/api/manifest/:appKey` path.

```ts title="src/server/main.ts"
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

Run `npm run dev:server` and `npm run check:server`. The output is the same as in the quickstart: `client-config` prints `200` and `manifest/hello-app` prints `401`.

## Result

The NestJS server answers the same three requests as the quickstart server. Registration in Space and the client are the same as in the quickstart.

## Next step

Continue with step 4 of the [quickstart](../quickstart.md#4-register-the-app-in-space) to register the app in Space.
