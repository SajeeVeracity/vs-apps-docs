---
title: Filter navigation by capability
start: leads-app
---

<!-- flavour react -->
Advanced configuration of the app navigation: build your own [page](../glossary.md#page) list from the definition and show only the pages a member may open.

## Goal

End with a navigation component that lists the pages of the `hello-app` definition that the verified user may open.

## Prerequisites

- The app from [`expose-agent-actions`](../recipes/expose-agent-actions.md), which starts from the `leads-app` start of the starter, scaffolded with `npm create @vectoragents/app leads-app -- --client react --server node --start leads-app` (`--server nest` for a Nest.js server). Its definition declares the `leads` page and the `lead:manage` and `icp:manage` capabilities.
- Background: [`appPages`](../reference/root.md#apppages), and the [quickstart](../quickstart.md).

## Steps

### 1. Declare a default page and gate each page

`defaultPageKey` must name a declared page. A page without `capability` is ungated. Leave `home` ungated, gate `leads` and `icp`, and replace the definition in `shared/src/index.ts`.

`CAPABILITY` stays an export, because the starter server and `HelloPage.tsx` use it. It now holds `lead:manage`.

```ts title="shared/src/index.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const CAPABILITY = 'lead:manage';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  defaultPageKey: 'home',
  pages: [
    { key: 'home', label: 'Home', path: '/' },
    { key: 'leads', label: 'Leads', path: '/leads', capability: CAPABILITY },
    { key: 'icp', label: 'ICP', path: '/icp', capability: 'icp:manage' },
  ],
  capabilities: [
    { key: CAPABILITY, label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICP', effect: 'write' },
  ],
});
```

### 2. Filter the pages

`appPages` returns the pages of the definition whose `key` equals the `appKey` claim. It does not filter by capability, so filter with `hasCapability`.

```tsx title="client/src/AppNav.tsx"
import { appPages } from '@vectoragents/vs-apps';
import { useApp } from '@vectoragents/vs-apps/react';
import { definition } from '../../shared/src/index';

export function AppNav() {
  const { claims, hasCapability } = useApp();
  const pages = appPages([definition], claims?.appKey).filter(
    (page) => !page.capability || hasCapability(page.capability),
  );

  return (
    <nav>
      {pages.map((page) => (
        <a key={page.key} href={page.path}>
          {page.label}
        </a>
      ))}
    </nav>
  );
}
```

Mount `AppNav` under `BootGate`. Before the handshake `claims` is `null` and the list is empty.

## Result

The navigation lists Home for every member, and Leads and ICP only for members who hold their capabilities. The list shapes the UI only, so enforce each capability on the server.

## Next step

Gate each page body with [gate a page and an endpoint](../recipes/gate-by-capability.md).
<!-- /flavour -->
