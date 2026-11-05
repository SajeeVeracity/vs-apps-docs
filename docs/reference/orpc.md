---
title: oRPC reference
---

Reference for `@vectoragents/vs-apps/orpc` 0.4.0. The subpath binds the SDK to [oRPC](https://orpc.unnoq.com), the contract library that an app server shares with its client. It holds the routes every app server exposes, a contract builder that marks a route for the Space agent, and the function that lists those routes for the [manifest](../glossary.md#manifest).

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- `@orpc/contract` installed. It is a peer dependency of the subpath.
- `zod` version 3, installed with `npm install zod@3`, for the schemas of a route.
- A server that builds its manifests with `buildManifests`, covered in the [server reference](./server.md).

## `agentOc`

The contract builder that opts a route into the agent catalog. It is the `oc` builder of `@orpc/contract` with a typed `agent` entry in its `meta`.

### Signature

```typescript
const agentOc: ContractBuilder</* oc builder with meta */>;

interface AgentRouteMeta {
  description: string;
  approvalRequired?: boolean;
}
```

| Field | Meaning |
| --- | --- |
| `description` | What the route does. The agent reads it to decide when to call the route. |
| `approvalRequired` | Whether a person must approve each call. Defaults to `true` unless the method is `GET`. |

### Behaviour

- Use `agentOc` in place of `oc` for every route that the agent may call. A route built with plain `oc` stays out of the catalog.
- `.meta({ agent: { description } })` marks the route. A route without it is not listed.
- The route needs `method` and `path`, set with `.route(...)`. `buildEndpoints` throws without them.
- The agent calls the route with a user token that Space mints, so the guard of your server still applies.

### Example

```ts title="server/src/contract.ts"
import { agentOc } from '@vectoragents/vs-apps/orpc';
import { z } from 'zod';

const leadSchema = z.object({ id: z.string(), name: z.string() });

export const leadsContract = {
  list: agentOc
    .route({ method: 'GET', path: '/leads' })
    .meta({ agent: { description: 'List the leads of the current space.' } })
    .output(z.array(leadSchema)),
  rename: agentOc
    .route({ method: 'POST', path: '/leads/rename' })
    .meta({ agent: { description: 'Rename one lead.' } })
    .input(z.object({ id: z.string(), name: z.string() }))
    .output(leadSchema),
};
```

## `buildEndpoints`

Reads the agent routes of a contract into the endpoint list that `buildManifests` takes.

### Signature

```typescript
function buildEndpoints(contract: unknown): AgentEndpointDef[];

interface AgentEndpointDef {
  key: string;
  method: string;
  path: string;
  description: string;
  approvalRequired: boolean;
  paramsJsonSchema?: Record<string, unknown>;
  capability?: string;
}
```

| Field | Meaning |
| --- | --- |
| `key` | The route's position in the contract, joined with dots, for example `leads.list`. |
| `paramsJsonSchema` | The input schema of the route as JSON Schema. Absent for a route without an input. |

### Behaviour

- Walks the whole contract, including nested routers, and lists each route that has `meta.agent`.
- Throws at boot when a marked route has no `method` and `path`, or no `description`. A bad mark breaks the build and does not drop the route from the catalog silently.
- Runs on the server. `defineApp` no longer takes a contract, so no client bundle carries the walk.
- Pass the result to `buildManifests` as `endpoints`, keyed by the app key. `buildManifests` anchors each endpoint at the API base of the app.
- On a stack that is not oRPC, build the `AgentEndpointDef` list yourself and pass it the same way.

### Example

```ts title="server/src/manifests.ts"
import { defineApp } from '@vectoragents/vs-apps';
import { readExtractedAgentCatalog } from '@vectoragents/vs-apps/extract';
import { buildEndpoints } from '@vectoragents/vs-apps/orpc';
import { buildManifests } from '@vectoragents/vs-apps/server';
import { leadsContract } from './contract';

const leads = defineApp({
  key: 'leads',
  version: '0.1.0',
  pages: [{ key: 'home', label: 'Home', path: '/' }],
  capabilities: [],
});

export const manifests = buildManifests([leads], {
  catalog: readExtractedAgentCatalog('agent-catalog.json'),
  endpoints: { leads: buildEndpoints(leadsContract) },
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
```

## `appPlatformContract`

The routes that every app server exposes to its own client: a health check, and the `app.*` routes that forward calls to Space.

### Signature

```typescript
const appPlatformContract: {
  health: { check: /* GET /health */ };
  app: {
    datasourceQuery: /* POST /app/actions/datasource-query */;
    datasourceAsk: /* POST /app/actions/datasource-ask */;
    agentInvoke: /* POST /app/actions/agent-invoke */;
    connectorExecute: /* POST /app/actions/connector-execute */;
    retrievalQuery: /* POST /app/actions/retrieval-query */;
    retrievalSources: /* GET /app/actions/retrieval-sources */;
    audience: /* GET /app/audience */;
    config: { get: /* GET /app/config */ };
  };
};
```

### Behaviour

- Spread it into the contract of your app next to the contract of each app key, as the example does.
- The `app.*` routes have no implementation here. Bind each one to the `actions` of the app platform (`platform.actions`), or to `AppActionsService` on Nest. The platform adds the verified space and the token of the caller.
- `healthOutputSchema` is the output schema of `health.check`.

### Example

```ts title="server/src/app-contract.ts"
import { appPlatformContract } from '@vectoragents/vs-apps/orpc';
import { leadsContract } from './contract';

export const appContract = { ...appPlatformContract, leads: leadsContract };
```

## Result

A contract with two agent routes, a manifest that lists them as endpoints, and the shared platform routes in one `appContract`.

## Next step

Continue with the [extract reference](./extract.md).
