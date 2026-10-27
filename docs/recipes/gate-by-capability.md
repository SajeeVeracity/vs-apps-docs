---
title: Gate a page and an endpoint by capability
---

Hide a [page](../glossary.md#page) from members who lack a [capability](../glossary.md#capability) and refuse the same members on the server. The example gates the SDR leads page with `lead:manage`.

## Goal

End with one capability enforced twice: `RequireCapability` hides the leads page in the browser, and the server answers `403` to a token without it.

## Prerequisites

- The app from the [quickstart](../quickstart.md): its `node:http` server, and a client with `AppProvider` and `BootGate` mounted.
- A member who holds the capability and one who does not. A space manager [grants](../glossary.md#grant) capabilities in [Space](../glossary.md#space).
- Background: [`RequireCapability` on the client](../reference/react.md#requirecapability).

## Steps

### 1. Declare the capability and the page

A page names its capability in `capability`. `defineApp` does not check that the name exists in `capabilities`, so keep the two keys identical.

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'sdr',
  name: 'SDR',
  version: '0.1.0',
  pages: [{ key: 'sdr-leads', label: 'Leads', path: '/leads', capability: 'lead:manage' }],
  capabilities: [{ key: 'lead:manage', label: 'Manage Leads', effect: 'write' }],
});
```

### 2. Gate the page in the browser

`RequireCapability` renders its children only when the token holds the capability. A function `fallback` receives the missing capability name.

```tsx title="src/client/LeadsPage.tsx"
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function LeadsPage() {
  return (
    <RequireCapability
      capability="lead:manage"
      fallback={(capability) => <p>Ask a space manager to grant {capability}.</p>}
    >
      <h1>Leads</h1>
    </RequireCapability>
  );
}
```

This check shapes the UI only. A member can still call the endpoint directly.

### 3. Enforce the capability on the server

Extend the auth module of the `node:http` server from the [quickstart](../quickstart.md). `verifyAppUserToken` returns the verified claims. `assertCapability` throws `AppAuthError` with status `403` when the claims lack `lead:manage`. The file below is the quickstart module plus `requireLeadManager`.

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

export async function requireHelloUser(req: IncomingMessage) {
  const claims = await verifyAppUserToken(verifier, extractBearer(req.headers));
  assertCapability(claims, 'hello:view');
  return claims;
}

export async function requireLeadManager(req: IncomingMessage) {
  const claims = await verifyAppUserToken(verifier, extractBearer(req.headers));
  assertCapability(claims, 'lead:manage');
  return claims;
}

export function requireProvisioning(req: IncomingMessage) {
  return verifyProvisioningToken(verifier, extractBearer(req.headers));
}
```

Then route `GET /api/leads` in `src/server/main.ts`. Import `requireLeadManager` from `./auth` and add this block before the `404` response:

```text
if (pathname === '/api/leads') {
  const claims = await requireLeadManager(req);
  return send(res, 200, { spaceId: claims.spaceId, leads: [] });
}
```

The existing `catch` block turns the `403` into the response. `requireLeadManager` takes a plain Node request object, so the same checks work from any other HTTP layer. For the decorator form, see the [framework adapter page](./nest-adapter.md).

### 4. Check both gates

Open the app in a Space as a member without `lead:manage`. The page shows the fallback text. Grant the capability, reload, and the page shows the heading. Call `GET /api/leads` with the token of the member who lacks the capability. The server answers `403` with `Missing capability: lead:manage`.

## Result

The leads page renders only for members with `lead:manage`, and `GET /api/leads` refuses every other token.

## Next step

Read the user and capabilities in other components with [read the app context](./read-app-context.md), or add a second gated page with [add a page and a capability](./add-page-and-capability.md).
