---
title: Quickstart
---

Build an app from scratch and load it in a [Space](./glossary.md#space). You write TypeScript for Node and React. The page and the server both read a verified user token.

## Goal

End with the `hello-app` page open in a Space, showing the user and space taken from a verified token, in the browser and on your server. The app has one [page](./glossary.md#page) gated by one [capability](./glossary.md#capability). That pairing demonstrates gating. It is not an SDK minimum: `key`, `version`, one page and `capabilities: []` already pass `defineApp`.

## Prerequisites

- Node.js 20.6 or later, React 18 or later and TypeScript 5 or later with `strict`. Commands use `npm`. If you use another package manager, run the equivalent command.
- A GitHub token with `read:packages` access to `@vectoragents/vs-apps` on GitHub Packages.
- A Space where you can register an app (staff) and activate it and share it (space manager). Your user also needs View access to the app, or admin rights.
- Your user belongs to a space that has a published agent. Without one, Space shows "No spaces yet".
- If your organization has a license, the license must allow the app. Space does not list an app that the license leaves out. Staff change the license in the admin portal. A Space with no license needs nothing here.
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
| `CLIENT_PORT` | Port your bundler serves the client on. |

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

In the `hello-app` folder, create the manifest of the project. The server script loads `.env`, so every Space value reaches the server without an export.

```json title="package.json"
{
  "name": "hello-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "tsx watch --env-file=.env src/server/main.ts",
    "check:server": "node --env-file=.env -e \"for (const p of ['client-config', 'manifest/hello-app']) fetch('http://localhost:' + process.env.SERVER_PORT + '/api/' + p).then((r) => console.log(p, r.status))\""
  }
}
```

The registry setting has three parts: a scope, a registry URL and a token. Point the `@vectoragents` scope at GitHub Packages. The token comes from `GITHUB_PACKAGES_TOKEN`, so the file holds no secret.

```ini title=".npmrc"
@vectoragents:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Install the SDK and the packages its subpaths need. `jose` verifies tokens and `react` serves the client. `tsx` runs the TypeScript server on Node.

```bash
npm install @vectoragents/vs-apps@0.2.4 jose react react-dom
npm install --save-dev typescript tsx @types/node @types/react @types/react-dom
```

Add the compiler settings.

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "types": ["node"],
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
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

`buildManifests` turns the definition into the [manifest](./glossary.md#manifest). The server serves it at `GET /api/manifest/hello-app`. `PUBLIC_BASE_URL` fills any `{publicBaseUrl}` placeholder in the manifest. `agent-catalog.json` does not exist yet, which `buildManifests` tolerates. The server prints a warning about the missing file when it starts. Ignore it.

```ts title="src/server/manifests.ts"
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '../app.definition';

export const manifests = buildManifests([definition], {
  catalogPath: 'agent-catalog.json',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
```

The auth module holds the token verifier and the checks that protected routes run. The verifier reads the Space key set from `SPACE_JWKS_URL`. `extractBearer` reads the `Authorization` header. `verifyAppUserToken` verifies the user token and returns its claims. `assertCapability` refuses a token that lacks the capability that `requireCapability` names.

```ts title="src/server/auth.ts"
import type { IncomingMessage } from 'node:http';
import {
  assertCapability,
  createSpaceTokenVerifier,
  extractBearer,
  verifyAppUserToken,
  verifyProvisioningToken,
} from '@vectoragents/vs-apps/server';

const verifier = createSpaceTokenVerifier({ jwksUrl: process.env.SPACE_JWKS_URL ?? '' });

export async function requireCapability(req: IncomingMessage, capability: string) {
  const claims = await verifyAppUserToken(verifier, extractBearer(req.headers));
  assertCapability(claims, capability);
  return claims;
}

export function requireProvisioning(req: IncomingMessage) {
  return verifyProvisioningToken(verifier, extractBearer(req.headers));
}
```

The server answers five requests. `GET /api/client-config` tells the client which parent origin and key set to trust. `GET /api/manifest/hello-app` serves the manifest to Space, which sends a provisioning token. `GET /api/hello` returns the claims of a verified user token. `POST /api/provision` and `POST /api/deprovision` are called by Space when a space manager adds or removes the app in step 4. Space sends the provisioning token and, on provision, a `serviceSecret` for server-to-server calls. This app makes no such calls, so the routes only verify the token and ignore the secret. Without these routes, adding the app fails with a `404`. A failed check throws `AppAuthError`, which carries the HTTP status.

```ts title="src/server/main.ts"
import { createServer, type ServerResponse } from 'node:http';
import { AppAuthError } from '@vectoragents/vs-apps/server';
import { requireCapability, requireProvisioning } from './auth';
import { manifests } from './manifests';

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (pathname === '/api/client-config') {
      return send(res, 200, {
        allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN,
        spaceJwksUrl: process.env.SPACE_JWKS_URL,
      });
    }
    if (pathname === '/api/manifest/hello-app') {
      await requireProvisioning(req);
      return send(res, 200, manifests['hello-app']);
    }
    if (pathname === '/api/provision' || pathname === '/api/deprovision') {
      await requireProvisioning(req);
      return send(res, 200, { ok: true });
    }
    if (pathname === '/api/hello') {
      const claims = await requireCapability(req, 'hello:view');
      return send(res, 200, { sub: claims.sub, spaceId: claims.spaceId });
    }
    send(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof AppAuthError) return send(res, error.status, { error: error.message });
    send(res, 500, { error: 'Server error' });
  }
}).listen(Number(process.env.SERVER_PORT));
```

Start the server.

```bash
npm run dev:server
```

In a second terminal in the same folder, check that it answers. The manifest route is protected by a provisioning token that only Space holds, so `401` is the correct answer without one.

```bash
npm run check:server
```

`client-config` prints `200` and `manifest/hello-app` prints `401`. Space fetches the manifest with its own token in the next step.

### 4. Register the app in Space

A staff member registers the manifest URL. Your server must be reachable at `PUBLIC_BASE_URL` from the Space server.

1. Open the app registry in the Space admin area and add an app.
2. Enter the manifest URL: `PUBLIC_BASE_URL` followed by `/api/manifest/hello-app`. Choose Continue. Space pulls and validates the manifest and shows `hello-app`, 1 page and 1 capability.
3. Set the iframe URL to the origin of the client, `http://localhost:` followed by `CLIENT_PORT` in this quickstart. The field starts with the manifest origin, which is the server and not the client.
4. Switch on **Auto-apply manifest updates** so later definition changes apply without a review. Then choose Register.
5. Edit the new row and switch on **Enabled**. A new registration is disabled, and Space does not offer a disabled app to any space.

This creates the [app registration](./glossary.md#app-registration). Registering applies the first manifest. Then a space manager activates the app in a space and shares it with your user. Sharing at View or Edit gives the user every capability of the app, including `hello:view`.

To activate the app, open **Settings**, then **Space**, then **Context Hub**, then **Resources**. Choose **New**, then **Add App**, and pick **Hello app**. Space calls `POST /api/provision` on your server. If the dialog stays open, check the server log for a failed route. A space admin already appears under **Who can use it** with `hello:view`. To share the app with another user, open the three-dots menu on the app row in **Resources** and choose **Access**.

### 5. Write the client

The client reads its boot config from the server with `loadAppClientConfig`, which fetches `GET /api/client-config`. `AppProvider` starts the iframe bridge, verifies each token Space sends and exposes the claims. `BootGate` holds the page back until the first verified token arrives.

The client is plain React files with no bundler-specific import and no environment access. Serve them with your bundler on `CLIENT_PORT`. Your bundler needs four settings:

- `src/client/main.tsx` is the entry file.
- The HTML page has a `div` with the id `root` and a `script` tag with `type="module"` that points at the entry file.
- The bundler compiles JSX and TypeScript.
- The bundler forwards requests under `/api` to `SERVER_PORT`, so the client and the server share one origin.

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

Start your bundler on `CLIENT_PORT` in the second terminal.

### 6. Open the page in Space

Open the Space, expand the **Apps** group in the sidebar and choose **Hello app**. Its page `Home` loads: Space renders the page in an iframe at the iframe URL, sends a user token over `postMessage`, and the page shows the result below. Opened directly at the client port, the page stays on "Waiting for Space." because no host sends a token.

## Debugging aside: the dev harness

`VectorAppsHarness` from `@vectoragents/vs-apps/harness` stands in for Space on your machine, so a page can run before any registration. It needs the dev routes on your server and a second HTML page that mounts the harness. The [harness reference](./reference/harness.md) gives the routes. Use it to debug a page. The quickstart runs without it. The [harness](./glossary.md#harness) entry in the glossary lists what it does not cover.

## Result

The page in the Space iframe shows three lines: the user and space from the token verified in the browser, the capabilities the token carries, and the user and space the server read from the same token. The path covered the definition, the manifest, the registration, the provider and the gated page.

## Next steps

- [App definition](./app-definition.md): learn what each definition field does.
- [Recipes](/category/recipes): add a page, a capability or an agent action to this app.
