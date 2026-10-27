---
title: Glossary
---

Each term has one name in these docs. Pages link a term at first use. Each entry gives the definition, the code symbol or field it maps to, and who owns it.

## Terms

### app

A product you ship into Spaces: a React client, a server and one app definition.

- Maps to: the definition `key`, sent to Space as `appKey`.
- Owner: SDK. It defines the shape of the definition that identifies the app.

### app definition

The one object that describes an app: pages, capabilities and resources. It does not read environment variables. It feeds the server manifest and the client navigation.

- Maps to: `defineApp(...)` in `@vectoragents/vs-apps`, typed `AppDefinition`.
- Owner: SDK.

### manifest

The JSON the server builds from the app definitions and serves at `GET /api/manifest/:appKey`. Space reads it. The definition file itself is never sent.

- Maps to: `buildManifests` in `@vectoragents/vs-apps/server`.
- Owner: SDK builds it. Space reads it.

### Space

The Vector host where a space manager registers apps, shares capabilities and sets slots. It embeds each app page in an iframe.

- Maps to: no SDK symbol. The app talks to it through the token, the iframe bridge and the manifest.
- Owner: Space.

### space {#customer-space}

One customer's workspace inside Space. A space manager attaches apps to it.

- Maps to: no SDK symbol.
- Owner: Space.

### space manager

The person who runs one space. They grant capabilities and choose the models and connectors for the slots.

- Maps to: no SDK symbol.
- Owner: Space.

### staff

The administrators of Space itself. They register apps and apply manifest changes. A space manager works inside one space instead.

- Maps to: no SDK symbol.
- Owner: Space.

### app registration

The record staff create in Space by giving it a manifest URL. One registration per app. Space re-pulls the manifest on a pull or the app's boot ping.

- Maps to: no SDK symbol.
- Owner: Space.

### page

One screen of the app. It becomes a navigation entry in Space, shown only to users who hold the page's capability.

- Maps to: `pages[]` in the definition (`key`, `label`, `path`, optional `capability`). `appPages(...)` lists them on the client.
- Owner: SDK declares it. Space renders the navigation entry.

### capability

A named permission of the form `<group>:<action>` with an `effect` of `read` or `write`. A page and server routes reference it.

- Maps to: `capabilities[]` in the definition. `RequireCapability` and `useApp().hasCapability` check it on the client.
- Owner: SDK declares it. Space grants it.

### grant

A space manager shares a declared capability with users or roles. Only declared capabilities can be granted.

- Maps to: no SDK symbol. `useApp().capabilities` holds the capabilities granted to the current user.
- Owner: Space.

### model slot

A named AI model requirement. The app declares the slot and the space manager picks the model. No slot is inherited, and an unset slot runs nothing.

- Maps to: `resources.models[]` in the definition.
- Owner: SDK declares it. Space stores the choice.

### connector slot

A named requirement for one external connector, such as ClickUp or a REST API. A slot takes one connector. It can declare event handlers for incoming webhooks.

- Maps to: `resources.connectors[]` in the definition, with optional `eventHandlers`.
- Owner: SDK declares it. Space attaches the connector.

### agent action

An operation a page registers so the Space agent can call it while the page is open.

- Maps to: `useAgentAction` in `@vectoragents/vs-apps/agent-react`, registered through `AgentActionRegistryProvider`.
- Owner: SDK.

### agent catalog

The build-time list of page descriptions and agent actions. The server merges it into the manifest at boot. Space ingests it per app.

- Maps to: `defineAgentPage` and the `agent-catalog.json` file.
- Owner: SDK builds it. Space ingests it.

### acts

Declared records of what the app did, such as an import. Each act has a `kind` of `activity` or `audit`. Space refuses an undeclared act key.

- Maps to: `acts[]` in the definition.
- Owner: SDK declares them. Space bounds and records them.

### approvals

Declared points where a person must confirm an action. Each approval can opt into a standing "always allow" with `grantable`.

- Maps to: `approvals[]` in the definition.
- Owner: SDK declares them. Space asks the approver.

### harness

A local stand-in for Space that hosts the app page in a dev shell, for debugging without a registration. The quickstart does not use it.

- Maps to: `VectorAppsHarness` in `@vectoragents/vs-apps/harness`.
- Owner: SDK.

### SDK

The software development kit: the `@vectoragents/vs-apps` package, version 0.2.4.

- Maps to: `@vectoragents/vs-apps` and its subpaths.
- Owner: SDK.

### MCP

Model Context Protocol. An open protocol that connects a model to tools and data. A connector slot with the provider `MCP` uses it.

- Maps to: `provider: 'MCP'` in `resources.connectors[]`.
- Owner: SDK declares it. Space attaches the connector.
