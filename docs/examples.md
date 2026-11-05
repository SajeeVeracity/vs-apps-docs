---
title: Example app definitions
---

Two complete [app definitions](./glossary.md#app-definition) to copy into your own project: a sales outreach app with several pages and a customer support app with channel [connector slots](./glossary.md#connector-slot).

Prerequisites: `@vectoragents/vs-apps` 0.2.4 installed. Copy one file into your project as `src/app.definition.ts`.

## Sales outreach app: pages, capabilities and a model slot

Four [pages](./glossary.md#page), each gated by one [capability](./glossary.md#capability), and one [model slot](./glossary.md#model-slot) the space manager points at a model.

```ts title="src/app.definition.ts" file="src/examples/sdr.definition.ts"
```

## Customer support app: model slots and connector slots

Two model slots and two connector slots. Each connector declares `eventHandlers`, the handlers a space admin routes its event types to.

```ts title="src/app.definition.ts" file="src/examples/csr.definition.ts"
```

## Next steps

Each file passes `defineApp` as pasted, so change only the `key`, page paths and slot keys to match your app.

- [App definition](./app-definition.md): learn what each field does.
- [Recipes](/category/recipes): add a page, a capability or an agent action to your app.
- [Definition builder](/builder): load an example and edit it in a form.
