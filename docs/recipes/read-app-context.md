---
title: Read the user and capabilities
---

Show who is signed in, branch on a capability and refresh the token. The example is the header of the SDR app.

## Goal

End with a header component that reads the verified user, the space and the capabilities from `useApp`.

## Prerequisites

- The app from the [quickstart](../quickstart.md), with `AppProvider` and `BootGate` mounted.
- Background: [`useApp`](../reference/react.md#useapp) and the [capability](../glossary.md#capability) term.

## Steps

### 1. Read the context

`useApp` returns the token claims and the [granted](../glossary.md#grant) capabilities. `claims` is `null` until the handshake completes, so mount the component under `BootGate`.

```tsx title="src/client/SdrHeader.tsx"
import { useApp } from '@vectoragents/vs-apps/react';

export function SdrHeader() {
  const { claims, hasCapability, requestRefresh } = useApp();

  return (
    <header>
      <p>
        {claims?.name ?? claims?.sub} in space {claims?.spaceId}
      </p>
      {hasCapability('icp:manage') ? <a href="/icp">ICP Library</a> : null}
      <button type="button" onClick={requestRefresh}>
        Refresh token
      </button>
    </header>
  );
}
```

### 2. Mount it under the gate

```tsx title="src/client/Shell.tsx"
import { BootGate } from '@vectoragents/vs-apps/react';
import type { ReactNode } from 'react';
import { SdrHeader } from './SdrHeader';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <BootGate fallback={<p>Connecting to Space.</p>}>
      <SdrHeader />
      {children}
    </BootGate>
  );
}
```

Use `requestRefresh` after a space manager changes a grant. Space sends a fresh token and `capabilities` updates.

## Result

The header shows the signed-in user and space, and the ICP link appears only for members with `icp:manage`. The check hides UI only, so enforce the capability on the server as in [gate a page and an endpoint](./gate-by-capability.md).

## Next step

Resolve user ids to names with [list members](./list-members.md).
