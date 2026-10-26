---
title: Harness reference
---

Reference for `@vectoragents/vs-apps/harness` 0.2.4. This is a debugging aside. The [harness](../glossary.md#harness) is a local stand-in for [Space](../glossary.md#space). An app does not need it to ship or to follow the quickstart.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- React 19 with TypeScript.
- The app server running with `VA_DEV_ISSUER=true`.
- A Vite dev server with a second HTML entry for the harness.

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

Load it from `harness.html`, a sibling of `index.html` whose script tag points at this file. Open `/harness.html` on the Vite dev server.

## Result

A dev-only entry that runs the app inside a Space-like shell without a registration.

## Next step

Return to the [React reference](./react.md).
