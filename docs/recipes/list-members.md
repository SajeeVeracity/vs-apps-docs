---
title: List and pick members
---

Show the owners of SDR leads by name and let a user pick a member. The data comes from the [space](../glossary.md#space) directory.

## Goal

End with an owners list built with `useUsers` and a member picker built with the directory search.

## Prerequisites

- The app from the [quickstart](../quickstart.md). `loadAppClientConfig` must return a `spaceApiUrl`, otherwise the directory is not available.
- Background: [`useUsers`](../reference/react.md#useusers), [`DirectoryUser` and `DirectoryGroup`](../reference/client.md#directoryuser).

## Steps

### 1. Resolve owner ids to names

`useUsers` takes user ids your data already holds, for example the owner of each lead. Pass a stable array. A deleted user stays in the map with `deleted: true`.

```tsx title="src/client/LeadOwners.tsx"
import { useUsers } from '@vectoragents/vs-apps/react';

export function LeadOwners({ ownerIds }: { ownerIds: readonly string[] }) {
  const { users, loading } = useUsers(ownerIds);

  if (loading) return <p>Loading owners.</p>;

  return (
    <ul>
      {ownerIds.map((id) => {
        const user = users.get(id);
        return (
          <li key={id}>
            {user?.displayName ?? id}
            {user?.deleted ? ' (removed)' : ''}
          </li>
        );
      })}
    </ul>
  );
}
```

### 2. Search members for a picker

`useApp().directory` is `null` without a directory. `search` returns `DirectoryUser` entries.

```tsx title="src/client/OwnerPicker.tsx"
import type { DirectoryUser } from '@vectoragents/vs-apps/client';
import { useApp } from '@vectoragents/vs-apps/react';
import { useState } from 'react';

export function OwnerPicker({ onPick }: { onPick: (user: DirectoryUser) => void }) {
  const { directory } = useApp();
  const [matches, setMatches] = useState<DirectoryUser[]>([]);

  if (!directory) return <p>The directory is not available.</p>;

  return (
    <div>
      <input
        type="search"
        placeholder="Find an owner"
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

### 3. List groups

`directory.groups()` returns every `DirectoryGroup`. Its `id` is numeric, unlike the string id of a user.

```tsx title="src/client/TeamGroups.tsx"
import type { DirectoryGroup } from '@vectoragents/vs-apps/client';
import { useApp } from '@vectoragents/vs-apps/react';
import { useEffect, useState } from 'react';

export function TeamGroups() {
  const { directory } = useApp();
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);

  useEffect(() => {
    void directory?.groups().then(setGroups);
  }, [directory]);

  return (
    <ul>
      {groups.map((group) => (
        <li key={group.id}>{group.name}</li>
      ))}
    </ul>
  );
}
```

## Result

Owner ids render as names, a search box returns members for a picker, and the groups of the space list in a component.

## Next step

Let the Space agent drive these pages with [expose agent actions](./expose-agent-actions.md).
