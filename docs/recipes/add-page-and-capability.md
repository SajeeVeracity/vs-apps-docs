---
title: Add a page and a capability
---

Grow the SDR definition by one [page](../glossary.md#page) and the [capability](../glossary.md#capability) that gates it, then see both in a [Space](../glossary.md#space).

## Goal

End with an ICP Library page in the Space navigation, gated by a new `icp:manage` capability.

## Prerequisites

- The app from the [quickstart](../quickstart.md), registered in a Space ([Part 2](../quickstart.md#part-2-add-the-app-to-a-space)).
- Background: the [app definition](../app-definition.md) page, the [`RequireCapability` reference](../reference/react.md#requirecapability).

## Steps

### 1. Extend the definition

Add one entry to `pages` and one to `capabilities`. The page `capability` must match the capability `key` exactly, because `defineApp` does not check it. A capability key has the form `<group>:<action>`, and a page `path` starts with `/`.

```ts title="shared/src/index.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'sdr',
  name: 'SDR',
  version: '0.2.0',
  pages: [
    { key: 'sdr-leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
    { key: 'sdr-icp', label: 'ICP Library', path: '/icp', capability: 'icp:manage' },
  ],
  capabilities: [
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICPs', effect: 'write' },
  ],
});
```

### 2. Write the page

Gate the content with the same capability, so the browser matches the definition.

```tsx title="client/src/IcpPage.tsx"
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function IcpPage() {
  return (
    <RequireCapability capability="icp:manage" fallback={<p>You do not hold icp:manage.</p>}>
      <h1>ICP Library</h1>
    </RequireCapability>
  );
}
```

Enforce `icp:manage` on the endpoints the page calls, as in [gate a page and an endpoint](./gate-by-capability.md).

### 3. Let Space pull the manifest

Restart the server. A manifest change waits as a pending review. Ask Vector to apply it.

### 4. Grant the capability

A space manager grants `icp:manage` to a member. The member refreshes the page, and ICP Library appears in the navigation.

## Result

The definition declares two pages and two capabilities, and the Space shows the new page to members who hold `icp:manage`.

## Next step

List the pages a member may open in your own navigation with [filter navigation by capability](../guides/filter-navigation-by-capability.md).
