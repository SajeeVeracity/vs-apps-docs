---
title: Root reference
---

Reference for `@vectoragents/vs-apps` 0.2.4, the package root. The root holds the [app definition](../glossary.md#app-definition) and the schemas shared by client and server. A client imports two symbols from it: `defineAgentPage` and `appPages`. `defineApp` is covered in the [app definition guide](../index.md).

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- `zod` for the params schema of an action.

## `defineAgentPage`

Declares a [page](../glossary.md#page) the Space agent can read, and returns the factory for its [agent actions](../glossary.md#agent-action).

### Signature

```typescript
function defineAgentPage(meta: AgentPageMeta): AgentPageHandle;

interface AgentPageMeta {
  pageId: string;
  description: string;
}

interface AgentPageHandle extends AgentPageMeta {
  action<S extends z.ZodTypeAny>(input: AgentActionInput<S>): AgentActionHandle<S>;
}

interface AgentActionHandle<S extends z.ZodTypeAny = z.ZodTypeAny> extends AgentActionDef<S> {
  child<C extends z.ZodTypeAny>(input: AgentActionInput<C>): AgentActionHandle<C>;
}

interface AgentActionInput<S extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  description: string;
  params?: S;
}
```

| Field | Meaning |
| --- | --- |
| `pageId` | Unique id of the page. Prefixes every action id on it. |
| `description` | What the page is for. The agent reads it to decide when the page applies. |
| `id` | Local action name in snake_case. The factory namespaces it as `<pageId>.<id>`. |
| `params` | A zod schema for the action params. Omit it for an action without params. |

### Behaviour

- Registers the page and each action in a module-level collector at import time. The agent catalog extractor imports the app modules and reads the collector.
- `page.action(...)` roots an action on the page. `action.child(...)` declares an action that is available only while its parent is mounted.
- Throws on a duplicate `pageId`, a duplicate action id, or an `id` that is not a snake_case local name.
- Declaring an action does not make it callable. A component must bind it with `useAgentAction` from [`/agent-react`](./agent-react.md).
- Write each `description` for the agent. It is the only guidance the agent has about when to call the action.

### Example

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

The action ids are `sdr-leads.open_lead_list` and `sdr-leads.export_leads`.

## `appPages`

Returns the pages of the app that a verified token names.

### Signature

```typescript
function appPages(apps: readonly AppDefinition[], appKey: string | undefined): AppPageDef[];

interface AppPageDef {
  key: string;
  label: string;
  path: string;
  capability?: string;
}
```

| Parameter | Meaning |
| --- | --- |
| `apps` | The app definitions bundled in the client. |
| `appKey` | The `appKey` claim from `useApp().claims`, or `undefined` before the handshake. |

### Behaviour

- Returns the `pages` of the definition whose `key` equals `appKey`.
- Returns `[]` when `appKey` is `undefined` or matches no definition.
- Does not filter by capability. Filter on `page.capability` with `useApp().hasCapability`, as the example does.
- Capability checks only shape the UI. The server must enforce the same capability.

### Example

```tsx title="src/AppHome.tsx"
import { appPages, defineApp } from '@vectoragents/vs-apps';
import { useApp } from '@vectoragents/vs-apps/react';

const sdr = defineApp({
  key: 'sdr',
  version: '0.1.0',
  pages: [
    { key: 'leads', label: 'Leads', path: '/leads', capability: 'lead:manage' },
    { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  ],
  capabilities: [{ key: 'lead:manage', label: 'Manage leads', effect: 'write' }],
});

export function AppHome() {
  const { claims, hasCapability } = useApp();
  const pages = appPages([sdr], claims?.appKey).filter(
    (page) => !page.capability || hasCapability(page.capability),
  );

  return (
    <nav>
      {pages.length === 0 ? <p>No pages available for your role.</p> : null}
      {pages.map((page) => (
        <a key={page.key} href={page.path}>
          {page.label}
        </a>
      ))}
    </nav>
  );
}
```

## Result

An `actions.ts` that declares an agent page with a root action and a child action, and a landing component that lists the pages the user may open.

## Next step

Continue with the [client reference](./client.md).
