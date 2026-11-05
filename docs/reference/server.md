---
title: Server reference
---

Reference for `@vectoragents/vs-apps/server` 0.2.4. This page covers the one symbol of the subpath that reaches out to [Space](../glossary.md#space): `pingSpaceManifests`. It tells Space that your [manifests](../glossary.md#manifest) changed, so Space does not wait for a staff refresh.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- A server that builds its manifests with `buildManifests`, covered in the [app definition guide](../app-definition.md).
- The origin of a Space the server can reach, for example `https://space.example.com`.

## `pingSpaceManifests`

Sends Space the current hash of each manifest at boot.

### Signature

```typescript
function pingSpaceManifests(options: {
  spaceBaseUrl: string;
  manifests: Record<string, AppManifest>;
  log?: (message: string) => void;
}): Promise<void>;
```

| Option | Meaning |
| --- | --- |
| `spaceBaseUrl` | The Space origin, with no `/api` suffix. One trailing `/` is removed. |
| `manifests` | The record that `buildManifests` returns, keyed by app key. |
| `log` | Receives each failure message. Defaults to `console.warn`. |

### Behaviour

- Call it once at boot, after `buildManifests`.
- Sends `POST {spaceBaseUrl}/api/apps/manifest-ping` once for each manifest. The body is JSON with `appKey` and `manifestHash`, the SHA-256 hex digest of the manifest as the server serves it.
- Space re-pulls the manifest of each app whose hash changed.
- Stops on a status from 200 to 299 or on `429`, which means Space is already pulling that app.
- Tries a failing ping up to 3 times, at 0, 5 and 15 seconds after the call. It logs each failure.
- Never throws. Failures go to `log`, so call it without `await`. A manual refresh in Space remains the fallback.
- Resolves after every manifest has either succeeded or used its 3 attempts.
- Sends no credentials. The body holds a hash and an app key, not manifest data.

### Example

<!-- flavour node -->
```ts title="src/ping.ts"
import { defineApp } from '@vectoragents/vs-apps';
import { buildManifests, pingSpaceManifests } from '@vectoragents/vs-apps/server';

const definition = defineApp({
  key: 'hello-app',
  version: '0.1.0',
  pages: [{ key: 'home', label: 'Home', path: '/' }],
  capabilities: [],
});

const manifests = buildManifests([definition], {
  catalogPath: 'agent-catalog.json',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});

if (process.env.SPACE_API_URL) {
  // A value that ends in /api is the API root, not the origin.
  const spaceBaseUrl = process.env.SPACE_API_URL.replace(/\/api\/?$/, '');
  void pingSpaceManifests({ spaceBaseUrl, manifests });
}
```
<!-- /flavour -->
<!-- flavour nest todo -->
<!-- /flavour -->

## Result

A boot step that tells Space the hash of every manifest, and does nothing when no Space URL is set.

## Next step

Return to the [root reference](./root.md).
