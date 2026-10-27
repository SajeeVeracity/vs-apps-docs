---
title: Example app definitions
---

Two complete [app definitions](./glossary.md#app-definition) to copy into your own project: a multi-page SDR app and a customer support app with channel [connector slots](./glossary.md#connector-slot).

## Goal

Start a definition from a working file instead of an empty one.

## Prerequisites

- `@vectoragents/vs-apps` installed.

## SDR: pages, capabilities and a model slot

Four [pages](./glossary.md#page), each gated by one [capability](./glossary.md#capability), and one [model slot](./glossary.md#model-slot) the space manager points at a model.

```ts title="src/app.definition.ts" file="src/examples/sdr.definition.ts"
```

## CSR: model slots and connector slots

Two model slots and two connector slots. Each connector declares `eventHandlers`, the handlers a space admin routes its event types to.

```ts title="src/app.definition.ts" file="src/examples/csr.definition.ts"
```

## Result

Each file passes `defineApp` as pasted. Change `key`, page paths and slot keys to match your app.

Copy one into your project as `src/app.definition.ts`, or load it in the [definition builder](/builder).

## Next steps

- [App definition](./app-definition.md): learn what each definition field does.
- [Recipes](/category/recipes): add a page, a capability or an agent action to your app.
