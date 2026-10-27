---
title: Agent action trees
---

Advanced configuration of [agent actions](../glossary.md#agent-action): child actions that exist only while a parent is mounted, and testing a page without [Space](../glossary.md#space).

## Goal

End with a child action `sdr-leads.export_leads` that the agent can call only after it opens a Lead List, and a test harness that mounts the page without `AppProvider`.

## Prerequisites

- The page and action from [expose agent actions](../recipes/expose-agent-actions.md).
- Background: [`defineAgentPage`](../reference/root.md#defineagentpage) and [`AgentActionRegistryProvider`](../reference/agent-react.md#agentactionregistryprovider). The [quickstart](../quickstart.md) covers the app setup.

## Steps

### 1. Declare a child action

`child` declares an action that is available only while its parent is mounted. Calling it without the parent returns `UNAVAILABLE_ACTION`.

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

export const exportLeadsAction = openLeadListAction.child({
  id: 'export_leads',
  description: "Download the open Lead List's leads as a csv or xlsx file.",
  params: z.object({ format: z.enum(['csv', 'xlsx']) }),
});
```

### 2. Bind the parent and the child in nested components

Mount the child binding inside the component that the parent action opens, so the child exists only while a Lead List is open.

```tsx title="src/client/LeadListView.tsx"
import { useAgentAction } from '@vectoragents/vs-apps/agent-react';
import { useState } from 'react';
import { exportLeadsAction, openLeadListAction } from '../actions';

function ExportControls({ leadListId }: { leadListId: string }) {
  const [last, setLast] = useState('none');

  useAgentAction(exportLeadsAction, ({ format }) => {
    setLast(format);
  });

  return <p>Lead List {leadListId}, last export: {last}.</p>;
}

export function LeadListView() {
  const [openId, setOpenId] = useState<string | null>(null);

  useAgentAction(openLeadListAction, ({ leadListId }) => {
    setOpenId(leadListId);
  });

  return openId ? <ExportControls leadListId={openId} /> : <p>Pick a Lead List.</p>;
}
```

### 3. Test the page without Space

`AppProvider` already mounts the registry, and a second `AgentActionRegistryProvider` splits it. Mount the provider directly only where `AppProvider` is absent, such as a test or a story.

```tsx title="src/client/LeadListView.harness.tsx"
import { AgentActionRegistryProvider } from '@vectoragents/vs-apps/agent-react';
import { LeadListView } from './LeadListView';

export function LeadListViewHarness() {
  return (
    <AgentActionRegistryProvider>
      <LeadListView />
    </AgentActionRegistryProvider>
  );
}
```

To trigger an action in such a test, read the registry with `useAgentActionRegistry` and call `dispatch('sdr-leads.open_lead_list', { leadListId: 'll-1' })`. `dispatch` never throws, and returns `{ ok: false, code }` on failure.

## Result

The agent sees `sdr-leads.export_leads` only after it opens a Lead List, and the page renders in a test without Space.

## Next step

Look up every registry symbol in the [agent-react reference](../reference/agent-react.md), and the [agent catalog](../glossary.md#agent-catalog) term for how actions reach Space.
