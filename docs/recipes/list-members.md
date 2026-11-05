---
title: List and pick members
---

<!-- flavour react -->
Show the owners of leads by name, let a member pick an owner and list the people in each group. The data comes from the [space](../glossary.md#space) directory.

## Goal

End with an owners list built with `useUsers`, a member picker built with the directory search, and a roster of each group.

## Prerequisites

- The app from the [quickstart](../quickstart.md), added to a Space (Part 2) and run with `npm run dev:space`. The harness has no directory, because `npm run dev` clears `SPACE_API_URL`.
- `SPACE_API_URL` in `.env`, set to the Space API origin followed by `/api`, for example `https://space-api.example.com/api`. The starter returns it as `spaceApiUrl` in `/api/client-config`. Without it, `useApp().directory` is `null`.
- Background: [`useUsers`](../reference/react.md#useusers), [`DirectoryUser` and `DirectoryGroup`](../reference/client.md#directoryuser).

## Steps

Each snippet is a complete file.

### 1. Resolve owner identifiers to names

`useUsers` takes user identifiers your data already holds, for example the owner of each lead. It fetches again only when the set of identifiers changes, so a new array on each render costs nothing. If Space cannot show an identifier, the map holds an entry with `deleted: true` and the name `Former member`. Space cannot show an identifier for a deleted user, a user who left the organization or an unknown identifier.

```tsx title="client/src/LeadOwners.tsx"
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

`useApp().directory` is `null` without a directory. `search` returns `DirectoryUser` entries and rejects when Space answers with an error, so the snippet catches the rejection and shows an error line.

Search runs from an effect that waits 300 ms after the last keystroke. The cleanup cancels the timer when the query changes, so only the last pause sends a call. The same cleanup drops a reply that arrives after the query changed.

```tsx title="client/src/OwnerPicker.tsx"
import type { DirectoryUser } from '@vectoragents/vs-apps/client';
import { useApp } from '@vectoragents/vs-apps/react';
import { useEffect, useState } from 'react';

export function OwnerPicker({ onPick }: { onPick: (user: DirectoryUser) => void }) {
  const { directory } = useApp();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<DirectoryUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!directory || query.trim() === '') {
      setMatches([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      directory
        .search(query, 5)
        .then((found) => {
          if (stale) return;
          setMatches(found);
          setError(null);
        })
        .catch(() => {
          if (!stale) setError('The search failed. Try again.');
        });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [directory, query]);

  if (!directory) return <p>The directory is not available.</p>;

  return (
    <div>
      <input type="search" placeholder="Find an owner" value={query} onChange={(event) => setQuery(event.target.value)} />
      {error ? <p role="alert">{error}</p> : null}
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

### 3. Show the members of a group

A `DirectoryGroup` holds `userIds`, not names. `userIds` lists only members that Space shows. Pass them to `useUsers` to get names. A hook cannot run in a loop, so one component takes one group.

```tsx title="client/src/GroupRoster.tsx"
import type { DirectoryGroup } from '@vectoragents/vs-apps/client';
import { useUsers } from '@vectoragents/vs-apps/react';

export function GroupRoster({ group }: { group: DirectoryGroup }) {
  const { users, loading } = useUsers(group.userIds);

  if (loading) return <p>Loading members.</p>;

  return (
    <ul>
      {group.userIds.map((id) => (
        <li key={id}>{users.get(id)?.displayName ?? id}</li>
      ))}
    </ul>
  );
}
```

### 4. List groups

`directory.groups()` returns every `DirectoryGroup` of the space. Its `id` is numeric, unlike the string identifier of a user. Like `search`, it rejects when Space answers with an error, so the snippet shows an error line.

```tsx title="client/src/TeamGroups.tsx"
import type { DirectoryGroup } from '@vectoragents/vs-apps/client';
import { useApp } from '@vectoragents/vs-apps/react';
import { useEffect, useState } from 'react';
import { GroupRoster } from './GroupRoster';

export function TeamGroups() {
  const { directory } = useApp();
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    directory
      ?.groups()
      .then(setGroups)
      .catch(() => setError('The groups failed to load. Try again.'));
  }, [directory]);

  return (
    <div>
      {error ? <p role="alert">{error}</p> : null}
      {groups.map((group) => (
        <section key={group.id}>
          <h3>{group.name}</h3>
          <GroupRoster group={group} />
        </section>
      ))}
    </div>
  );
}
```

### 5. Mount the components

In `client/src/LeadsPage.tsx`, import `LeadOwners`, `OwnerPicker` and `TeamGroups`. Render `<LeadOwners ownerIds={ownerIds} />` with the owner identifiers the page holds, `<OwnerPicker onPick={pickOwner} />`, where `pickOwner` is your function that stores the picked `user.id`, and `<TeamGroups />`. Each component calls `useApp` or `useUsers`, so it must render inside `AppProvider`, as the pages do.

## Result

Owner identifiers render as names, a search box returns members for a picker with one call per pause in typing, and each group of the space lists its members by name. A failed search or group call shows an error line.

## Next step

Let the Space agent drive these pages with [expose agent actions](./expose-agent-actions.md).
<!-- /flavour -->
