---
title: Harness reference
---

Reference for `@vectoragents/vs-apps/harness` 0.2.4. The [harness](../glossary.md#harness) is a local stand-in for [Space](../glossary.md#space). The starter includes the harness already wired. This page is the manual-wiring guide for an app that is not built from the starter. An app does not need the harness to ship.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- React 18 or later with TypeScript.
- The app server running with `VA_DEV_ISSUER=true`, and serving the [dev routes](#dev-routes). See [Turn the harness on and off](#turn-the-harness-on-and-off).
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
import { VectorAppsHarness } from '@vectoragents/vs-apps/harness';
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

The app server serves three routes on the same origin as the page, under `/api`. Your bundler forwards `/api` to the app server. Each route returns `404` while `VA_DEV_ISSUER` is not `true`. The harness calls the first two. The third publishes the key set that verifies the dev tokens.

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

Returns status `200` and the public key set of the dev issuer, the value of `devIssuer.jwks()` in the example below. The set verifies the tokens that `POST /api/__dev/token` signs.

### Example

`createDevIssuer` signs tokens and verifies them, so one object serves both. It reads or creates the key file `vs-apps-dev-issuer.pem` in the OS temp directory, which every process on the machine shares, so the example creates it only when `VA_DEV_ISSUER` is `true`. Call `handleDevRoute` first in your request handler. It returns `true` when it answered the request. It returns `false` for every other request, and always when the dev issuer does not exist.

```ts title="server/src/dev-routes.ts"
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEV_APP_ID, type AppManifest } from '@vectoragents/vs-apps';
import { createDevIssuer, devTokenRequestSchema, readJsonBody } from '@vectoragents/vs-apps/server';

export const devIssuer = process.env.VA_DEV_ISSUER === 'true' ? createDevIssuer() : undefined;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export async function handleDevRoute(
  req: IncomingMessage,
  res: ServerResponse,
  manifests: Record<string, AppManifest>,
): Promise<boolean> {
  if (!devIssuer) return false;
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && pathname === '/api/__dev/manifests') {
    send(
      res,
      200,
      Object.values(manifests).map((manifest) => ({ appKey: manifest.appKey, appId: DEV_APP_ID, manifest })),
    );
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/__dev/jwks.json') {
    send(res, 200, devIssuer.jwks());
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/__dev/token') {
    const parsed = devTokenRequestSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      send(res, 400, { error: `Invalid token request: ${parsed.error.message}` });
      return true;
    }
    send(res, 200, await devIssuer.sign(parsed.data));
    return true;
  }
  return false;
}
```

## Accept dev tokens

Call `handleDevRoute` first inside the `try` block of your request handler, before any route of your own: `if (await handleDevRoute(req, res, manifests)) return;`. Then make three changes so the app accepts the tokens that the dev issuer signs. Without all three, the iframe stays on "Waiting for Space.".

1. **Allow the harness origin.** Set `ALLOWED_PARENT_ORIGIN` to the harness origin, the origin that your bundler serves `harness.html` from, for example `http://localhost:5173`. The harness page is the parent of the iframe, so the client accepts messages from this origin only. A Space origin here makes the `postMessage` call from the iframe fail.
2. **Return the dev key set URL.** Make `GET /api/client-config` return `/api/__dev/jwks.json` as `spaceJwksUrl`. The browser fetches that key set to verify the token. Otherwise the console logs `token verification failed: Failed to fetch`.
3. **Verify with the dev issuer.** In `server/src/auth.ts`, pass `devIssuer` to `verifyAppUserToken` in place of the Space verifier. Otherwise `GET /api/hello` fails with status `401`.

```ts title="server/src/auth.ts"
import { createSpaceTokenVerifier } from '@vectoragents/vs-apps/server';
import { devIssuer } from './dev-routes';

export const verifier = devIssuer ?? createSpaceTokenVerifier({ jwksUrl: process.env.SPACE_JWKS_URL ?? '' });
```

When the page works, the harness card shows the user, the space and the capabilities of the token, and a request to your server succeeds.

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

Return to the [React reference](./react.md).
