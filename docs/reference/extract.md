---
title: Extract reference
---

Reference for `@vectoragents/vs-apps/extract` 0.4.0. The subpath is the build-time tooling that turns the [agent pages](../glossary.md#agent-catalog) and actions declared in your client into one JSON file. `buildManifests` merges that file into the [manifest](../glossary.md#manifest) at server boot. The `vs-apps` command runs it.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- `vite-node` as a dev dependency of the client package. The command runs your own copy, so the entry loads through the build settings of your client.
- Pages and actions declared with `defineAgentPage`, covered in the [root reference](./root.md).
- Node.js. The subpath does not run in a browser.

## `extractAgentCatalog`

Loads your modules, collects every page and action they declare, and writes the catalog file.

### Signature

```typescript
function extractAgentCatalog(options: ExtractAgentCatalogOptions): Promise<
  ExtractedAgentCatalog & { changed: boolean; outPath: string }
>;

interface ExtractAgentCatalogOptions {
  outPath: string | URL;
  load: () => Promise<void>;
  log?: (message: string) => void;
}
```

| Option | Meaning |
| --- | --- |
| `outPath` | Where to write the catalog file. |
| `load` | Imports the modules that call `defineAgentPage` and `page.action`. |
| `log` | Receives the result line. Defaults to `console.log`. |

### Behaviour

- Clears the collectors, installs stubs for the browser globals so a module with top-level DOM access survives, then runs `load`.
- Validates what registered and throws on a failure, so a broken declaration breaks the build.
- Writes the file only when its text differs from the file already there. A watcher or a server that restarts on the file fires on a real change only. The result's `changed` says which case ran.
- Logs a line such as `agent-catalog: 1 pages, 1 actions`, with `(unchanged)` when nothing changed.
- Keep the entry declaration-only. It names the modules to load and the output path, and everything else is the SDK's.
- Page ids must be unique across every app that the server hosts.

### Example

```ts title="src/actions.ts"
import { defineAgentPage } from '@vectoragents/vs-apps';

export const leadsPage = defineAgentPage({
  pageId: 'leads-extract',
  description: 'SDR leads, for the extraction example.',
});
```

```ts title="scripts/agent-catalog.ts"
import { extractAgentCatalog } from '@vectoragents/vs-apps/extract';

void extractAgentCatalog({
  outPath: '../server/agent-catalog.json',
  load: async () => {
    await import('../src/actions.js');
  },
});
```

The entry imports `actions.js` because TypeScript requires an extension there. The command resolves it to `actions.ts`. A relative `outPath` is relative to the folder that you run the command from.

Run the entry with the `vs-apps` command from the client package. The command sets `AGENT_CATALOG_EXTRACT=1`, so the build configuration of the client can leave out plugins that would restart the dev server during the run, such as a route generator.

```bash
vs-apps catalog extract scripts/agent-catalog.ts
vs-apps catalog extract scripts/agent-catalog.ts --watch --root src
```

`--watch` runs the entry again, in a new process, when a file under `--root` changes. `--root` defaults to the folder of the entry.

## `readExtractedAgentCatalog`

Reads the catalog file for `buildManifests`.

### Signature

```typescript
function readExtractedAgentCatalog(path: string | URL): unknown;
```

### Behaviour

- Returns the parsed JSON of the file.
- Returns `undefined` when the file does not exist, which is the state before the first extraction. `buildManifests` accepts `undefined` and logs a warning. The manifests then have no page descriptions and no actions.
- Throws when the file exists but is not valid JSON. A broken file is a broken build.
- Takes a path or a `URL`.

### Example

```ts title="server/src/catalog.ts"
import { readExtractedAgentCatalog } from '@vectoragents/vs-apps/extract';

export const catalog = readExtractedAgentCatalog('agent-catalog.json');
```

Pass `catalog` to `buildManifests`, as the [server reference](./server.md) shows.

## Lower-level functions

`installBrowserStubs`, `collectExtractedActions` and `writeExtractedCatalogFile` are the steps that `extractAgentCatalog` wraps. Call them only to build your own extraction routine. `writeExtractedCatalogFile` writes without validation and without the change check.

## Result

A client entry that writes `agent-catalog.json`, and a server file that reads it for `buildManifests`.

## Next step

Continue with the [conformance reference](./conformance.md).
