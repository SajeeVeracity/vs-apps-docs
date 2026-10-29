---
title: Filter navigation by capability
---

Advanced configuration of the app navigation: build your own [page](../glossary.md#page) list from the definition and show only the pages a member may open.

## Goal

End with a navigation component that lists the pages of the SDR definition that the verified user may open.

## Prerequisites

- The definition from [add a page and a capability](../recipes/add-page-and-capability.md).
- Background: [`appPages`](../reference/root.md#apppages), and the [quickstart](../quickstart.md).

## Steps

### 1. Declare a default page and pages with and without a capability

`defaultPageKey` must name a declared page. A page without `capability` is ungated.

```ts title="shared/src/index.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'sdr',
  name: 'SDR',
  version: '0.2.0',
  defaultPageKey: 'sdr-dashboard',
  pages: [
    { key: 'sdr-dashboard', label: 'Dashboard', path: '/dashboard' },
    { key: 'sdr-leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
    { key: 'sdr-icp', label: 'ICP Library', path: '/icp', capability: 'icp:manage' },
  ],
  capabilities: [
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICPs', effect: 'write' },
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

The navigation lists the dashboard for every member, and Leads and ICP Library only for members who hold their capabilities. The list shapes the UI only, so enforce each capability on the server.

## Next step

Gate each page body with [gate a page and an endpoint](../recipes/gate-by-capability.md).
