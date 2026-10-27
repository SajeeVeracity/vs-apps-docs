---
title: Harness reference
---

Reference for `@vectoragents/vs-apps/harness` 0.2.4. This is a debugging aside. The [harness](../glossary.md#harness) is a local stand-in for [Space](../glossary.md#space). An app does not need it to ship or to follow the quickstart.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- React 18 or later with TypeScript.
- The app server running with `VA_DEV_ISSUER=true`, and serving the [dev routes](#dev-routes).
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

Load it from `harness.html`, a sibling of `index.html` whose script tag points at this file. Serve `harness.html` with your bundler, and open `/harness.html` on the client port.

## Dev routes

The harness calls two routes on the same origin as the page, under `/api`. Your bundler forwards `/api` to the app server, as in the [quickstart](../quickstart.md). The app server serves both routes only when `VA_DEV_ISSUER=true`.

### `GET /api/__dev/manifests`

Returns status `200` and a JSON array with one entry per app in the server. The harness builds its sidebar from the array.

| Field | Type | Meaning |
| --- | --- | --- |
| `appKey` | string | The `key` of the app definition. |
| `appId` | string | The fixed dev id, `DEV_APP_ID` from `@vectoragents/vs-apps`. |
| `manifest` | object | The [manifest](../glossary.md#manifest) that `buildManifests` returns for the app. |

### `POST /api/__dev/token`

Signs a token with the dev issuer. The body is JSON with a `kind` field. The harness sends `kind: "user"`. The other kinds are `provisioning`, `a2a`, `mcp`, `actions` and `events`.

A `user` request has these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | `"user"` | Selects the user token. |
| `sub` | string | The user id. |
| `appId` | string | The app id. |
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

### Example

`createDevIssuer` signs tokens and verifies them, so one object serves both. The handler also serves the issuer's public key set at `GET /api/__dev/jwks.json`. Call `handleDevRoute` first in your request handler. It returns `true` when it answered the request. It returns `false` for every other request, and always when `VA_DEV_ISSUER` is not `true`.

```ts title="src/server/dev-routes.ts"
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEV_APP_ID, type AppManifest } from '@vectoragents/vs-apps';
import { createDevIssuer, devTokenRequestSchema, readJsonBody } from '@vectoragents/vs-apps/server';

export const devIssuer = createDevIssuer();

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export async function handleDevRoute(
  req: IncomingMessage,
  res: ServerResponse,
  manifests: Record<string, AppManifest>,
): Promise<boolean> {
  if (process.env.VA_DEV_ISSUER !== 'true') return false;
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

Two more changes make the app accept the tokens. Pass `devIssuer` to `verifyAppUserToken` in place of the Space verifier. Return `/api/__dev/jwks.json` as `spaceJwksUrl` from `GET /api/client-config`.

## Result

A dev-only entry that runs the app inside a Space-like shell without a registration.

## Next step

Return to the [React reference](./react.md).
