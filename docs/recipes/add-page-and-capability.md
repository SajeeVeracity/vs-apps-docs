---
title: Add a page and a capability
---

<!-- flavour react -->
Grow the `hello-app` definition by two [pages](../glossary.md#page) and the [capabilities](../glossary.md#capability) that gate them, link the pages without a reload, then see them in a [Space](../glossary.md#space).

## Goal

End with the `leads` and `icp` pages in the Space navigation, gated by the new `lead:manage` and `icp:manage` capabilities. A link inside the app changes the page without reloading the iframe.

## Prerequisites

- The app from the [quickstart](../quickstart.md), registered in a Space (Part 2) and run with `npm run dev:space`.
- `SPACE_API_URL` in `.env`, set to the Space API origin followed by `/api`, for example `https://space-api.example.com/api`. Step 4 uses it.
- Background: the [app definition](../app-definition.md) page, the [`RequireCapability` reference](../reference/react.md#requirecapability).

## Steps

Each snippet is a complete file. The starter has one page, `home`, and no router. Each step lists what it changes in the starter.

### 1. Extend the definition

The starter file holds the `home` page and the `hello:view` capability. This step adds the `leads` and `icp` pages and their capabilities, and moves the pages into one exported array. Step 3 reads the same array for the path type.

A page `capability` must match a capability `key` exactly, because `defineApp` does not check it. A capability key has the form `<group>:<action>`, and a page `path` starts with `/`. `as const satisfies` keeps each path as a literal type, and TypeScript still checks each entry as an `AppPageDef`. `slice()` copies the read-only array into the mutable one that `defineApp` takes.

```ts title="shared/src/index.ts"
import { defineApp, type AppPageDef } from '@vectoragents/vs-apps';

export const CAPABILITY = 'hello:view';

export const pages = [
  { key: 'home', label: 'Home', path: '/', capability: CAPABILITY },
  { key: 'leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
  { key: 'icp', label: 'ICP Library', path: '/icp', capability: 'icp:manage' },
] as const satisfies readonly AppPageDef[];

export type PagePath = (typeof pages)[number]['path'];

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.2.0',
  pages: pages.slice(),
  capabilities: [
    { key: CAPABILITY, label: 'View hello', effect: 'read' },
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICPs', effect: 'write' },
  ],
});
```

### 2. Write the pages

Gate each page with the same capability as its definition entry, so the browser matches the definition. The starter has neither file.

```tsx title="client/src/LeadsPage.tsx"
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function LeadsPage() {
  return (
    <RequireCapability capability="lead:manage" fallback={<p>You do not hold lead:manage.</p>}>
      <main>
        <h1>Leads</h1>
        <p>No leads yet.</p>
      </main>
    </RequireCapability>
  );
}
```

```tsx title="client/src/IcpPage.tsx"
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function IcpPage() {
  return (
    <RequireCapability capability="icp:manage" fallback={<p>You do not hold icp:manage.</p>}>
      <main>
        <h1>ICP Library</h1>
      </main>
    </RequireCapability>
  );
}
```

Enforce `lead:manage` and `icp:manage` on the endpoints the pages call, as in [gate a page and an endpoint](./gate-by-capability.md).

### 3. Link between pages without a reload

A member picks a page in the Space navigation, and Space asks the app to open its path. `AppProvider` then calls its `navigate` prop. The starter's `navigate` only calls `history.replaceState`. It changes the address and leaves the screen as it is, because the starter has no router.

A plain `<a href>` inside the app does not help. It loads the document again, and the iframe repeats the token handshake with Space.

Add a small router. `navigate` pushes the path and tells the subscribers, and `usePath` re-renders on each change and on the back button. A router library works the same way: pass its navigate function as the `navigate` prop.

```ts title="client/src/router.ts"
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function navigate(path: string): void {
  window.history.pushState(null, '', path);
  for (const listener of listeners) listener();
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}
```

`appPages` returns the pages of the definition, and the filter keeps the pages the member may open, as in [filter navigation by capability](../guides/filter-navigation-by-capability.md). The link calls `navigate` and cancels the default load.

```tsx title="client/src/Nav.tsx"
import { definition } from '@hello-app/shared';
import { appPages } from '@vectoragents/vs-apps';
import { useApp } from '@vectoragents/vs-apps/react';
import { navigate } from './router';

export function Nav() {
  const { claims, hasCapability } = useApp();
  const pages = appPages([definition], claims?.appKey).filter(
    (page) => !page.capability || hasCapability(page.capability),
  );

  return (
    <nav>
      {pages.map((page) => (
        <a
          key={page.key}
          href={page.path}
          onClick={(event) => {
            event.preventDefault();
            navigate(page.path);
          }}
        >
          {page.label}
        </a>
      ))}
    </nav>
  );
}
```

`routes` is typed with `PagePath`, so a page added to `pages` without a component fails to compile. The `home` prop takes the starter `HelloPage`.

```tsx title="client/src/CurrentPage.tsx"
import type { PagePath } from '@hello-app/shared';
import type { ReactElement } from 'react';
import { IcpPage } from './IcpPage';
import { LeadsPage } from './LeadsPage';
import { usePath } from './router';

export function CurrentPage({ home }: { home: ReactElement }) {
  const routes: Record<PagePath, ReactElement> = {
    '/': home,
    '/leads': <LeadsPage />,
    '/icp': <IcpPage />,
  };
  const path = usePath();
  return path in routes ? routes[path as PagePath] : <p>Page not found.</p>;
}
```

Change `client/src/App.tsx` in three places. Import `Nav`, `CurrentPage` and `navigate`. Replace the `navigate` prop of `AppProvider` with `navigate={navigate}`. Replace `<HelloPage />` inside `BootGate` with `<Nav />` and `<CurrentPage home={<HelloPage />} />`.

Run `npm run dev` and open `http://localhost:5173/harness.html`. Click Leads, then ICP Library. The page changes, and the Network panel of your browser developer tools shows no new document request. The harness dev panel opens a page through the same `navigate` prop.

### 4. Let Space read the manifest

The server must tell Space that the manifest changed. Stop `npm run dev:space` and start it again. When `SPACE_API_URL` is set, the starter calls `pingSpaceManifests` at start, and Space reads the new manifest. `npm run dev` clears `SPACE_API_URL`, so the harness never tells Space.

A manifest change waits as a pending review until Vector applies it. If Space shows no change after the restart, ask Vector to select **Check for updates** on your [app registration](../glossary.md#app-registration). Space then reads the manifest again.

### 5. Grant the capabilities

A [space manager](../glossary.md#space-manager) grants `lead:manage` and `icp:manage` to a member. The member refreshes the page, and both pages appear in the navigation.

## Result

The definition declares three pages and three capabilities. The Space shows `leads` and `icp` to members who hold `lead:manage` and `icp:manage`, and a link inside the app changes the page without a reload.

## Next step

Check the same capabilities on the server and share one fallback across pages with [gate a page and an endpoint](./gate-by-capability.md).
<!-- /flavour -->
