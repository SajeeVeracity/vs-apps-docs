# Provenance

What each claim in these docs rests on. A ticket or spec named below without a link rests on a `.scratch/` folder that no longer exists, so the claim cannot be traced further.

## Sources

- SDK behaviour rests on the installed `@vectoragents/vs-apps` 0.2.4 dist (compiled output and type declarations) and its README. The SDK source is not available, so a claim never rests on it.
- Every code snippet typechecks against the installed package, except the quickstart's `starter` fences. The starter's CI typechecks those excerpts ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). The stamp at the foot of each page shows the version and date of the last run.
- Space-side claims come from Space-side documentation, except the checks under [Verified in a local Space](#verified-in-a-local-space). This covers registration, the pending review, auto-apply, navigation entries, grants and the configuration sheet.

## SDK gaps

- The SDK declares no `engines` field. The docs name the current Node.js LTS release, which the starter CI tests (`lts/*`). Vite 8 accepts every LTS from 22.12.
- The SDK has no framework-free dev routes. The harness dev routes (`/api/__dev/manifests`, `/api/__dev/token`) exist only as a Nest controller, so the harness page carries a hand-written `node:http` handler. The SDK handler replaces it once the SDK ships framework-free dev routes.
- The dev route shapes rest on the compiled dev controller (`nest/platform/controllers/dev-issuer.controller.js`), `server/dev-issuer.js` and the harness component, all in the installed 0.2.4 dist.

## Verified in a local Space

Part 2 of the quickstart is checked in a local Space from the sibling `vector-spaces` repo, through the user interface. Three checks are recorded.

- Publishing the agent of a new space (Add the publish agent step).
- The Organization admin route to that publish: **Settings**, **Organization**, **Spaces**, then the space. After it, an Edit member sees the space in the switcher.
- Sharing the app at View level, so an organization member opens the page and sees `hello:view` (spec).

Labels and toasts drift with the Space UI.

## Not yet verified

- The Space-side behaviour listed in the [app definition](../docs/app-definition.md) page is a statement of the Space documentation, not an observation.
- No page has run against a hosted Space.

## Quickstart

Rows marked "Starter claim" describe the starter repo. The starter's own CI and record sit outside this repo, so the rows name where the claim came from.

| Claim | Rests on |
| --- | --- |
| Starter claim: `shared/` exports TypeScript source through `exports` and needs no build step: `tsx watch`, Vite dev and `tsc --noEmit` per package all work. | Scratch run in ticket 01, Prove shared package works with no build step. |
| Starter claim: tested versions are `typescript` 7.0.2, `vite` 8.3.5, `tsx` 4.23.15 and `@vectoragents/vs-apps` 0.2.4. | Ticket 01 for all four. Ticket 10, Verify the Part 1 commands and outputs, re-ran `typescript`, `vite` and the SDK from GitHub Packages. It did not record `tsx`. |
| Starter claim: the SDK pin matches the version installed here, and each `starter` excerpt is a verbatim part of its starter file. | The CI job that clones the starter `main` ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). |
| The Part 1 Checks, `npm ls @vectoragents/vs-apps` and the harness run, and their outputs. | A run of the built starter, Build the starter locally. |
| The token hops in the page diagram: the client fetches `/api/client-config`, sends `apps:ready`, receives `apps:token` over `postMessage`, and sends it as `Authorization: Bearer`. Client and server each verify against `SPACE_JWKS_URL`, and only the server check protects data. | The installed 0.2.4 dist, Research the token path for the diagram. Space-side facts, such as the host minting the token and the token lifetimes (user 5 minutes, provisioning 2 minutes), come from the sibling `vector-spaces` repo. A local Space run shows the browser and server lines for the same user. |
| The harness needs three changes beyond the harness page's first steps: `ALLOWED_PARENT_ORIGIN` set to the harness origin, `spaceJwksUrl` set to `/api/__dev/jwks.json`, and server token verification through the dev issuer. | Scratch run on Node 25.9.0 with the installed 0.2.4 SDK, Research the dev harness against the quickstart code. Not run on an LTS release. |
| The `client-config` route sends no `tokenIssuer`, so the client uses the SDK default `vector-space`, which matches the Space issuer and the dev issuer. | The default from the 0.2.4 dist, Research the token path for the diagram. The Space issuer value is a statement of the Space code, Decide the auto-apply manifest request. |
| The classic-token claim in Prerequisites. | GitHub Docs, "Working with the npm registry". |
| The share step: the user joins the space first, **Save changes** commits the share, and a View-level share lets an organization member open the page. | [Verified in a local Space](#verified-in-a-local-space). |
| Step 4: Space treats a status outside 200 to 299, no reply within 10 seconds, or a network error on `POST /api/provision` as a failure, and the add fails. | Space code, not observed: `provisionSpace` in `vector-spaces` `apps/server/src/domain/vector-apps/provisioning/services/vector-apps-client.service.ts` fails on `!res.ok`, and its `FETCH_TIMEOUT_MS` is 10 seconds, passed to `edgeFetch` as a write (one attempt, no retry). |

## App definition

| Claim | Rests on |
| --- | --- |
| The flowchart hops: `defineApp` validates on import, `buildManifests` builds the manifest at boot, and the server serves it at the manifest route. | The installed 0.2.4 dist, [Decide the ten-uses list](../.scratch/app-definition-review/issues/04-decide-the-ten-uses-list-against-the-3-phase-lifecycle.md). |
| The SDK does not register handlers from the definition. It acknowledges an unregistered handler as `{ handled: false }` and does not retry it. `buildManifests` sets `eventsUrl` to `<publicBaseUrl>/api/events/<appKey>` unless the definition sets it. | The installed 0.2.4 dist and README, [Decide fixes for defects in the current page](../.scratch/app-definition-review/issues/08-decide-fixes-for-defects-in-the-current-page.md). |
| `defineApp` does not reject unknown top-level keys. It rejects a malformed page key at import. Duplicate page keys are checked in `buildManifests`, not at import. | The installed 0.2.4 dist (`definitionSchema` is not strict, `appPageSchema` checks the key format, `appManifestSchema` checks duplicates), same ticket. |

## Reference

| Claim | Rests on |
| --- | --- |
| The `root` and `agent-react` prerequisites pin `zod@3`: a zod 4 schema gives an empty `paramsJsonSchema`. | The SDK depends on `zod ^3.25.76` and converts with `zod-to-json-schema` (`agentActionToCatalogAction`, `agent-catalog/definitions.js`). A zod 4.5.4 schema through that converter gave a draft-07 stub with no `properties`, [research 01, E1](../.scratch/recipes-review/research/01-recipe-claims-vs-sdk.md). |
| The SDK puts an action and a page `description` in the manifest, and the bridge attaches the mounted actions to each successful dispatch. The pages claim nothing about how the Space agent uses them. | The installed 0.2.4 dist (`server/manifest.js`, `agent-catalog/definitions.js`, `agent-catalog/react.js`). The Space agent prompt is Space-side and not read, [research 01, E6 and E10](../.scratch/recipes-review/research/01-recipe-claims-vs-sdk.md). |
| `pingSpaceManifests` posts `{ appKey, manifestHash }` to `{spaceBaseUrl}/api/apps/manifest-ping`, retries at 0, 5 and 15 seconds, stops on 2xx or 429, and never throws. | The installed 0.2.4 dist (`server/manifest.js`, `types/server/manifest.d.ts`). What Space does with the ping is Space-side and not observed. |

## Guides

| Claim | Rests on |
| --- | --- |
| A slot that no one set answers `409` with `AI_SLOT_NOT_READY`, and a slot key that the manifest does not declare answers `400`. `createSpaceAiConfigProvider` throws a `SpaceActionError` that carries the status. | Space code, not observed: `app-s2s-exchange.service.ts` in `vector-spaces` `apps/server/src/domain/vector-apps/backchannel/services/`, [ticket 21, Comments](../.scratch/recipes-review/issues/21-guide-pair-call-a-model-from-your-server.md). The `SpaceActionError` status rests on the installed 0.2.4 dist. No call to a live Space was run. |
| Space delivers each connector event at least once, up to three times. | Space code, not observed: the connector event dispatch queue takes the shared job defaults (`attempts: 3`, exponential back-off) in `packages/core/src/kernel/messaging/queues/constants/queue-defaults.constant.ts`, and the redrive service in `vector-spaces` `domain/context-hub/connectors/webhooks/redrive/` names a "three-attempt backoff". [Ticket 19, Comments](../.scratch/recipes-review/issues/19-nest-guide-handle-connector-events.md) records that event routing is not run end to end. |
| The A2A route answers `401` for a missing, invalid or wrong-scope token, and `403` for a token that names another space or app. | The installed 0.2.4 dist (`assertSpaceS2s` in `server/index.js`). The check is [ticket 22, Comments](../.scratch/recipes-review/issues/22-guide-expose-app-as-a2a-agent.md). The `401` with no token is the only status the guide asks the reader to observe. |
| Space creates a service secret for each pair of app and space and pushes it in the body of `POST /api/provision`, where the starter route drops it. | Space code, not observed: `provisionSpace` in `vector-spaces` `apps/server/src/domain/vector-apps/provisioning/services/vector-apps-client.service.ts` posts `{ serviceSecret }` under a provisioning token. The starter behaviour rests on [ticket 21, Comments](../.scratch/recipes-review/issues/21-guide-pair-call-a-model-from-your-server.md) and [ticket 20, Comments](../.scratch/recipes-review/issues/20-guide-pair-call-space-from-your-server.md). |
