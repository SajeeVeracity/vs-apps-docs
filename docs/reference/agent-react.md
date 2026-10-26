---
title: Agent-react reference
---

Reference for `@vectoragents/vs-apps/agent-react` 0.2.4. The subpath binds page handlers to [agent actions](../glossary.md#agent-action), so the Space agent can drive a page. `AppProvider` from [`/react`](./react.md) already mounts the registry. Apps call `useAgentAction` and rarely touch the rest.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- React 19 with TypeScript.
- An action declared with `defineAgentPage`, covered in the [root reference](./root.md).
- `zod` for the params schema of an action.

## `useAgentAction`

Binds a handler to an action definition while the component is mounted.

### Signature

```typescript
function useAgentAction<S extends z.ZodTypeAny>(
  def: AgentActionDef<S>,
  handler: AgentActionHandler<S>,
): void;

type AgentActionHandler<S extends z.ZodTypeAny = z.ZodTypeAny> = (
  params: z.infer<S>,
  context?: AgentActionContext,
) => void | Promise<void>;

interface AgentActionContext {
  parentSpanId?: string;
}
```

| Parameter | Meaning |
| --- | --- |
| `def` | The handle returned by `page.action(...)` or `action.child(...)`. |
| `handler` | Runs when the agent calls the action. Receives the params parsed by the action's schema. |

### Behaviour

- Registers the handler on mount and removes it on unmount. An action is available to the agent only while a component that binds it is mounted.
- Keeps the latest `handler` in a ref. A new closure on each render does not re-register the action.
- Re-registers when `def` changes, so pass a module-level handle.
- A child action is available only while its parent is mounted. Calling it without the parent returns `UNAVAILABLE_ACTION` with `missingParent`.
- Parses the params with the action's schema before the handler runs. A failure returns `INVALID_PARAMS` and the handler is not called.
- A handler that throws, or rejects, returns `HANDLER_ERROR` with the error message.
- Throws `useAgentActionRegistry must be used within AgentActionRegistryProvider` outside the registry. `AppProvider` supplies it.

### Example

```tsx title="src/LeadListsPage.tsx"
import { defineAgentPage } from '@vectoragents/vs-apps';
import { useAgentAction } from '@vectoragents/vs-apps/agent-react';
import { useState } from 'react';
import { z } from 'zod';

const leadsPage = defineAgentPage({
  pageId: 'sdr-leads',
  description: 'SDR leads: people and companies found by lead searches, kept in Lead Lists.',
});

const openLeadListAction = leadsPage.action({
  id: 'open_lead_list',
  description: "Open one Lead List's page.",
  params: z.object({ leadListId: z.string() }),
});

export function LeadListsPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  useAgentAction(openLeadListAction, ({ leadListId }) => {
    setOpenId(leadListId);
  });

  return <p>{openId ? `Lead List ${openId} is open.` : 'Pick a Lead List.'}</p>;
}
```

In an app the definition lives in a shared `actions.ts`, so the [agent catalog](../glossary.md#agent-catalog) extractor and the component import the same handle.

## `AgentActionRegistryProvider`

Creates the registry that `useAgentAction` writes to and exposes it to the tree.

### Signature

```typescript
function AgentActionRegistryProvider(props: {
  children?: ReactNode;
}): ReturnType<typeof createElement>;
```

### Behaviour

- Creates one `AgentActionRegistry` per mount and keeps it for the life of the provider.
- `AppProvider` already wraps its tree in this provider. A second one splits the registry, so actions bound below it are invisible to Space.
- Mount it directly only in a test or a story that renders a page without `AppProvider`.

### Example

```tsx title="src/LeadListsPage.test-harness.tsx"
import { defineAgentPage } from '@vectoragents/vs-apps';
import { AgentActionRegistryProvider, useAgentAction } from '@vectoragents/vs-apps/agent-react';

const dashboardPage = defineAgentPage({
  pageId: 'sdr-dashboard-harness',
  description: 'SDR dashboard shown without Space.',
});

const refreshAction = dashboardPage.action({
  id: 'refresh',
  description: 'Reload the dashboard.',
});

function Dashboard() {
  useAgentAction(refreshAction, () => {
    console.log('refreshed');
  });

  return <h1>Dashboard</h1>;
}

export function DashboardHarness() {
  return (
    <AgentActionRegistryProvider>
      <Dashboard />
    </AgentActionRegistryProvider>
  );
}
```

## `useAgentActionRegistry`

Returns the registry from the nearest provider.

### Signature

```typescript
function useAgentActionRegistry(): AgentActionRegistry;
```

### Behaviour

- Throws `useAgentActionRegistry must be used within AgentActionRegistryProvider` outside a provider.
- Returns the same instance on every render.
- Reading the registry does not subscribe to it. `getMountedActions()` is a snapshot at call time.

### Example

```tsx title="src/MountedActions.tsx"
import { useAgentActionRegistry } from '@vectoragents/vs-apps/agent-react';

export function MountedActions() {
  const registry = useAgentActionRegistry();
  const actions = registry.getMountedActions();

  return (
    <ul>
      {actions.map((action) => (
        <li key={action.id}>{action.id}</li>
      ))}
    </ul>
  );
}
```

## `AgentActionRegistry`

Holds the actions that are mounted now and dispatches calls to their handlers.

### Signature

```typescript
class AgentActionRegistry {
  register(def: AgentActionDef, handler: AgentActionHandler): () => void;
  getMountedActions(): AgentCatalogAction[];
  dispatch(
    actionId: string,
    params?: unknown,
    context?: AgentActionContext,
  ): Promise<AgentActionDispatchResult>;
}

type AgentActionDispatchResult =
  | { ok: true }
  | { ok: false; code: 'UNAVAILABLE_ACTION'; missingParent?: string }
  | { ok: false; code: 'INVALID_PARAMS'; message: string }
  | { ok: false; code: 'HANDLER_ERROR'; message: string };
```

| Method | Meaning |
| --- | --- |
| `register` | Stores a handler under `def.id` and returns a function that removes it. The function removes the entry only while it still holds this handler. |
| `getMountedActions` | Serialised definitions of every mounted action, with `params` as JSON Schema. |
| `dispatch` | Runs the handler for `actionId`. Never throws. Returns the outcome as a result object. |

### Behaviour

- `useAgentAction` is the only caller of `register` in an app. Call it directly only in a custom integration.
- Registering a second handler for the same id replaces the first.
- `dispatch` validates `params` against the action's schema and passes the parsed value to the handler. Without a schema, `params` reach the handler unchanged.
- `context` reaches the handler as its second argument. Concurrent dispatches do not share it.
- The bridge that Space talks to calls `dispatch` and reports the outcome. A successful call returns the mounted-action tree, so the agent sees the actions the new page state exposes.

### Example

```tsx title="src/DispatchButton.tsx"
import { useAgentActionRegistry } from '@vectoragents/vs-apps/agent-react';
import { useState } from 'react';

export function DispatchButton({ leadListId }: { leadListId: string }) {
  const registry = useAgentActionRegistry();
  const [status, setStatus] = useState('idle');

  async function run() {
    const result = await registry.dispatch('sdr-leads.open_lead_list', { leadListId });
    setStatus(result.ok ? 'opened' : result.code);
  }

  return (
    <button type="button" onClick={run}>
      Open list ({status})
    </button>
  );
}
```

## Result

A page component that binds `sdr-leads.open_lead_list` with `useAgentAction`, and a debugging component that lists and dispatches mounted actions through the registry.

## Next step

Continue with the [root reference](./root.md).
