---
title: Client reference
---

Reference for `@vectoragents/vs-apps/client` 0.2.4. The subpath holds the browser boot config and the user directory types. It also exports the iframe bridge and token verifier that [`AppProvider`](./react.md#appprovider) drives. An app imports four symbols from it.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- A server route that returns the client config, `GET /api/client-config`, when the config is not baked into the bundle.

## `loadAppClientConfig`

Resolves the boot config for the iframe bridge and the token verifier.

### Signature

```typescript
function loadAppClientConfig(options?: {
  baked?: Partial<AppClientConfig>;
  url?: string;
}): Promise<AppClientConfig>;
```

| Option | Meaning |
| --- | --- |
| `baked` | Config known at build time. Used when `baked.allowedParentOrigin` is set. |
| `url` | Where to fetch the config otherwise. Defaults to `/api/client-config`. |

### Behaviour

- Returns the `baked` values without a network call when `baked.allowedParentOrigin` is set. Only the four config fields are copied, and empty optional fields are dropped.
- Otherwise fetches `url` and returns the JSON body.
- Rejects with `client config fetch failed: <status>` on a non-2xx response.
- Rejects with `client config: ALLOWED_PARENT_ORIGIN is not set on the server` when the body has no `allowedParentOrigin`.
- Starts the fetch on every call. Create the promise once and share it.
- Importing the module must not trigger the fetch. Build tooling that loads route modules outside a browser has no origin to fetch from, so call it lazily.

### Example

```ts title="src/client-config.ts"
import { loadAppClientConfig, type AppClientConfig } from '@vectoragents/vs-apps/client';

let configPromise: Promise<AppClientConfig> | null = null;

export function getClientConfig(): Promise<AppClientConfig> {
  configPromise ??= loadAppClientConfig();
  return configPromise;
}
```

Pass the result to `AppProvider`'s `config` prop.

## `AppClientConfig`

The boot config shape.

### Signature

```typescript
interface AppClientConfig {
  allowedParentOrigin: string;
  spaceJwksUrl?: string;
  tokenIssuer?: string;
  spaceApiUrl?: string;
}
```

| Field | Meaning |
| --- | --- |
| `allowedParentOrigin` | The one origin the iframe bridge accepts messages from. |
| `spaceJwksUrl` | Where the browser fetches [Space](../glossary.md#space) signing keys to verify a token. |
| `tokenIssuer` | The expected `iss` claim of a token. |
| `spaceApiUrl` | The Space API base. Setting it enables the user directory. |

### Behaviour

- Only `allowedParentOrigin` is required. `loadAppClientConfig` rejects without it.
- The server env is the source of the values in every environment, so the same bundle runs in the [harness](./harness.md) and in Space.
- Without `spaceApiUrl`, `useApp().directory` is `null` and `useUsers` returns placeholder names.

### Example

```ts title="src/static-config.ts"
import { loadAppClientConfig, type AppClientConfig } from '@vectoragents/vs-apps/client';

const baked: AppClientConfig = {
  allowedParentOrigin: 'https://space.example.com',
  spaceApiUrl: 'https://space.example.com/api',
};

export const config = loadAppClientConfig({ baked });
```

## `DirectoryUser`

One user in the space directory.

### Signature

```typescript
interface DirectoryUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  deleted: boolean;
}
```

### Behaviour

- `useUsers` returns these in a map keyed by `id`.
- `directory.search(q, take?)` returns them as an array.
- A deleted user keeps its entry with `deleted: true`.
- `avatarUrl` is `null` when the user has none.

### Example

```tsx title="src/MemberPicker.tsx"
import type { DirectoryUser } from '@vectoragents/vs-apps/client';
import { useApp } from '@vectoragents/vs-apps/react';
import { useState } from 'react';

export function MemberPicker({ onPick }: { onPick: (user: DirectoryUser) => void }) {
  const { directory } = useApp();
  const [matches, setMatches] = useState<DirectoryUser[]>([]);

  if (!directory) return <p>The directory is not available.</p>;

  return (
    <div>
      <input
        type="search"
        placeholder="Find a member"
        onChange={async (event) => setMatches(await directory.search(event.target.value, 5))}
      />
      <ul>
        {matches.map((user) => (
          <li key={user.id}>
            <button type="button" onClick={() => onPick(user)}>
              {user.displayName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## `DirectoryGroup`

One user group in the space directory.

### Signature

```typescript
interface DirectoryGroup {
  id: number;
  name: string;
  userIds: string[];
}
```

### Behaviour

- `directory.groups()` returns every group.
- `userIds` holds user ids. Resolve them to names with `useUsers`.
- `id` is numeric, unlike the string `DirectoryUser.id`.

### Example

```tsx title="src/GroupList.tsx"
import type { DirectoryGroup } from '@vectoragents/vs-apps/client';
import { useApp } from '@vectoragents/vs-apps/react';
import { useEffect, useState } from 'react';

export function GroupList() {
  const { directory } = useApp();
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);

  useEffect(() => {
    void directory?.groups().then(setGroups);
  }, [directory]);

  return (
    <ul>
      {groups.map((group) => (
        <li key={group.id}>
          {group.name} ({group.userIds.length})
        </li>
      ))}
    </ul>
  );
}
```

## Result

A lazy `getClientConfig` helper for `AppProvider`, and member and group pickers typed with `DirectoryUser` and `DirectoryGroup`.

## Next step

Continue with the [harness reference](./harness.md).
