---
title: Harness reference
---

Reference for `@vectoragents/vs-apps/react/harness` 0.4.0. The [harness](../glossary.md#harness) is a local stand-in for [Space](../glossary.md#space). The starter includes the harness already wired. This page is the manual-wiring guide for an app that is not built from the starter. An app does not need the harness to ship.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- React 18 or later with TypeScript.
- The app server running with `VA_DEV_ISSUER=true`, and serving the [dev routes](#dev-routes), which the app platform of the SDK serves. See [Turn the harness on and off](#turn-the-harness-on-and-off).
- A second HTML entry for the harness, served by your bundler.

## `VectorAppsHarness`

Renders a Space-like shell around the app, which runs in an iframe from the same origin.

### Signature

```typescript
function VectorAppsHarness(): JSX.Element;
```

### Behaviour

- Fetches `/api/__dev/manifests` from the app server to build the sidebar of apps and pages.
- Mints a token for the chosen identity and capabilities through `POST /api/__dev/token`, and sends it to the iframe. Changing the capability set in the dev panel re-mints it.
- Shows an error with the `VA_DEV_ISSUER=true` hint when the manifests request fails.
- Keeps the selected app, page, capabilities, theme and identity in the page query string, so a reload restores them.
- Remembers the dev panel and sidebar open state in `localStorage`.
- Takes no props.
- Serve it only in development. Never build it into the production bundle. Keep it in a separate HTML entry that the build does not list as an input.

### Example

```tsx title="src/harness.tsx"
import { VectorAppsHarness } from '@vectoragents/vs-apps/react/harness';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VectorAppsHarness />
  </StrictMode>,
);
```

Load it from `harness.html`, a sibling of `index.html` whose script tag points at this file.

```html title="harness.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/harness.tsx"></script>
  </body>
</html>
```

Serve `harness.html` with your bundler, and open `/harness.html` on the client port.

## Dev routes

The app server serves three routes on the same origin as the page, under `/api`. Your bundler forwards `/api` to the app server. The platform answers each route only while it holds a dev issuer, which the example turns on with `VA_DEV_ISSUER=true`. Otherwise the route is not served. The app platform of `@vectoragents/vs-apps/server` serves all three. The harness calls the first two. The third publishes the key set that verifies the dev tokens.

### `GET /api/__dev/manifests`

Returns status `200` and a JSON array with one entry per app in the server. The harness builds its sidebar from the array.

| Field | Type | Meaning |
| --- | --- | --- |
| `appKey` | string | The `key` of the app definition. |
| `appId` | UUID | The fixed dev id, `DEV_APP_ID` from `@vectoragents/vs-apps`. |
| `manifest` | object | The [manifest](../glossary.md#manifest) that `buildManifests` returns for the app. |

### `POST /api/__dev/token`

Signs a token with the dev issuer. The body is JSON with a `kind` field. The harness sends `kind: "user"`. The other kinds are `provisioning`, `a2a`, `mcp`, `actions` and `events`.

A `user` request has these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | `"user"` | Selects the user token. |
| `sub` | string | The user id. |
| `appId` | UUID | The app id. A string that is not a UUID gets status `400`. Use `DEV_APP_ID`. |
| `appKey` | string | The app key. |
| `spaceId` | number | The space id. |
| `organizationId` | number | The organization id. |
| `capabilities` | string array | The capability keys the token holds. |
| `name` | string, optional | The display name. |
| `picture` | string, optional | The picture URL. |
| `ttlSeconds` | number, optional | The lifetime in seconds. A user token defaults to 300. |

A valid request returns status `200` and a JSON body:

| Field | Type | Meaning |
| --- | --- | --- |
| `token` | string | The signed token. |
| `expiresIn` | number | The lifetime in seconds. |
| `claims` | object | The claims inside the token, with `iss`, `aud`, `iat` and `exp` added. |

An invalid request returns status `400`. The harness shows the response text in its dev panel.

### `GET /api/__dev/jwks.json`

Returns status `200` and the public key set of the dev issuer. The set verifies the tokens that `POST /api/__dev/token` signs.

### Example

<!-- flavour node -->
`createAppPlatform` serves the three dev routes, the manifest route and the other routes that Space calls. It serves them once it holds a dev issuer. `createDevIssuer` signs tokens and verifies them, so one object serves both. It stores nothing, and it makes a new key on each call, so a restart makes the tokens of the open harness invalid. To keep them valid, save the `privateKey` of the issuer and pass it back to `createDevIssuer`.

The platform also needs an `AppCredentialStore`, where it keeps the secret that Space pushes when it adds the app. The store below keeps the secrets in memory. The platform answers Fetch requests, so `handlePlatformRoute` bridges a `node:http` request to one. It returns `true` when the platform answered the request, and `false` for every other request.

```ts title="server/src/platform.ts"
import { createAppPlatform, createDevIssuer, type AppCredentialStore, type AppManifests } from '@vectoragents/vs-apps/server';

const secrets = new Map<string, string>();

const credentialStore: AppCredentialStore = {
  async upsert(appId, spaceId, secret) {
    secrets.set(`${appId}:${spaceId}`, secret);
  },
  async remove(appId, spaceId) {
    secrets.delete(`${appId}:${spaceId}`);
  },
  async get(appId, spaceId) {
    return secrets.get(`${appId}:${spaceId}`) ?? null;
  },
};

export async function createPlatform(manifests: AppManifests) {
  return createAppPlatform({
    options: {
      // The platform takes the Space origin; SPACE_API_URL ends in /api.
      spaceBaseUrl: (process.env.SPACE_API_URL ?? '').replace(/\/api\/?$/, ''),
      spaceJwksUrl: process.env.SPACE_JWKS_URL ?? '',
      allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN ?? '',
    },
    manifests,
    credentialStore,
    devIssuer: process.env.VA_DEV_ISSUER === 'true' ? await createDevIssuer() : undefined,
  });
}
```

```ts title="server/src/platform-routes.ts"
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { AppPlatform } from '@vectoragents/vs-apps/server';

function toFetchRequest(req: IncomingMessage): Request {
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream);
  return new Request(new URL(req.url ?? '/', 'http://localhost'), {
    method,
    headers: req.headers as Record<string, string>,
    body,
    duplex: 'half',
  } as RequestInit);
}

export async function handlePlatformRoute(
  platform: AppPlatform,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const response = await platform.fetch(toFetchRequest(req));
  if (!response) return false;
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
}
```

## Accept dev tokens

Create the platform once at boot with `const platform = await createPlatform(manifests);`, with the manifests from `buildManifests`. Call `handlePlatformRoute` first inside the `try` block of your request handler, before any route of your own: `if (await handlePlatformRoute(platform, req, res)) return;`. Then make two more changes so the app accepts the tokens that the dev issuer signs. Without both, the iframe stays on "Waiting for Space.".

1. **Allow the harness origin.** Set `ALLOWED_PARENT_ORIGIN` to the harness origin, the origin that your bundler serves `harness.html` from, for example `http://localhost:5173`. The harness page is the parent of the iframe, so the client accepts messages from this origin only. A Space origin here makes the `postMessage` call from the iframe fail.
2. **Verify with the dev issuer.** Pass `platform.verifier` to `verifyUserToken` in place of a Space verifier. It is the dev issuer while the platform holds one. Otherwise `GET /api/hello` fails with status `401`.

The platform serves `GET /api/client-config` itself. While it holds a dev issuer, the `spaceJwksUrl` of that route is `/api/__dev/jwks.json`, so the browser verifies the token against the dev key set. A route of your own does not need to return it.

```ts title="server/src/auth.ts"
import type { IncomingMessage } from 'node:http';
import { readBearer, verifyUserToken, type AppPlatform } from '@vectoragents/vs-apps/server';

export function requireUser(platform: AppPlatform, req: IncomingMessage) {
  return verifyUserToken(platform.verifier, readBearer(req.headers));
}
```

When the page works, the harness card shows the user, the space and the capabilities of the token, and a request to your server succeeds.
<!-- /flavour -->
<!-- flavour nest todo -->
<!-- /flavour -->

## Turn the harness on and off

Set `VA_DEV_ISSUER=true` in the environment of the app server process, in the command that starts it, for example `VA_DEV_ISSUER=true npm run dev`. A watch runner such as `tsx watch` does not reload `.env`, so restart the server after you change the value.

To run against a real Space, start the server without `VA_DEV_ISSUER`. Set `ALLOWED_PARENT_ORIGIN` to the Space origin and `SPACE_JWKS_URL` to the Space key set URL. Never build `harness.html` into the production bundle.

## Limits

The harness signs its own tokens, so it proves your page and server. These parts of the path stay outside it:

- Vector's registration of the app.
- Space fetching the manifest from your server.
- The license and space access that let a user open the app.
- The real Space key set and the real iframe URL.
- A real Space origin sending the token.

## Result

A dev-only entry that runs the app inside a Space-like shell without a registration.

## Next step

Continue with the [server reference](./server.md).
