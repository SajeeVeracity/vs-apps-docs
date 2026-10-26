---
title: Gate a page and an endpoint by capability
---

Hide a page from members who lack a [capability](../glossary.md#capability) and refuse the same members on the server. The example gates the SDR leads page with `lead:manage`.

## Goal

End with one capability enforced twice: `RequireCapability` hides the leads page in the browser, and the server guard answers `403` to a token without it.

## Prerequisites

- The app from the [quickstart](../quickstart.md), with `AppProvider` and `BootGate` mounted.
- A member who holds the capability and one who does not. A space manager [grants](../glossary.md#grant) capabilities in Space.
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

The platform module from the quickstart verifies the token. `RequireCapability` from `@vectoragents/vs-apps/nest` then refuses a token without `lead:manage`.

```ts title="src/server/leads.controller.ts"
import { Controller, Get } from '@nestjs/common';
import type { UserTokenClaims } from '@vectoragents/vs-apps';
import { CurrentUser, RequireCapability } from '@vectoragents/vs-apps/nest';

@Controller('leads')
export class LeadsController {
  @Get()
  @RequireCapability('lead:manage')
  list(@CurrentUser() user: UserTokenClaims) {
    return { spaceId: user.spaceId, leads: [] };
  }
}
```

Add `LeadsController` to the `controllers` array of the module from the quickstart.

### 4. Check both gates

Open the app in a Space as a member without `lead:manage`. The page shows the fallback text. Grant the capability, reload, and the page shows the heading.

## Result

The leads page renders only for members with `lead:manage`, and `GET /api/leads` refuses every other token.

## Next step

Read the user and capabilities in other components with [read the app context](./read-app-context.md), or add a second gated page with [add a page and a capability](./add-page-and-capability.md).
