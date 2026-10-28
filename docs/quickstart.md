---
title: Quickstart
---

Build an app in a [monorepo](./glossary.md#monorepo), then add it to a [Space](./glossary.md#space). The page and the server both read the same verified user token.

## Goal

You build one [page](./glossary.md#page), one [capability](./glossary.md#capability), a server and a [shared package](./glossary.md#shared-package). Only users who hold the capability see the page. You also register the app and add it to a space.

At the end, the `hello-app` page is open in a Space. It shows your user id and space id twice: read in the browser, and read by your server. Both come from the same verified token that Space sends.

## Prerequisites

Space side:

- [ ] You are [staff](./glossary.md#staff). Staff register apps.
- [ ] You are a [space manager](./glossary.md#space-manager). Space managers add an app to a space and share it.
- [ ] Your user has View access to the app, or admin rights.
- [ ] Your space has a published agent. Without one, Space shows "No spaces yet".
- [ ] Your license allows the app. Staff change the license.
- [ ] The Space server can reach your server. A Space on another machine needs a public URL, for example from a tunnel.

App side:

- [ ] Node.js 20.19 or later, and `npm`.
- [ ] A GitHub token with `read:packages` access to `@vectoragents/vs-apps`.

## Final layout

```text
hello-app/
├── .env
├── .gitignore
├── .npmrc
├── package.json
├── tsconfig.base.json
├── node_modules/
├── client/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── HelloPage.tsx
│       └── token.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── auth.ts
│       └── manifests.ts
└── shared/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── index.ts
```

## Part 1: Build and run the app

### 1. Create the workspace and install

Create the folders. Export your package token. `.npmrc` reads the token at install, so it is not in `.env`. Run every `npm install` in this terminal.

```bash
mkdir -p hello-app/client/src hello-app/server/src hello-app/shared/src
cd hello-app
export GITHUB_PACKAGES_TOKEN=YOUR_GITHUB_PACKAGES_TOKEN
echo .env > .gitignore
echo node_modules >> .gitignore
```

`GITHUB_PACKAGES_TOKEN` is a token with `read:packages`. Keep it out of the repository.

The root `package.json` lists the three packages as `workspaces`. Its scripts run the dev servers, the type check and the server check. `typescript` is pinned to 7.0.2, the tested version. A new major version can change the result.

```json title="package.json"
{
  "name": "hello-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev:server": "npm run dev --workspace @hello-app/server",
    "dev:client": "npm run dev --workspace @hello-app/client",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "check:server": "node --env-file=.env -e \"for (const p of process.argv.slice(1)) fetch('http://localhost:' + process.env.SERVER_PORT + '/api/' + p).then((r) => console.log(p, r.status))\" --"
  },
  "devDependencies": {
    "typescript": "7.0.2"
  }
}
```

The registry setting has three parts: a scope, a registry URL and a token. Point the `@vectoragents` scope at GitHub Packages. The token comes from `GITHUB_PACKAGES_TOKEN`, so the file holds no secret. npm reads only this root file.

```ini title=".npmrc"
@vectoragents:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

The base compiler settings are shared. Each package extends them.

```json title="tsconfig.base.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

Each package lists only what it imports, and the SDK version is pinned. `jose` verifies tokens, and `tsx` runs the TypeScript server on Node. Vite serves the client. The `dev` scripts load `../.env`.

```json title="shared/package.json"
{
  "name": "@hello-app/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vectoragents/vs-apps": "0.2.4"
  }
}
```

`exports` points at TypeScript source, so the shared package needs no build step. `tsx`, Vite and `tsc` all read it.

```json title="server/package.json"
{
  "name": "@hello-app/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=../.env src/main.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hello-app/shared": "*",
    "@types/node": "^26.6.5",
    "@vectoragents/vs-apps": "0.2.4",
    "jose": "^5.10.0",
    "tsx": "^4.23.15"
  }
}
```

```json title="client/package.json"
{
  "name": "@hello-app/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --env-file=../.env ../node_modules/vite/bin/vite.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hello-app/shared": "*",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vectoragents/vs-apps": "0.2.4",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "vite": "^8.3.5"
  }
}
```

Add one `tsconfig.json` in each package.

```json title="shared/tsconfig.json"
{
  "extends": "../tsconfig.base.json",
  "include": ["src"]
}
```

```json title="server/tsconfig.json"
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

```json title="client/tsconfig.json"
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022", "DOM"] },
  "include": ["src", "vite.config.ts"]
}
```

Install all packages once, at the root.

```bash
npm install
```

**Check**: run `npm ls @vectoragents/vs-apps`. The command exits with 0 and shows the SDK in all three packages.

```text
hello-app@0.1.0 /path/to/hello-app
├─┬ @hello-app/client@0.1.0 -> ./client
│ └── @vectoragents/vs-apps@0.2.4
├─┬ @hello-app/server@0.1.0 -> ./server
│ └── @vectoragents/vs-apps@0.2.4 deduped
└─┬ @hello-app/shared@0.1.0 -> ./shared
  └── @vectoragents/vs-apps@0.2.4 deduped
```

### 2. Write the shared app definition

The [app definition](./glossary.md#app-definition) is the one file the server and the client share. [App definition](./app-definition.md) explains each field. `CAPABILITY` holds the capability key, so no file repeats the string.

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

`capability` on the page must match a capability `key` exactly. `defineApp` does not check it.

**Check**: run `npm run typecheck --workspace @hello-app/shared`. The command exits with 0 and prints no error line.

```text
> @hello-app/shared@0.1.0 typecheck
> tsc --noEmit
```

### 3. Serve the manifest

`buildManifests` turns the definition into the [manifest](./glossary.md#manifest). The server serves it at `GET /api/manifest/hello-app`. `PUBLIC_BASE_URL` fills each `{publicBaseUrl}` placeholder in the manifest.

`agent-catalog.json` does not exist yet, and `buildManifests` accepts that. The path resolves against `server/`. At start, the server prints a warning that begins with `agent-catalog file not found`. Ignore it.

```ts title="server/src/manifests.ts"
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '@hello-app/shared';

export const manifests = buildManifests([definition], {
  catalogPath: 'agent-catalog.json',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
```

The auth module holds the token verifier and the checks that protected routes run. The verifier reads the Space key set from `SPACE_JWKS_URL`. `extractBearer` reads the `Authorization` header. `verifyAppUserToken` verifies the user token and returns its claims.

`assertCapability` refuses a token that lacks the capability you name.

```ts title="server/src/auth.ts"
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

The server keeps a table of routes. `GET /api/client-config` tells the client which parent origin and key set to trust. `GET /api/manifest/hello-app` serves the manifest to Space, which sends a provisioning token. A failed check throws `AppAuthError`, which carries the HTTP status.

The imports include `requireCapability` and `CAPABILITY`. Part 1 step 4, "Add the protected routes", uses them.

```ts title="server/src/main.ts"
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { CAPABILITY } from '@hello-app/shared';
import { AppAuthError } from '@vectoragents/vs-apps/server';
import { requireCapability, requireProvisioning } from './auth';
import { manifests } from './manifests';

type Route = (req: IncomingMessage) => Promise<unknown>;

const routes: Record<string, Route> = {
  '/api/client-config': async () => ({
    allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN,
    spaceJwksUrl: process.env.SPACE_JWKS_URL,
  }),
  '/api/manifest/hello-app': async (req) => {
    await requireProvisioning(req);
    return manifests['hello-app'];
  },
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const route = routes[pathname];
  try {
    if (!route) return send(res, 404, { error: 'Not found' });
    send(res, 200, await route(req));
  } catch (error) {
    if (error instanceof AppAuthError) return send(res, error.status, { error: error.message });
    send(res, 500, { error: 'Server error' });
  }
}).listen(Number(process.env.SERVER_PORT));
```

Append the values this step needs to `.env`.

```bash
cat >> .env <<'ENV'
SPACE_JWKS_URL=YOUR_SPACE_API_ORIGIN/api/.well-known/apps/jwks.json
ALLOWED_PARENT_ORIGIN=YOUR_SPACE_CLIENT_ORIGIN
PUBLIC_BASE_URL=YOUR_APP_SERVER_ORIGIN
SERVER_PORT=3001
ENV
```

- `SPACE_JWKS_URL` is the Space key set. It is the origin of the Space API followed by `/api/.well-known/apps/jwks.json`. Do not use the Space web origin.
- `ALLOWED_PARENT_ORIGIN` is the origin of the Space web client that embeds your page.
- `PUBLIC_BASE_URL` is the origin where the Space server reaches your server.
- `SERVER_PORT` is the port your server listens on. If port 3001 is busy, for example because a local Space client uses it, change the value.

**Check**: run this command to fetch the key set. The output is `{"keys":[`. A web page that starts with `<` means the `/api` prefix is missing.

```bash
node --env-file=.env -e "fetch(process.env.SPACE_JWKS_URL).then((r) => r.text()).then((t) => console.log(t.slice(0, 9)))"
```

```text
{"keys":[
```

Start the server in this terminal.

```bash
npm run dev:server
```

In a second terminal in the same folder, request the two routes. The manifest route needs a provisioning token that only Space holds. A `401` is the correct answer without one.

```bash
npm run check:server -- client-config manifest/hello-app
```

**Check**: the command prints these two lines.

```text
client-config 200
manifest/hello-app 401
```

### 4. Add the protected routes

`GET /api/hello` returns the claims of a verified user token. Space calls `POST /api/provision` and `POST /api/deprovision` when a space manager adds or removes the app. Those two routes verify the provisioning token. They ignore the `serviceSecret` that Space sends, because this app makes no server-to-server calls.

Add this block at the end of `server/src/main.ts`.

```ts title="server/src/main.ts" add
routes['/api/hello'] = async (req) => {
  const claims = await requireCapability(req, CAPABILITY);
  return { sub: claims.sub, spaceId: claims.spaceId };
};
```

Add this block below it.

```ts title="server/src/main.ts" add
for (const path of ['/api/provision', '/api/deprovision']) {
  routes[path] = async (req) => {
    await requireProvisioning(req);
    return { ok: true };
  };
}
```

Without the two provisioning routes, Space gets a `404` when a space manager adds the app.

`tsx watch` restarts the server when you save the file.

**Check**: wait a few seconds. In the second terminal, run `npm run check:server -- hello provision`. Both routes answer `401`, because the request has no Space token.

```text
hello 401
provision 401
```

### 5. Write the page

The client reads its boot config from the server with `loadAppClientConfig`, which fetches `GET /api/client-config`. `AppProvider` starts the iframe bridge, verifies each token Space sends and exposes the claims. `BootGate` holds the page back until the first verified token arrives.

`token.ts` keeps the verified token in memory for server calls.

```ts title="client/src/token.ts"
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

The page reads the claims with `useApp`. `RequireCapability` hides the content from a user without `hello:view`. It is a display gate only. The server check in Part 1 step 4, "Add the protected routes", enforces access.

```tsx title="client/src/HelloPage.tsx"
import { useEffect, useState } from 'react';
import { CAPABILITY } from '@hello-app/shared';
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
    <RequireCapability capability={CAPABILITY} fallback={<p>You do not hold {CAPABILITY}.</p>}>
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

**Check**: run `npm run typecheck`. The command exits with 0 and prints one `tsc --noEmit` run for each package, with no error line.

```text
> hello-app@0.1.0 typecheck
> npm run typecheck --workspaces --if-present

> @hello-app/client@0.1.0 typecheck
> tsc --noEmit

> @hello-app/server@0.1.0 typecheck
> tsc --noEmit

> @hello-app/shared@0.1.0 typecheck
> tsc --noEmit
```

### 6. Boot the client

The client is plain React files with no bundler-specific import and no environment access. Vite serves them on `CLIENT_PORT`. It forwards requests under `/api` to `SERVER_PORT`, so the client and the server share one origin.

```ts title="client/vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.CLIENT_PORT),
    strictPort: true,
    proxy: { '/api': `http://localhost:${process.env.SERVER_PORT}` },
  },
});
```

The HTML page has a `div` with the id `root` and a `script` tag with `type="module"` that points at the entry file.

```html title="client/index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Hello app</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`main.tsx` mounts the app. `App.tsx` wraps the page in the provider and the boot gate.

```tsx title="client/src/main.tsx"
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```tsx title="client/src/App.tsx"
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

Append the client port to `.env`.

```bash
echo CLIENT_PORT=5173 >> .env
```

`CLIENT_PORT` is the port Vite serves the client on. You may change it. The iframe URL in Part 2 uses the same value.

Start the client in the second terminal. Keep the server running in the first.

```bash
npm run dev:client
```

**Check**: open `http://localhost:5173` in a browser. The page shows this text. No Space host sends a token yet, so the page stays here.

```text
Waiting for Space.
```

## See the page without Space

Skip this section if you have Space access. Without Space access, stop after Part 1, or debug the page with the dev harness. The harness stands in for Space and needs no registration. The [harness reference](./reference/harness.md) gives the routes, and the [harness](./glossary.md#harness) glossary entry lists what it does not cover.

## Part 2: Add the app to Space

Part 2 runs in the Space UI. Your server and client from Part 1 stay running. Each step names the role that does it.

### 1. Register and enable the app (staff)

A staff member registers the manifest URL. Your server must be reachable at `PUBLIC_BASE_URL` from the Space server. This creates the [app registration](./glossary.md#app-registration).

1. Choose **Settings**, **Admin**, **Platform**, then **Apps**. Choose **Add app**.
2. Enter the manifest URL in **Manifest URL**: `PUBLIC_BASE_URL` followed by `/api/manifest/hello-app`. Choose **Continue**.
3. Check that Space shows `hello-app`, `Hello app`, `v0.1.0`, `1 pages` and `1 capabilities`.
4. Set **Iframe URL** to `http://localhost:` followed by `CLIENT_PORT`. The field starts with the manifest origin, which is the server and not the client.
5. Switch on **Auto-apply manifest updates**. Choose **Register**.
6. On the new row, choose **Edit**. Switch on **Enabled**. Choose **Save**.

**Check**: Space shows the toast `App saved`. The row `Hello app` shows **Enabled**.

### 2. Allow the app in the license (staff)

Space offers a new registration in **Add an app** only after the organization license allows it.

1. Choose **Admin**, **Tenancy**, then **Organizations**. Choose **Edit license** on your organization.
2. Under **Allowed apps**, select the **Hello app** chip. Choose **Save**.

**Check**: Space shows the toast `License saved`.

### 3. Add the app to a space (space manager)

1. Choose **Settings**, **Space**, **Context Hub**, then **Resources**.
2. Choose **Add resource**, then **App**. In the **Add an app** dialog, choose **Add** next to **Hello app**.

**Check**: Space shows the toast `App enabled`. **Resources** lists a **Hello app** row with type **App** and status **Active**.

### 4. Share the app with a user (space manager)

An admin already has access. If you are an admin, skip the share and read the Check.

1. On the **Hello app** row, open the row menu. Choose **Access**.
2. Add your user in **Direct access**.

**Check**: on the **Configure Hello app** sheet, your user appears under **Who can use it**. An admin has an **Admin** badge.

### 5. Open the page

Open the Space. Expand the **Apps** group in the sidebar and choose **Hello app**. Space renders the page in an iframe at the iframe URL and sends a user token over `postMessage`.

**Check**: the page shows three lines. The two user ids are equal, and the two space ids are equal.

```text
Verified in the browser: user <id> in space <id>.
Capabilities: hello:view
Verified on the server: space <id>, user <id>
```

## Result

The `hello-app` page is open in a Space. It shows the same three lines as the last Check.

```text
Verified in the browser: user <id> in space <id>.
Capabilities: hello:view
Verified on the server: space <id>, user <id>
```

Both user ids come from the one token that Space sends. The path covered the definition, the manifest, the registration, the provider and the gated page.

## Next steps

- [App definition](./app-definition.md): learn what each definition field does.
- [Recipes](/category/recipes): add a page, a capability or an agent action to this app.
