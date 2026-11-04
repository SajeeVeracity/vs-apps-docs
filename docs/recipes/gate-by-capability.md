---
title: Gate a page and an endpoint by capability
---

Hide a [page](../glossary.md#page) from members who lack a [capability](../glossary.md#capability) and refuse the same members on the server. The example gates the `leads` page of `hello-app` with `lead:manage`.

## Goal

End with one capability enforced twice: `RequireCapability` hides the `leads` page in the browser, and the server answers `403` to a token without it. One wrapper gives every gated page the same fallback.

## Prerequisites

- A GitHub package token in `GITHUB_PACKAGES_TOKEN`, as in [step 0 of the quickstart](../quickstart.md#0-set-up-access-to-the-package-registry). The install below reads it.
- The start folder `recipes/leads-app` from `main` of the public starter. It is `hello-app` with an ungated `leads` page. Clone the starter and work inside that folder.

```bash
git clone https://github.com/VectorAgents/vector-app-quickstart.git
cd vector-app-quickstart/recipes/leads-app
npm install
```

- A member who holds the capability and one who does not. A [space manager](../glossary.md#space-manager) [grants](../glossary.md#grant) capabilities in [Space](../glossary.md#space).
- Background: [`RequireCapability` on the client](../reference/react.md#requirecapability).

## Steps

Each snippet is a complete file. The start folder already declares the `lead:manage` and `icp:manage` capabilities and the `leads` page, and this recipe changes what is listed below.

### 1. Gate the pages in the definition

A page names its capability in `capability`. `defineApp` does not check that the name exists in `capabilities`, so keep the two keys identical.

In the start folder the `leads` page has no `capability`. Add it, and add an `icp` page gated by `icp:manage`, which step 5 uses as the second page. Replace the definition in `shared/src/index.ts`.

```ts title="shared/src/index.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const CAPABILITY = 'hello:view';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  pages: [
    { key: 'home', label: 'Home', path: '/', capability: CAPABILITY },
    { key: 'leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
    { key: 'icp', label: 'ICP', path: '/icp', capability: 'icp:manage' },
  ],
  capabilities: [
    { key: CAPABILITY, label: 'View hello', effect: 'read' },
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICP', effect: 'write' },
  ],
});
```

The `CAPABILITY` export stays, because `server/src/main.ts` and `HelloPage.tsx` use it.

### 2. Gate the page in the browser

`RequireCapability` renders its children only when the token holds the capability. A function `fallback` receives the missing capability name. Replace `client/src/LeadsPage.tsx`.

```tsx title="client/src/LeadsPage.tsx"
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function LeadsPage() {
  return (
    <RequireCapability
      capability="lead:manage"
      fallback={(capability) => <p>Ask a space manager to grant {capability}.</p>}
    >
      <main>
        <h1>Leads</h1>
        <p>No leads yet.</p>
      </main>
    </RequireCapability>
  );
}
```

This check shapes the UI only. A member can still call the endpoint directly.

### 3. Enforce the capability on the server

`requireCapability` in `server/src/auth.ts` verifies the user token. It throws `AppAuthError` with status `403` when the claims lack the named capability. Add the leads handler in a new file. It receives the verified claims.

```ts title="server/src/leads.ts"
import type { UserTokenClaims } from '@vectoragents/vs-apps';

export function listLeads(claims: UserTokenClaims) {
  return { spaceId: claims.spaceId, leads: [] };
}
```

In `server/src/main.ts`, import `listLeads` and add this entry to the `routes` map: `'/api/leads': async (req) => listLeads(await requireCapability(req, 'lead:manage')),`. The existing `catch` block turns the `403` into the response. For the decorator form, see the [framework adapter page](../nest/nest-adapter.md).

### 4. Check both gates

Run `npm run dev` and open `http://localhost:5173/harness.html`. Choose the Leads page in the sidebar.

In the dev panel, remove `lead:manage` from the capability set. The page shows the fallback text. Add `lead:manage` back, and the page shows the heading.

For the server, mint a development token without `lead:manage` through the [harness token route](../reference/harness.md). Call `GET /api/leads` with it. The server answers `403` with `Missing capability: lead:manage`. A token that holds the capability gets `200`.

### 5. Share one fallback across pages

Each page that repeats `fallback` can drift from the others. Wrap `RequireCapability` once, and every gated page shows the same message.

```tsx title="client/src/GatedPage.tsx"
import type { ReactNode } from 'react';
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function GatedPage({ capability, children }: { capability: string; children: ReactNode }) {
  return (
    <RequireCapability
      capability={capability}
      fallback={(missing) => <p>Ask a space manager to grant {missing}.</p>}
    >
      {children}
    </RequireCapability>
  );
}
```

In `client/src/LeadsPage.tsx`, replace the `RequireCapability` element with `<GatedPage capability="lead:manage">` and drop the import. Keep the `main` element inside it. The `icp` page uses the same wrapper with its own capability.

```tsx title="client/src/IcpPage.tsx"
import { GatedPage } from './GatedPage';

export function IcpPage() {
  return (
    <GatedPage capability="icp:manage">
      <main>
        <h1>ICP</h1>
      </main>
    </GatedPage>
  );
}
```

In `client/src/App.tsx`, render `<IcpPage />` when `window.location.pathname` is `/icp`, the way the file does for `/leads`. Both pages now show one fallback. To change the message, edit `GatedPage.tsx`.

## Result

The `leads` and `icp` pages render only for members with `lead:manage` and `icp:manage`. `GET /api/leads` refuses every other token. Both pages share one fallback in `GatedPage`.

## Next step

Read the user and capabilities in other components with [read the app context](./read-app-context.md).
