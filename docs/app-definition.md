---
title: App definition
---

## Goal

Know what an [app definition](./glossary.md#app-definition) is, what reads it, how to write one and what a [Space](./glossary.md#space) does with it.

## Prerequisites

The [software development kit (SDK)](./glossary.md#sdk) `@vectoragents/vs-apps` 0.2.4 installed. Terms link to the [glossary](./glossary.md) at first use.

## What an app definition is

An app definition is one TypeScript object, written by hand and built with `defineApp`. It declares the app `key`, its [pages](./glossary.md#page), the [capabilities](./glossary.md#capability) it can be granted and the resources it needs. It does not read environment variables, so the server and the client import the same object.

The definition and the [manifest](./glossary.md#manifest) are two different things.

| | Definition | Manifest |
| --- | --- | --- |
| Form | Hand-written TypeScript | Generated JSON |
| Built by | You | `buildManifests` in `@vectoragents/vs-apps/server` |
| Read by | Your server and client, in-process | Space, over HTTP at `GET /api/manifest/:appKey` |

Space never sees the definition. It reads only the manifest the server builds from it.

## What an app definition does

One definition is used in ten places. The manifest is the largest use, not the only one.

1. **Validate on import.** `defineApp` checks the fields when the file is imported. A wrong edit fails when the server starts, before Space reads the manifest. It returns the input unchanged.
2. **Generate and serve the manifest.** `buildManifests` turns each definition into a manifest at boot. The server serves it each time Space reads the manifest.
3. **List agent-callable routes.** Routes the server marks as agent-callable are listed in the manifest at boot.
4. **Merge the [agent catalog](./glossary.md#agent-catalog).** At boot, the build-time agent catalog is merged into the manifest, joined on page keys.
5. **Keep the server's app registry.** The registry is the server's list of app definitions. The server holds each definition beside its server module, mounts the module and serves the definition's manifest.
6. **Check the token.** Controllers compare the `appKey` in a Space token with the definition `key` before they answer.
7. **Register connector event handlers.** At boot, the server registers every event handler that a [connector slot](./glossary.md#connector-slot) declares in the definition. This keeps the manifest and the handlers the same.
8. **Look up a model slot.** Code asks Space for a model by [model slot](./glossary.md#model-slot) key. The SDK refuses a slot that the manifest does not declare, and a slot that no one set.
9. **Type navigation and routes.** The client lists pages with `appPages(...)` and derives a path type from the declared paths. No route is generated or guarded from the definition.
10. **Read the manifest in Space.** Space turns the manifest into these:

    | Manifest field | Space shows |
    | --- | --- |
    | Pages | Navigation entries |
    | Capabilities | The capabilities a [space manager](./glossary.md#space-manager) can grant |
    | Resources | A configuration sheet |
    | Agents and [Model Context Protocol (MCP)](./glossary.md#mcp) servers | Subagents and connectors |

Uses 1 to 9 happen in your app. Use 10 happens in Space and is covered in [How it reflects in Space](#how-it-reflects-in-space).

## How to write one

### Minimal example

To fill in a definition from a form instead, use the [definition builder](/builder).

One page gated by one capability.

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
| `pages` | required | At least one page. Array order is navigation order. |
| `defaultPageKey` | optional | When set, must equal a declared page key. |
| `capabilities` | required | Array of capabilities. `capabilities: []` is valid. |
| `pages[].key` | required | Lower kebab-case. Unique within the app. |
| `pages[].label` | required | Non-empty string. |
| `pages[].path` | required | String that starts with `/`. |
| `pages[].capability` | optional | One capability key. A page without a capability has no gate. |
| `capabilities[].key` | required | Form `<group>:<action>`, lower kebab-case segments. Two or more segments are valid. |
| `capabilities[].label` | required | Non-empty string. |
| `capabilities[].description` | optional | String. |
| `capabilities[].effect` | required | `"read"` or `"write"`. |

:::warning
`defineApp` does not check `pages[].capability` against `capabilities`. A typo such as `hello:veiw` passes import and fails only when a user holds no matching capability. Copy the key from the `capabilities` entry.
:::

### Resources

`resources` is optional and declares what the app needs from each Space: modules, model slots and connector slots. Unknown keys are rejected. Each slot or module `key` is unique within its list.

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
| `resources` | optional | Object. Unknown keys are rejected. |
| `resources.modules[]` | optional | Module requirements. Each needs `key` and `required`. |
| `resources.models[]` | optional | Model slots. |
| `resources.connectors[]` | optional | Connector slots. A slot takes one connector. |
| `resources.modules[].key` | required | Non-empty string. Unique within modules. |
| `resources.modules[].required` | required | Boolean. |
| `resources.models[].key` | required | Lower kebab-case slot key. |
| `resources.models[].modality` | required | Kind of model: `"chat"`, `"vision"`, `"embed"` or `"rerank"`. |
| `resources.models[].providers` | required | At least one of `ANTHROPIC`, `AZURE_OPENAI`, `COHERE`, `AZURE_DOCUMENT_INTELLIGENCE`. |
| `resources.models[].label` | optional | Display label. Falls back to the slot key. |
| `resources.models[].description` | optional | String. |
| `resources.models[].capabilities` | optional | Each one of `toolCalling`, `structuredOutput`, `reasoningOutput`, `promptCaching`, `streaming`. |
| `resources.models[].required` | required | Boolean. |
| `resources.connectors[].key` | required | Lower kebab-case slot key. |
| `resources.connectors[].provider` | required | One of `REST`, `GRAPHQL`, `MCP`, `GOOGLE`, `CLICKUP`, `EXA`, `FIRECRAWL`, `INSTANTLY`, `UNIPILE`, `APOLLO`, `META`. |
| `resources.connectors[].label` | optional | Display label. Falls back to the slot key. |
| `resources.connectors[].required` | required | Boolean. |
| `resources.connectors[].eventHandlers` | optional | At least one handler when set. Any handler makes `eventsUrl` required in the manifest. |
| `resources.connectors[].eventHandlers[].key` | required | Lower kebab-case handler key. Unique within the connector slot. |
| `resources.connectors[].eventHandlers[].label` | required | Non-empty string. |
| `resources.connectors[].eventHandlers[].description` | optional | String. |
| `resources.connectors[].eventHandlers[].defaultEventTypes` | optional | At least one lower-case slug when set. A type is the default of one handler only. |
| `resources.connectors[].eventHandlers[].singleEventType` | optional | Boolean. When `true`, `defaultEventTypes` holds at most one type. |

## How it reflects in Space

Vector registers your manifest URL in Space. Space stores the served manifest, never the definition file. After that:

- The page shows in the Space navigation, for users who hold the page's capability.
- A space manager grants the declared capabilities. Only declared capabilities can be granted.
- A space manager picks a model for each model slot and attaches one connector to each connector slot. If no one sets a slot, the app cannot use it.
- A manifest change waits as a pending review. Vector applies it before it goes live, unless auto-apply is on for the [app registration](./glossary.md#app-registration).

Space reads the manifest again when Vector triggers a pull and when the app announces that it started.

### SDK guarantees

- `defineApp` rejects a malformed definition at import.
- `buildManifests` builds the manifest from the definition and the server serves it at `GET /api/manifest/:appKey`.
- The SDK refuses a model slot the manifest does not declare and a slot nobody set.

### Space-side

- Registration, the pending review and auto-apply.
- Navigation entries and the capability filter on them.
- Grants, model choices and connector attachment.

## Result

You can read, write and explain an app definition, and you know which behavior the SDK guarantees and which Space owns.

## Next steps

- [Example app definitions](./examples.md): copy a complete definition into your project.
- [Recipes](/category/recipes): add a page, a capability or an agent action to your app.
- [Reference](/category/reference): look up the signature of each export, and the glossary terms.
