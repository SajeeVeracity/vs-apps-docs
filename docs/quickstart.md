---
title: Quickstart
---

Build one app from an empty folder to its page rendering inside a real [Space](./glossary.md#space) iframe. The stack is TypeScript throughout, React 19 with Vite for the client, and NestJS for the server. The page and the server both read a verified user token.

## Goal

End with the `hello-app` page open in a Space, showing the user and space taken from a verified token, in the browser and on your server. The app has one [page](./glossary.md#page) gated by one [capability](./glossary.md#capability). That pairing demonstrates gating. It is not an SDK minimum: `key`, `version`, one page and `capabilities: []` already pass `defineApp`.

## Prerequisites

- Node.js 22 and pnpm 10.
- A GitHub token with `read:packages` access to `@vectoragents/vs-apps` on GitHub Packages.
- A Space where you can register an app (staff) and activate it and share it (space manager). Your user also needs View access to the app, or admin rights.
- The Space server can reach your app server over HTTP. A Space that is not on your machine needs a public URL for the server, for example from a tunnel.

## Set your values

Replace each placeholder once, then run the block. It creates the project folder, exports the package token for the install and writes the rest to a `.env` file that the dev scripts load. No later step repeats a value, and no second terminal needs an export.

| Placeholder | Meaning |
| --- | --- |
| `GITHUB_PACKAGES_TOKEN` | Token with `read:packages`. Keep it out of the repository. |
| `SPACE_BASE_URL` | Origin of the Space server, with no `/api` suffix. |
| `SPACE_JWKS_URL` | The Space key set: `SPACE_BASE_URL` followed by `/api/.well-known/apps/jwks.json`. |
| `ALLOWED_PARENT_ORIGIN` | Origin of the Space web client that embeds your page. |
| `PUBLIC_BASE_URL` | Origin where the Space server reaches your app server. |
| `SERVER_PORT` | Port your app server listens on. |
| `CLIENT_PORT` | Port the Vite client serves on. |

```bash
mkdir hello-app
cd hello-app
export GITHUB_PACKAGES_TOKEN=YOUR_GITHUB_PACKAGES_TOKEN
cat > .env <<'ENV'
SPACE_BASE_URL=YOUR_SPACE_BASE_URL
SPACE_JWKS_URL=YOUR_SPACE_JWKS_URL
ALLOWED_PARENT_ORIGIN=YOUR_SPACE_CLIENT_ORIGIN
PUBLIC_BASE_URL=YOUR_APP_SERVER_ORIGIN
SERVER_PORT=YOUR_SERVER_PORT
CLIENT_PORT=YOUR_CLIENT_PORT
ENV
echo .env > .gitignore
```

## Steps

### 1. Create the project and install

In the `hello-app` folder, create the manifest of the project. The scripts load `.env`, so every Space value reaches the server and the client without an export.

```json title="package.json"
{
  "name": "hello-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev:server": "tsx watch --env-file=.env src/server/main.ts",
    "dev:client": "node --env-file=.env node_modules/vite/bin/vite.js",
    "check:server": "node --env-file=.env -e \"for (const p of ['client-config', 'manifest/hello-app']) fetch('http://localhost:' + process.env.SERVER_PORT + '/api/' + p).then((r) => console.log(p, r.status))\""
  }
}
```

Point the `@vectoragents` scope at GitHub Packages. The token comes from `GITHUB_PACKAGES_TOKEN`, so the file holds no secret.

```ini title=".npmrc"
@vectoragents:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Install the SDK and the packages its subpaths need. `jose` verifies tokens, `@nestjs/*` and `reflect-metadata` serve the server, and `react` serves the client.

```bash
pnpm add @vectoragents/vs-apps@0.2.4 jose react react-dom
pnpm add @nestjs/common@11 @nestjs/core@11 @nestjs/platform-express@11 reflect-metadata rxjs
pnpm add -D typescript tsx vite @types/node @types/react @types/react-dom
```

Add the compiler settings. NestJS needs the decorator options.

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
  "include": ["src", "vite.config.ts"]
}
```

### 2. Write the app definition

The [app definition](./glossary.md#app-definition) is the one file the server and the client share. [App definition](./app-definition.md) explains each field.

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  pages: [
    {
      key: 'home',
      label: 'Home',
      path: '/',
      capability: 'hello:view',
    },
  ],
  capabilities: [{ key: 'hello:view', label: 'View hello', effect: 'read' }],
});
```

`capability` on the page must match a capability `key` exactly. `defineApp` does not check it.

### 3. Serve the manifest and verify tokens

`buildManifests` turns the definition into the [manifest](./glossary.md#manifest). The server serves it at `GET /api/manifest/hello-app`. `PUBLIC_BASE_URL` fills any `{publicBaseUrl}` placeholder in the manifest. `agent-catalog.json` does not exist yet, which `buildManifests` tolerates.

```ts title="src/server/manifests.ts"
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '../app.definition';

export const manifests = buildManifests([definition], {
  catalogPath: 'agent-catalog.json',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
```

`AppPlatformModule` calls the credential store when Space provisions the app. This store keeps the secrets in memory, so they are lost on restart. Persist them in a database for anything beyond this quickstart.

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

The controller shows the server side of token verification. The platform module installs a global guard that verifies every user token against `SPACE_JWKS_URL`. `RequireCapability` then refuses a token that lacks `hello:view`, and `CurrentUser` hands the controller the verified claims.

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

The module reads the Space values from the environment you set up front.

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

`bodyParser: false` is required because the platform endpoints read the raw request body. The `api` prefix gives the manifest its `/api/manifest/:appKey` path.

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

Start the server.

```bash
pnpm dev:server
```

In a second terminal in the same folder, check that it answers. The manifest route is protected by a provisioning token that only Space holds, so `401` is the correct answer without one.

```bash
pnpm check:server
```

`client-config` prints `200` and `manifest/hello-app` prints `401`. Space fetches the manifest with its own token in the next step.

### 4. Register the app in Space

A staff member registers the manifest URL. Your server must be reachable at `PUBLIC_BASE_URL` from the Space server.

1. Open the app registry in the Space admin area and add an app.
2. Enter the manifest URL: `PUBLIC_BASE_URL` followed by `/api/manifest/hello-app`. Choose Continue. Space pulls and validates the manifest and shows `hello-app`, 1 page and 1 capability.
3. Set the iframe URL to the origin of the Vite client, `http://localhost:` followed by `CLIENT_PORT` in this quickstart. The field starts with the manifest origin, which is the server and not the client.
4. Switch on **Auto-apply manifest updates** so later definition changes apply without a review. Then choose Register.

This creates the [app registration](./glossary.md#app-registration). Registering applies the first manifest. Then a space manager activates the app in a space and shares it with your user. Sharing at View or Edit gives the user every capability of the app, including `hello:view`.

### 5. Write the client

The client reads its boot config from the server with `loadAppClientConfig`, which fetches `GET /api/client-config`. `AppProvider` starts the iframe bridge, verifies each token Space sends and exposes the claims. `BootGate` holds the page back until the first verified token arrives.

Add the entry page and the client files. The Vite config forwards `/api` to the server.

```ts title="vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.CLIENT_PORT),
    proxy: { '/api': `http://localhost:${process.env.SERVER_PORT}` },
  },
});
```

```html title="index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Hello app</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

`main.tsx` mounts the app and `token.ts` keeps the verified token in memory for server calls.

```tsx title="src/client/main.tsx"
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```ts title="src/client/token.ts"
let appToken: string | null = null;

export function setAppToken(token: string | null): void {
  appToken = token;
}

export async function fetchHello(): Promise<{ sub?: string; spaceId: number }> {
  const response = await fetch('/api/hello', {
    headers: { Authorization: `Bearer ${appToken}` },
  });
  if (!response.ok) throw new Error(`GET /api/hello failed with ${response.status}`);
  return response.json();
}
```

```tsx title="src/client/App.tsx"
import { loadAppClientConfig } from '@vectoragents/vs-apps/client';
import { AppProvider, BootGate } from '@vectoragents/vs-apps/react';
import { HelloPage } from './HelloPage';
import { setAppToken } from './token';

const config = loadAppClientConfig();

export function App() {
  return (
    <AppProvider
      config={config}
      navigate={(path) => window.history.replaceState(null, '', path)}
      onToken={setAppToken}
      onTheme={(theme) => {
        document.documentElement.dataset.theme = theme;
      }}
    >
      <BootGate fallback={<p>Waiting for Space.</p>}>
        <HelloPage />
      </BootGate>
    </AppProvider>
  );
}
```

The page reads the claims with `useApp`. `RequireCapability` hides the content from a user without `hello:view`. It is a display gate only, and the server check in step 3 enforces access.

```tsx title="src/client/HelloPage.tsx"
import { useEffect, useState } from 'react';
import { RequireCapability, useApp } from '@vectoragents/vs-apps/react';
import { fetchHello } from './token';

export function HelloPage() {
  const { claims, capabilities } = useApp();
  const [serverSaw, setServerSaw] = useState<string>('waiting for the server');

  useEffect(() => {
    fetchHello()
      .then((hello) => setServerSaw(`space ${hello.spaceId}, user ${hello.sub ?? 'unknown'}`))
      .catch((error: Error) => setServerSaw(error.message));
  }, []);

  return (
    <RequireCapability capability="hello:view" fallback={<p>You do not hold hello:view.</p>}>
      <main>
        <h1>Hello from a Vector app</h1>
        <p>Verified in the browser: user {claims?.sub ?? 'unknown'} in space {claims?.spaceId}.</p>
        <p>Capabilities: {Array.from(capabilities).join(', ')}</p>
        <p>Verified on the server: {serverSaw}</p>
      </main>
    </RequireCapability>
  );
}
```

Start the client in the second terminal.

```bash
pnpm dev:client
```

### 6. Open the page in Space

Open the Space and choose **Hello app** in the navigation. Its page `Home` loads: Space renders the page in an iframe at the iframe URL, sends a user token over `postMessage`, and the page shows the result below. Opened directly at the client port, the page stays on "Waiting for Space." because no host sends a token.

## Debugging aside: the dev harness

`VectorAppsHarness` from `@vectoragents/vs-apps/harness` stands in for Space on your machine, so a page can run before any registration. It needs the dev issuer switched on in `AppPlatformModule.forRoot` and a second HTML entry that mounts the harness. Use it to debug a page. It is not part of this quickstart path, and the [harness](./glossary.md#harness) entry in the glossary lists what it does not cover.

## Result

The page in the Space iframe shows three lines: the user and space from the token verified in the browser, the capabilities the token carries, and the user and space the server read from the same token. The path covered the definition, the manifest, the registration, the provider and the gated page.

## Next steps

- [App definition](./app-definition.md): learn what each definition field does.
- [Recipes](/category/recipes): add a page, a capability or an agent action to this app.
