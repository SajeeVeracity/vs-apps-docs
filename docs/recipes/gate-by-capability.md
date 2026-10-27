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

A page names its capability in `capability`. `defineApp` does not check that the name exists in `capabilities`, so keep the two keys identical. The definition below is the quickstart definition plus the leads page, so the quickstart server serves it unchanged.

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  pages: [
    { key: 'home', label: 'Home', path: '/', capability: 'hello:view' },
    { key: 'leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
  ],
  capabilities: [
    { key: 'hello:view', label: 'View hello', effect: 'read' },
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
  ],
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

`requireCapability` in the auth module of the [quickstart](../quickstart.md) verifies the user token. It throws `AppAuthError` with status `403` when the claims lack the named capability. The leads handler receives the verified claims.

```ts title="src/server/leads.ts"
import type { UserTokenClaims } from '@vectoragents/vs-apps';

export function listLeads(claims: UserTokenClaims) {
  return { spaceId: claims.spaceId, leads: [] };
}
```

In `src/server/main.ts`, import `listLeads` and add this line before the `404` response: `if (pathname === '/api/leads') return send(res, 200, listLeads(await requireCapability(req, 'lead:manage')));`. The existing `catch` block turns the `403` into the response. For the decorator form, see the [framework adapter page](./nest-adapter.md).

### 4. Check both gates

Open the app in a Space as a member without `lead:manage`. The page shows the fallback text. Grant the capability, reload, and the page shows the heading. Call `GET /api/leads` with the token of the member who lacks the capability. The server answers `403` with `Missing capability: lead:manage`.

## Result

The leads page renders only for members with `lead:manage`, and `GET /api/leads` refuses every other token.

## Next step

Read the user and capabilities in other components with [read the app context](./read-app-context.md), or add a second gated page with [add a page and a capability](./add-page-and-capability.md).
