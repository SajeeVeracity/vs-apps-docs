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

A Vector workspace. A space manager adds apps, shares capabilities and sets slots in it. It embeds each app page in an iframe.

- Maps to: no SDK symbol. The app talks to it through the token, the iframe bridge and the manifest.
- Owner: Space.

### space manager

A member of a space at Edit level, or an Organization admin. They add apps, grant capabilities and choose the models and connectors for the slots.

- Maps to: no SDK symbol.
- Owner: Space.

### Organization admin

A member who manages the organization in Space and sees **Organization** under **Settings**. Every Organization admin is a space manager.

- Maps to: no SDK symbol.
- Owner: Space.

### Edit level

The access level that lets a member edit a space. A member at Edit level is a space manager.

- Maps to: no SDK symbol.
- Owner: Space.

### app registration

The record Vector creates in Space from your manifest URL. One registration per app. Space re-pulls the manifest on a pull or the app's boot ping.

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

A local stand-in for Space that hosts the app page in a dev shell, for debugging without a registration.

- Maps to: `VectorAppsHarness` in `@vectoragents/vs-apps/harness`.
- Owner: SDK.

### dev issuer

The token signer that the app server runs in harness mode. It signs a token on request, verifies tokens it signed and publishes its public key set. In production, Space does these jobs instead.

- Maps to: `createDevIssuer` in `@vectoragents/vs-apps/server`.
- Owner: SDK.

### SDK

The software development kit: the `@vectoragents/vs-apps` package, version 0.2.4.

- Maps to: `@vectoragents/vs-apps` and its subpaths.
- Owner: SDK.

### MCP

Model Context Protocol. An open protocol that connects a model to tools and data. A connector slot with the provider `MCP` uses it.

- Maps to: `provider: 'MCP'` in `resources.connectors[]`.
- Owner: SDK declares it. Space attaches the connector.

### A2A

Agent2Agent. An open protocol that lets one agent find another through an agent card and call it with JSON Remote Procedure Call (JSON-RPC) messages. An app that declares an agent publishes the card and answers `message/send` and `message/stream`.

- Maps to: `agents[]` in the definition, and `buildAppAgentCard` and `createA2aRequestHandler` in `@vectoragents/vs-apps/server`.
- Owner: SDK declares it. Space calls it.

### service secret

The secret Space creates for each pair of app and space and pushes to the app at `POST /api/provision`. The app trades it for an app token.

- Maps to: `getServiceSecret` in `createSpaceAiConfigProvider`, and the credential store of `nest-adapter`.
- Owner: Space creates it. The SDK stores and exchanges it.

### app token

A short-lived token that Space issues in exchange for the service secret. Space limits it to what the app may do, with no user involved.

- Maps to: `createSpaceS2sTokenProvider` and `SpaceS2sService`.
- Owner: Space issues it. The SDK requests it.

### monorepo

One repository that holds the client, the server and the shared package, each as its own package.

- Maps to: the `workspaces` field in the root `package.json`.
- Owner: docs. It is a layout the quickstart uses, not an SDK concept.

### shared package

The package `@hello-app/shared`. It holds the app definition and the capability key. The client and the server both import it.

- Maps to: no SDK symbol.
- Owner: docs. It is a package of the quickstart app, not part of the SDK.
