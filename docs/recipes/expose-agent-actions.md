---
title: Expose agent actions on a page
---

Let the [Space](../glossary.md#space) agent open a Lead List on the SDR leads [page](../glossary.md#page). The recipe declares the page and the [agent action](../glossary.md#agent-action) with `defineAgentPage`, then binds a handler with `useAgentAction`.

## Goal

End with the action `sdr-leads.open_lead_list` available to the agent while the leads page is mounted.

## Prerequisites

- The app from the [quickstart](../quickstart.md). `AppProvider` already mounts the action registry.
- `zod` installed for the params schema: `npm install zod`.
- Background: [`defineAgentPage`](../reference/root.md#defineagentpage), and [`useAgentAction`](../reference/agent-react.md#useagentaction).

## Steps

### 1. Declare the page and the action

Keep the declarations in one module. The [agent catalog](../glossary.md#agent-catalog) and the component import the same handle. The `description` fields are the only guidance the agent has, so write them for the agent.

```ts title="src/actions.ts"
import { defineAgentPage } from '@vectoragents/vs-apps';
import { z } from 'zod';

export const leadsPage = defineAgentPage({
  pageId: 'sdr-leads',
  description: 'SDR leads: people and companies found by lead searches, kept in Lead Lists.',
});

export const openLeadListAction = leadsPage.action({
  id: 'open_lead_list',
  description: "Open one Lead List's page, where its leads arrive as a search runs.",
  params: z.object({ leadListId: z.string() }),
});
```

The action id is `sdr-leads.open_lead_list`. `id` must be a snake_case local name, and `pageId` must be unique in the app.

### 2. Bind a handler

The action is available to the agent only while a component that binds it is mounted. The handler receives the params parsed by the schema.

```tsx title="src/client/LeadListsPage.tsx"
import { useAgentAction } from '@vectoragents/vs-apps/agent-react';
import { useState } from 'react';
import { openLeadListAction } from '../actions';

export function LeadListsPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  useAgentAction(openLeadListAction, ({ leadListId }) => {
    setOpenId(leadListId);
  });

  return <p>{openId ? `Lead List ${openId} is open.` : 'Pick a Lead List.'}</p>;
}
```

### 3. Merge the catalog into the manifest

`buildManifests` reads the extracted catalog from `catalogPath`, as set up in the quickstart. Regenerate `agent-catalog.json` after you add an action, restart the server and let Space pull the manifest.

### 4. Check in Space

Mount the page in a Space and ask the agent to open a Lead List. A call with params that fail the schema returns `INVALID_PARAMS` and the handler does not run.

## Result

The agent sees `sdr-leads.open_lead_list` while the leads page is open, and calling it runs the handler with typed params.

## Next step

Model actions that exist only inside another action with [agent action trees](../guides/agent-action-trees.md).
