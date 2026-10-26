---
title: App definition
---

## Goal

Know what an [app definition](./glossary.md#app-definition) is, what reads it, how to write one and what a [Space](./glossary.md#space) does with it.

## Prerequisites

`@vectoragents/vs-apps` 0.2.4 installed. Terms link to the [glossary](./glossary.md) at first use.

## What an app definition is

An app definition is one TypeScript object, written by hand and built with `defineApp`. It declares the app `key`, its pages, the capabilities it can be granted and the resources it needs. It is env-free, so the server and the client import the same object.

The definition and the [manifest](./glossary.md#manifest) are two different things.

| | Definition | Manifest |
| --- | --- | --- |
| Form | Hand-written TypeScript | Generated JSON |
| Built by | You | `buildManifests` in `@vectoragents/vs-apps/server` |
| Read by | Your server and client, in-process | Space, over HTTP at `GET /api/manifest/:appKey` |

Space never sees the definition. It reads only the manifest the server builds from it.

## What an app definition does

One definition feeds ten uses. The manifest is the largest, not the only one.

1. **Import-time validation.** `defineApp` checks the fields when the file is imported, so a malformed edit fails at server boot and not at the Space pull. It returns the input unchanged.
2. **Manifest generation and serving.** `buildManifests` turns each definition into a manifest at boot. The server serves it on every Space pull.
3. **Agent-callable endpoint exposure.** Routes the server marks as agent-callable are listed in the manifest at boot.
4. **Agent-catalog merge.** At boot, the build-time agent catalog is merged into the manifest, joined on page keys.
5. **Server app registry.** The server holds each definition beside its Nest module, mounts the module and serves the definition's manifest.
6. **Token-scoped surface guards.** Controllers compare the `appKey` in a Space token with the definition `key` before they answer.
7. **Connector-event handler wiring.** At boot, the server registers one handler per connector event handler the definition declares, so the manifest and the handlers do not drift.
8. **Model-slot lookup.** Code asks Space for a model by [model slot](./glossary.md#model-slot) key. The SDK refuses a slot the manifest does not declare and a slot nobody set.
9. **Client nav and route typing.** The client lists pages with `appPages(...)` and derives a path type from the declared paths. No route is generated or guarded from the definition.
10. **Space-side use of the manifest.** Space turns pages into nav entries, capabilities into the vocabulary a space manager grants, resources into its config sheet, and agents and MCP servers into subagents and connectors.

Uses 1 to 9 happen in your app. Use 10 happens in Space and is covered in [How it reflects in Space](#how-it-reflects-in-space).

## How to write one

### Minimal example

One [page](./glossary.md#page) gated by one [capability](./glossary.md#capability).

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'hello-app', // sent to Space as appKey
  name: 'Hello app',
  version: '0.1.0',
  pages: [
    {
      key: 'home',
      label: 'Home',
      path: '/',
      capability: 'hello:view', // gates the page; must match a key below
    },
  ],
  capabilities: [
    { key: 'hello:view', label: 'View hello', effect: 'read' },
  ],
});
```

### Core fields

| Field | Required | Rule |
| --- | --- | --- |
| `key` | required | Lower kebab-case, 2-63 characters, starts with a letter. |
| `name` | optional | Display name, 1-80 characters. |
| `version` | required | Non-empty string. Not checked as semver. |
| `pages` | required | At least one page. Array order is nav order. |
| `defaultPageKey` | optional | When set, must equal a declared page key. |
| `capabilities` | required | Array of capabilities. `capabilities: []` is valid. |
| `pages[].key` | required | Lower kebab-case. Unique within the app. |
| `pages[].label` | required | Non-empty string. |
| `pages[].path` | required | String that starts with `/`. |
| `pages[].capability` | optional | One capability key. A page without a capability is ungated. |
| `capabilities[].key` | required | Form `<group>:<action>`, lower kebab-case segments. Two or more segments are valid. |
| `capabilities[].label` | required | Non-empty string. |
| `capabilities[].description` | optional | String. |
| `capabilities[].effect` | required | `"read"` or `"write"`. |
| `resources` | optional | Object. Unknown keys are rejected. |

:::warning
`defineApp` does not check `pages[].capability` against `capabilities`. A typo such as `hello:veiw` passes import and fails only when a user holds no matching capability. Copy the key from the `capabilities` entry.
:::

### Resources

`resources` is optional and declares what the app needs from the space: modules, model slots and [connector slots](./glossary.md#connector-slot). Unknown keys are rejected. Each slot or module `key` is unique within its list.

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'support-app',
  version: '0.1.0',
  pages: [{ key: 'inbox', label: 'Inbox', path: '/inbox', capability: 'support:read' }],
  capabilities: [{ key: 'support:read', label: 'Read inbox', effect: 'read' }],
  resources: {
    modules: [{ key: 'knowledge', required: false }],
    models: [
      {
        key: 'summary',
        modality: 'chat',
        providers: ['ANTHROPIC'],
        required: true,
      },
    ],
    connectors: [
      {
        key: 'whatsapp',
        provider: 'REST',
        required: true,
        eventHandlers: [{ key: 'message', label: 'Incoming message' }],
      },
    ],
  },
});
```

| Field | Required | Rule |
| --- | --- | --- |
| `resources.modules[]` | optional | Module requirements. Each needs `key` and `required`. |
| `resources.models[]` | optional | Model slots. |
| `resources.models[].key` | required | Lower kebab-case slot key. |
| `resources.models[].modality` | required | `"chat"`, `"vision"`, `"embed"` or `"rerank"`. |
| `resources.models[].providers` | required | At least one of `ANTHROPIC`, `AZURE_OPENAI`, `COHERE`, `AZURE_DOCUMENT_INTELLIGENCE`. |
| `resources.models[].required` | required | Boolean. |
| `resources.connectors[]` | optional | Connector slots. A slot takes one connector. |
| `resources.connectors[].key` | required | Lower kebab-case slot key. |
| `resources.connectors[].provider` | required | One of `REST`, `GRAPHQL`, `MCP`, `GOOGLE`, `CLICKUP`, `EXA`, `FIRECRAWL`, `INSTANTLY`, `UNIPILE`, `APOLLO`, `META`. |
| `resources.connectors[].required` | required | Boolean. |
| `resources.connectors[].eventHandlers` | optional | At least one handler when set. Any handler makes `eventsUrl` required in the manifest. |

## How it reflects in Space

A staff member registers the manifest URL in Space. Space stores the served manifest, never the definition file. After that:

- The page shows in the Space nav, for users who hold the page's capability.
- A space manager grants the declared capabilities. Only declared capabilities can be granted.
- A space manager picks a model for each model slot and attaches one connector to each connector slot. A slot nobody set runs nothing.
- A manifest change waits as a pending review. Staff apply it before it goes live, unless the registry entry has auto-apply on.

Re-pulls happen on a Space pull and on the app's boot ping.

### SDK guarantees

- `defineApp` rejects a malformed definition at import.
- `buildManifests` builds the manifest from the definition and the server serves it at `GET /api/manifest/:appKey`.
- The SDK refuses a model slot the manifest does not declare and a slot nobody set.

### Space-side

- Registration, the pending review and auto-apply.
- Nav entries and the capability filter on them.
- Grants, model choices and connector attachment.

How Space lists an ungated page in its nav is unverified here.

## Result

You can read, write and explain an app definition, and you know which behaviour the SDK guarantees and which Space owns.

## Next step

Fix the terms used here in the [glossary](./glossary.md).
