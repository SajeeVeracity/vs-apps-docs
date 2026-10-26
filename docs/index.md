---
title: Page template
slug: /
---

Every page follows one template. This placeholder page also proves the snippet check.

## Goal

State what the reader gets by the end of the page.

## Prerequisites

List what the reader needs first.

## Steps

Each code block is a complete file and is typechecked against the installed package.

```ts title="src/app.definition.ts"
import { defineApp } from '@vectoragents/vs-apps';

export const definition = defineApp({
  key: 'hello-app',
  version: '0.1.0',
  pages: [{ key: 'home', label: 'Home', path: '/' }],
  capabilities: [],
});
```

## Result

State what the reader now has.

## Next step

Link to the next page.
