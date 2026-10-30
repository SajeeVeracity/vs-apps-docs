# Provenance

What each claim in these docs rests on.

## Sources

- SDK behaviour rests on the installed `@vectoragents/vs-apps` 0.2.4 dist (compiled output and type declarations) and its README. The SDK source is not available, so a claim never rests on it.
- Every code snippet typechecks against the installed package, except the quickstart's `starter` fences. The starter's CI typechecks those excerpts ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). The stamp at the foot of each page shows the version and date of the last run.
- Space-side claims come from Space-side documentation, except the checks under [Verified in a local Space](#verified-in-a-local-space). This covers registration, the pending review, auto-apply, navigation entries, grants and the configuration sheet.

## SDK gaps

- The SDK declares no `engines` field. The Node 20.19+ minimum in the docs rests on the Vite 8 `engines` field, not on an SDK number.
- The SDK has no framework-free dev routes. The harness dev routes (`/api/__dev/manifests`, `/api/__dev/token`) exist only as a Nest controller, so the harness page carries a hand-written `node:http` handler. The SDK handler replaces it once the SDK ships framework-free dev routes.
- The dev route shapes rest on the compiled dev controller (`nest/platform/controllers/dev-issuer.controller.js`), `server/dev-issuer.js` and the harness component, all in the installed 0.2.4 dist.

## Verified in a local Space

Part 2 of the quickstart is checked in a local Space from the sibling `vector-spaces` repo, through the user interface. Two checks are recorded: publishing the agent of a new space (Add the publish agent step, not recoverable), and sharing the app at View level, so an organization member opens the page and sees `hello:view` (spec, not recoverable). Labels and toasts drift with the Space UI.

## Not recoverable

The `.scratch/` folders `quickstart-review/`, `quickstart-review-build/` and `quickstart-revamp/` no longer exist. Seven tickets and one spec in them are cited below as plain text and marked as not recoverable. The Part 1 Checks, the token hops and the harness changes have no recoverable source record, so re-run the starter to check them.

## Not yet verified

- The Space-side behaviour listed in the [app definition](../docs/app-definition.md) page is a statement of the Space documentation, not an observation.
- No page has run against a hosted Space.

## Quickstart

Rows marked "Starter claim" describe the starter repo. The starter's own CI and record sit outside this repo, so the rows name where the claim came from.

| Claim | Rests on |
| --- | --- |
| Starter claim: `shared/` exports TypeScript source through `exports` and needs no build step: `tsx watch`, Vite dev and `tsc --noEmit` per package all work. | Scratch run in ticket 01, Prove shared package works with no build step (not recoverable). |
| Starter claim: tested versions are `typescript` 7.0.2, `vite` 8.3.5, `tsx` 4.23.15 and `@vectoragents/vs-apps` 0.2.4. | Ticket 01 for all four. Ticket 10, Verify the Part 1 commands and outputs (not recoverable), re-ran `typescript`, `vite` and the SDK from GitHub Packages. It did not record `tsx`. |
| Starter claim: the SDK pin matches the version installed here, and each `starter` excerpt is a verbatim part of its starter file. | The CI job that clones the starter `main` ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). |
| The Part 1 Checks, `npm ls @vectoragents/vs-apps` and the harness run, and their outputs. | A run of the built starter, Build the starter locally (not recoverable). |
| The token hops in the page diagram: the client fetches `/api/client-config`, sends `apps:ready`, receives `apps:token` over `postMessage`, and sends it as `Authorization: Bearer`. Client and server each verify against `SPACE_JWKS_URL`, and only the server check protects data. | The installed 0.2.4 dist, Research the token path for the diagram (not recoverable). Space-side facts, such as the host minting the token and the token lifetimes (user 5 minutes, provisioning 2 minutes), come from the sibling `vector-spaces` repo. A local Space run shows the browser and server lines for the same user. |
| The harness needs three changes beyond the harness page's first steps: `ALLOWED_PARENT_ORIGIN` set to the harness origin, `spaceJwksUrl` set to `/api/__dev/jwks.json`, and server token verification through the dev issuer. | Scratch run on Node 25.9.0 with the installed 0.2.4 SDK, Research the dev harness against the quickstart code (not recoverable). Not run on Node 20.19. |
| The `client-config` route sends no `tokenIssuer`, so the client uses the SDK default `vector-space`, which matches the Space issuer and the dev issuer. | The default from the 0.2.4 dist, Research the token path for the diagram (not recoverable). The Space issuer value is a statement of the Space code, Decide the auto-apply manifest request (not recoverable). |
| The share step: the user joins the space first, **Save changes** commits the share, and a View-level share lets an organization member open the page. | [Verified in a local Space](#verified-in-a-local-space). |

## App definition

| Claim | Rests on |
| --- | --- |
| The flowchart hops: `defineApp` validates on import, `buildManifests` builds the manifest at boot, and the server serves it at the manifest route. | The installed 0.2.4 dist, [Decide the ten-uses list](../.scratch/app-definition-review/issues/04-decide-the-ten-uses-list-against-the-3-phase-lifecycle.md). |
| The SDK does not register handlers from the definition. It acknowledges an unregistered handler as `{ handled: false }` and does not retry it. `buildManifests` sets `eventsUrl` to `<publicBaseUrl>/api/events/<appKey>` unless the definition sets it. | The installed 0.2.4 dist and README, [Decide fixes for defects in the current page](../.scratch/app-definition-review/issues/08-decide-fixes-for-defects-in-the-current-page.md). |
| `defineApp` does not reject unknown top-level keys. It rejects a malformed page key at import. Duplicate page keys are checked in `buildManifests`, not at import. | The installed 0.2.4 dist (`definitionSchema` is not strict, `appPageSchema` checks the key format, `appManifestSchema` checks duplicates), same ticket. |

## Quickstart history

- The page test and commit 03bd8d0 body give the order tour, then run. The commit subject says "clone, run, tour, then register". Trust the body and the test.
- The classic-token claim in Prerequisites rests on GitHub Docs, "Working with the npm registry".
