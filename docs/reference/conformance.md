---
title: Conformance reference
---

Reference for `@vectoragents/vs-apps/conformance` 0.4.0. The subpath is a test kit for your server. A fake [Space](../glossary.md#space) signs every kind of token, and a list of cases drives the routes that Space calls on your server and checks each answer. The cases hold one rule each, such as refusing a token that Space did not sign.

Every symbol below follows one layout: signature, behaviour, example. Each example is a complete file and is typechecked against the installed package.

## Prerequisites

- `@vectoragents/vs-apps` installed with a registry token.
- Node.js and a test runner. The fake Space listens on a local port, so the subpath does not run in a browser.
- A server that serves the routes of the app platform, from `createAppPlatform` or from the Nest module.

## `startFakeVectorSpace`

Starts a fake Space on a local port.

### Signature

```typescript
function startFakeVectorSpace(options?: { issuer?: string }): Promise<FakeVectorSpace>;

interface FakeVectorSpace {
  baseUrl: string;
  jwksUrl: string;
  issuer: string;
  sign(request: DevTokenRequest): Promise<string>;
  signForeign(request: DevTokenRequest): Promise<string>;
  readonly pings: readonly ManifestPingInput[];
  dispose(): Promise<void>;
}
```

| Field | Meaning |
| --- | --- |
| `baseUrl` | The origin of the fake Space. Use it as the `spaceBaseUrl` of your server. |
| `jwksUrl` | The key set that your server verifies tokens against. Use it as the `spaceJwksUrl`. |
| `issuer` | The `iss` claim of every token. Use it as the `tokenIssuer`. |
| `sign` | Signs a token with the key that `jwksUrl` publishes. |
| `signForeign` | Signs a token with a key that `jwksUrl` does not publish, for a test that expects a refusal. |
| `pings` | The manifest pings that your server sent, oldest first. |

### Behaviour

- Listens on an ephemeral port of `127.0.0.1`.
- Publishes the key set, signs the six token kinds with the claims and lifetimes that Space uses, and records manifest pings.
- Answers `404` to every other path, so a server that calls Space for anything else fails in the test.
- `dispose` closes the port. Call it after the last case.

## `appPlatformConformance`

Returns the cases that an app platform must pass.

### Signature

```typescript
function appPlatformConformance(target: AppPlatformConformanceTarget): ConformanceCase[];

interface AppPlatformConformanceTarget {
  baseUrl: string;
  space: FakeVectorSpace;
  appKey: string;
  storedSecret(appId: string, spaceId: number): Promise<string | null>;
  handlers?: {
    event?: { slot: string; handler: string };
    failingEvent?: { slot: string; handler: string };
    askDecision?: boolean;
  };
}

interface ConformanceCase {
  name: string;
  run(): Promise<void>;
}
```

| Field | Meaning |
| --- | --- |
| `baseUrl` | The origin of your server plus the prefix of the platform routes, for example `http://127.0.0.1:4000/api`. |
| `appKey` | An app key that your server hosts. |
| `storedSecret` | Reads the secret that your credential store holds for an app and a space. |
| `handlers` | The handlers that your server registered for the kit. A case that needs one runs only when you name it. |

### Behaviour

- Each case is a protocol rule. `run` throws when your server breaks it, and needs no test runner of its own.
- The cases cover the manifest route, provisioning, the client config, connector events and ask decisions. They check the status for a missing token, a token that Space did not sign, a token of the wrong kind, and a token for another space or app.
- Read `target.space.baseUrl` and `target.space.jwksUrl` into the settings of your server before you boot it. The list exists before the server is up, so `baseUrl` may be set later.
- Pass `handlers.event` when your server registers an event handler that resolves, and `handlers.failingEvent` for one that throws. The kit then checks that the first is acknowledged as handled and that the second answers `500`, so Space retries.
- Run one test for each case, so a failure names the rule.

### Example

```ts title="test/conformance.test.ts"
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, it } from 'node:test';
import { defineApp } from '@vectoragents/vs-apps';
import { appPlatformConformance, startFakeVectorSpace, type FakeVectorSpace } from '@vectoragents/vs-apps/conformance';
import { buildManifests, createAppPlatform } from '@vectoragents/vs-apps/server';

const definition = defineApp({
  key: 'hello-app',
  version: '0.1.0',
  pages: [{ key: 'home', label: 'Home', path: '/' }],
  capabilities: [],
});

const secrets = new Map<string, string>();
const manifests = buildManifests([definition], { catalog: undefined, publicBaseUrl: 'http://localhost' });

let space: FakeVectorSpace;
let server: Server;
const target = {
  baseUrl: '',
  space: undefined as unknown as FakeVectorSpace,
  appKey: definition.key,
  storedSecret: async (appId: string, spaceId: number) => secrets.get(`${appId}:${spaceId}`) ?? null,
};

before(async () => {
  space = await startFakeVectorSpace();
  const platform = createAppPlatform({
    options: { spaceBaseUrl: space.baseUrl, spaceJwksUrl: space.jwksUrl, tokenIssuer: space.issuer, allowedParentOrigin: 'http://localhost' },
    manifests,
    credentialStore: {
      upsert: async (appId, spaceId, secret) => void secrets.set(`${appId}:${spaceId}`, secret),
      remove: async (appId, spaceId) => void secrets.delete(`${appId}:${spaceId}`),
      get: async (appId, spaceId) => secrets.get(`${appId}:${spaceId}`) ?? null,
    },
  });
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const method = req.method ?? 'GET';
    const response = await platform.fetch(
      new Request(`http://127.0.0.1${req.url}`, {
        method,
        headers: req.headers as Record<string, string>,
        body: method === 'GET' ? undefined : Buffer.concat(chunks),
      }),
    );
    res.writeHead(response?.status ?? 404, Object.fromEntries(response?.headers ?? []));
    res.end(response ? Buffer.from(await response.arrayBuffer()) : undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  target.space = space;
  target.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  server.close();
  await space.dispose();
});

for (const { name, run } of appPlatformConformance(target)) it(name, run);
```

## Result

A test file that boots your platform against a fake Space and runs one test for each protocol rule.

## Next step

Return to the [root reference](./root.md).
