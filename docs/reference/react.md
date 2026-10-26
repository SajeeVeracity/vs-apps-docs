---
title: React reference
---

Reference for `@vectoragents/vs-apps/react` 0.2.4. The subpath holds the client runtime of an [app](../glossary.md#app): the provider that completes the handshake with [Space](../glossary.md#space), the hook that reads the result, and two gates.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- React 19 with TypeScript.
- An [app definition](../glossary.md#app-definition) that declares the [capability](../glossary.md#capability) the examples check, `leads:read`.

## `AppProvider`

Owns the verified user token and exposes it to the tree. Mount it once, above every component that calls `useApp`.

### Signature

```typescript
function AppProvider(props: AppProviderProps): ReactElement;

interface AppProviderProps {
  config: AppClientConfig | Promise<AppClientConfig>;
  navigate: (path: string) => void;
  onToken?: (token: string | null) => void;
  onTheme?: (theme: 'light' | 'dark') => void;
  children?: ReactNode;
}
```

| Prop | Meaning |
| --- | --- |
| `config` | Boot config, or a promise of it. `loadAppClientConfig()` from `@vectoragents/vs-apps/client` returns it. |
| `navigate` | Called when Space asks the app to open a path. |
| `onToken` | Called with each verified token, and with `null` on unmount. Use it to attach the token to your own API client. |
| `onTheme` | Called with `'light'` or `'dark'` when Space changes theme. |

### Behaviour

- Starts the iframe bridge to the parent window once the config resolves. The bridge accepts messages only from `allowedParentOrigin`.
- Verifies each token Space sends against its signing keys. A token that fails verification is logged to the console and ignored, so `useApp().claims` stays `null`.
- Opens the user directory on the first verified token, when the config sets `spaceApiUrl`.
- Reports the document height to Space through a `ResizeObserver`.
- Registers [agent actions](../glossary.md#agent-action) by wrapping the tree in `AgentActionRegistryProvider`. Do not add a second one.
- A config promise that rejects is logged to the console. No token ever arrives, so a `BootGate` stays on its fallback.

### Example

```tsx title="src/Root.tsx"
import { loadAppClientConfig } from '@vectoragents/vs-apps/client';
import { AppProvider } from '@vectoragents/vs-apps/react';
import type { ReactNode } from 'react';

const config = loadAppClientConfig();

function navigate(path: string) {
  window.history.pushState(null, '', path);
}

export function Root({ children }: { children: ReactNode }) {
  return (
    <AppProvider config={config} navigate={navigate}>
      {children}
    </AppProvider>
  );
}
```

Create `config` once at module scope. A new promise on every render restarts the bridge.

## `useApp`

Reads the verified user context.

### Signature

```typescript
function useApp(): AppContextValue;

interface AppContextValue {
  claims: UserTokenClaims | null;
  capabilities: ReadonlySet<string>;
  hasCapability: (capability: string) => boolean;
  requestRefresh: () => void;
  directory: UserDirectory | null;
}
```

| Field | Meaning |
| --- | --- |
| `claims` | The verified token claims, or `null` before the handshake completes. Includes `sub` (user id), `spaceId`, `organizationId`, `appKey` and `capabilities`. |
| `capabilities` | The capabilities [granted](../glossary.md#grant) to the current user. Empty before the handshake. |
| `hasCapability` | `true` when `capabilities` holds the given name. |
| `requestRefresh` | Asks Space to send a fresh token. A no-op before the bridge starts. |
| `directory` | The user directory, or `null` before the first token or when the config has no `spaceApiUrl`. |

### Behaviour

- Throws `useApp must be used within an AppProvider` outside the provider.
- Capability checks run in the browser and only shape the UI. The server must enforce the same capability.
- The value changes when a new token or directory arrives, so components that read it re-render on a token refresh.

### Example

```tsx title="src/Greeting.tsx"
import { useApp } from '@vectoragents/vs-apps/react';

export function Greeting() {
  const { claims, hasCapability, requestRefresh } = useApp();

  return (
    <section>
      <p>Signed in as {claims?.name ?? claims?.sub}.</p>
      {hasCapability('leads:read') ? <p>You can read leads.</p> : <p>You cannot read leads.</p>}
      <button type="button" onClick={requestRefresh}>
        Refresh token
      </button>
    </section>
  );
}
```

## `useUsers`

Resolves user ids to names and avatars through the space directory.

### Signature

```typescript
function useUsers(ids: readonly string[]): UseUsersResult;

interface UseUsersResult {
  users: ReadonlyMap<string, DirectoryUser>;
  loading: boolean;
}

interface DirectoryUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  deleted: boolean;
}
```

### Behaviour

- Returns `loading: true` and an empty map while the lookup runs.
- Without a directory, returns a placeholder map at once with `loading: false`. Each `displayName` is the id itself.
- Calls made in the same tick share one request. A repeat within a minute is served from the directory cache.
- A failed lookup is retried up to three times with back-off. After the last failure the map is empty, so read each entry with a fallback to the id.
- A deleted user stays in the map with `deleted: true`.
- Pass a stable array, for example a module constant or a memoised value. The hook compares the set of ids, so the order does not matter.

### Example

```tsx title="src/Owners.tsx"
import { useUsers } from '@vectoragents/vs-apps/react';

export function Owners({ ownerIds }: { ownerIds: readonly string[] }) {
  const { users, loading } = useUsers(ownerIds);

  if (loading) return <p>Loading owners.</p>;

  return (
    <ul>
      {ownerIds.map((id) => {
        const user = users.get(id);
        return (
          <li key={id}>
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" width={20} height={20} /> : null}
            {user?.displayName ?? id}
            {user?.deleted ? ' (removed)' : ''}
          </li>
        );
      })}
    </ul>
  );
}
```

## `BootGate`

Holds the tree back until the handshake with Space completes.

### Signature

```typescript
function BootGate(props: {
  fallback?: ReactNode;
  children?: ReactNode;
}): ReactElement | null;
```

### Behaviour

- Renders `fallback` while `useApp().claims` is `null`, and `children` after the first verified token.
- Renders nothing when `fallback` is omitted and the handshake is pending.
- Needs an `AppProvider` above it.
- Place it above every page. Capability checks below it then read a settled `capabilities` set.

### Example

```tsx title="src/Shell.tsx"
import { BootGate } from '@vectoragents/vs-apps/react';
import type { ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
  return <BootGate fallback={<p>Connecting to Space.</p>}>{children}</BootGate>;
}
```

## `RequireCapability`

Renders its children only when the current user holds a capability.

### Signature

```typescript
function RequireCapability(props: {
  capability: string;
  fallback?: ReactNode | ((capability: string) => ReactNode);
  children?: ReactNode;
}): ReactElement | null;
```

### Behaviour

- Renders `children` when `useApp().hasCapability(capability)` is `true`.
- Otherwise renders `fallback`. A function `fallback` receives the missing capability name.
- Renders nothing when the check fails and `fallback` is omitted.
- Gives a UI gate only. The server must enforce the same capability.
- Wrap it in a `BootGate`. Before the handshake every check fails.

### Example

```tsx title="src/LeadsPage.tsx"
import { RequireCapability } from '@vectoragents/vs-apps/react';

export function LeadsPage() {
  return (
    <RequireCapability
      capability="leads:read"
      fallback={(capability) => <p>Ask a space manager to grant {capability}.</p>}
    >
      <h1>Leads</h1>
    </RequireCapability>
  );
}
```

## Result

A root component that mounts `AppProvider`, waits on `BootGate`, reads the user with `useApp` and `useUsers`, and gates content with `RequireCapability`.

## Next step

Continue with the reference for the other client subpaths.
