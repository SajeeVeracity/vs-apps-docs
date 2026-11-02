---
title: Expose agent actions on a page
---

Let the [Space](../glossary.md#space) agent open a Lead List on the leads [page](../glossary.md#page). The recipe declares the page and the [agent action](../glossary.md#agent-action) with `defineAgentPage`, binds a handler with `useAgentAction`, and writes both into the [agent catalog](../glossary.md#agent-catalog).

## Goal

End with the action `leads.open_lead_list` in the [manifest](../glossary.md#manifest) and bound to a handler while the leads page is mounted.

## Prerequisites

- The `recipes/leads-app/` folder of the [quickstart](../quickstart.md) repository. It holds the app with an ungated `leads` page. Run `npm install` in that folder with `GITHUB_PACKAGES_TOKEN` exported, as in the quickstart.
- Background: [`defineAgentPage`](../reference/root.md#defineagentpage), and [`useAgentAction`](../reference/agent-react.md#useagentaction). `AppProvider` already mounts the action registry.

## Steps

### 1. Install zod 3 and vite-node

The params schema needs `zod` version 3. Zod 4 gives an empty `paramsJsonSchema`, so the agent sees no params. The catalog command in step 4 runs through `vite-node`, a dev dependency of the client package.

```bash
npm install zod@3 --workspace client
npm install --save-dev vite-node --workspace client
```

### 2. Declare the page and the action

Keep the declarations in one module. The catalog entry and the component import the same handle. `pageId` must equal the `key` of a page in the app definition. The definition has the page key `leads`, so `buildManifests` finds the page. Write each `description` for the agent. The SDK puts it in the manifest, which Space reads.

```ts title="client/src/actions.ts"
import { defineAgentPage } from '@vectoragents/vs-apps';
import { z } from 'zod';

export const leadsPage = defineAgentPage({
  pageId: 'leads',
  description: 'Leads: people and companies found by lead searches, kept in Lead Lists.',
});

export const openLeadListAction = leadsPage.action({
  id: 'open_lead_list',
  description: "Open one Lead List's page, where its leads arrive as a search runs.",
  params: z.object({ leadListId: z.string() }),
});
```

The action id is `leads.open_lead_list`. `id` must be a snake_case local name that starts with a lowercase letter.

### 3. Bind a handler

The action is available to the agent only while a component that binds it is mounted. The handler receives the params parsed by the schema. Replace `client/src/LeadsPage.tsx` with this file.

```tsx title="client/src/LeadsPage.tsx"
import { useAgentAction } from '@vectoragents/vs-apps/agent-react';
import { useState } from 'react';
import { openLeadListAction } from './actions';

export function LeadsPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  useAgentAction(openLeadListAction, ({ leadListId }) => {
    setOpenId(leadListId);
  });

  return (
    <main>
      <h1>Leads</h1>
      <p>{openId ? `Lead List ${openId} is open.` : 'Pick a Lead List.'}</p>
    </main>
  );
}
```

### 4. Write the catalog

`buildManifests` reads `server/agent-catalog.json`, which the app ships empty. The app has no entry that fills it. Add the entry below. It loads `actions.ts`, so the page and the action register, and then writes the file. The import ends in `.js` because TypeScript requires an extension there. The command resolves it to `actions.ts`.

```ts title="client/scripts/agent-catalog.ts"
import { extractAgentCatalog } from '@vectoragents/vs-apps/extract';

void extractAgentCatalog({
  outPath: '../server/agent-catalog.json',
  load: async () => {
    await import('../src/actions.js');
  },
});
```

Run the command from the `recipes/leads-app/` folder. It runs the entry in the `client` folder with the client's own build settings and rewrites `server/agent-catalog.json`. Run it again after each change to a page or an action.

```bash
npm exec --workspace client -- vs-apps catalog extract scripts/agent-catalog.ts
```

The command prints `agent-catalog: 1 pages, 1 actions`. The file now lists `leads.open_lead_list` with a `paramsJsonSchema` that has `leadListId`.

### 5. Check the action

Restart the server so `buildManifests` reads the new catalog. It throws at boot if the catalog names a page key that the definition lacks. Open the leads page in a Space and ask the agent to open a Lead List. After each successful call, the SDK reports the mounted actions. A call with params that fail the schema returns `INVALID_PARAMS` and the handler does not run.

## Result

The catalog file lists `leads.open_lead_list`, and `buildManifests` merges it into the `leads` page. While the leads page is mounted, calling the action runs the handler with typed params.

## Next step

Model actions that exist only inside another action with [agent action trees](../guides/agent-action-trees.md).
