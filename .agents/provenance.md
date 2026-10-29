# Provenance

What each claim in these docs rests on.

## Sources

- SDK behaviour rests on the installed `@vectoragents/vs-apps` 0.2.4 dist (compiled output and type declarations) and its README. The SDK source is not available, so a claim never rests on it.
- Every code snippet typechecks against the installed package, except the quickstart's `starter` fences. The starter's CI typechecks those excerpts ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). The stamp at the foot of each page shows the version and date of the last run.
- Space-side claims come from Space-side documentation. This covers registration, the pending review, auto-apply, navigation entries, grants and the configuration sheet.

## SDK gaps

- The SDK declares no `engines` field. The Node 20.19+ minimum in the docs rests on the Vite 8 `engines` field, not on an SDK number.
- The SDK has no framework-free dev routes. The harness dev routes (`/api/__dev/manifests`, `/api/__dev/token`) exist only as a Nest controller, so the harness page carries a hand-written `node:http` handler. The SDK handler replaces it once the SDK ships framework-free dev routes.
- The dev route shapes rest on the compiled dev controller (`nest/platform/controllers/dev-issuer.controller.js`), `server/dev-issuer.js` and the harness component, all in the installed 0.2.4 dist.

## Not yet verified in a real Space

No page has been walked through in a real Space, including the `node:http` quickstart. Quickstart Part 1 step 4 and step 5, Part 2, the Space UI labels, and the Space-side behaviour listed in the [app definition](../docs/app-definition.md) page are statements of the Space documentation, not observations.

## Quickstart

Rows marked "Starter claim" describe the starter repo. The starter's own CI and record sit outside this repo, so the rows name where the claim came from.

| Claim | Rests on |
| --- | --- |
| Starter claim: `shared/` exports TypeScript source through `exports` and needs no build step: `tsx watch`, Vite dev and `tsc --noEmit` per package all work. | Scratch run in ticket 01, [Prove shared package works with no build step](../.scratch/quickstart-revamp/issues/01-prove-shared-no-build.md). |
| Starter claim: tested versions are `typescript` 7.0.2, `vite` 8.3.5, `tsx` 4.23.15 and `@vectoragents/vs-apps` 0.2.4. | Ticket 01 for all four. Ticket 10, [Verify the Part 1 commands and outputs](../.scratch/quickstart-revamp/issues/10-verify-part-1-commands.md), re-ran `typescript`, `vite` and the SDK from GitHub Packages. It did not record `tsx`. |
| Starter claim: the SDK pin matches the version installed here, and each `starter` excerpt is a verbatim part of its starter file. | The CI job that clones the starter `main` ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). |
| The Part 1 Checks, `npm ls @vectoragents/vs-apps` and the harness run, and their outputs. | A run of the built starter, [Build the starter locally](../.scratch/quickstart-review-build/issues/01-build-starter-locally.md). |
| The token hops in the page diagram: the client fetches `/api/client-config`, sends `apps:ready`, receives `apps:token` over `postMessage`, and sends it as `Authorization: Bearer`. Client and server each verify against `SPACE_JWKS_URL`, and only the server check protects data. | The installed 0.2.4 dist, [Research the token path for the diagram](../.scratch/quickstart-review/issues/02-research-token-path.md). Space-side facts, such as the host minting the token and the token lifetimes (user 5 minutes, provisioning 2 minutes), come from the sibling `vector-spaces` repo. No run against a real Space. |
| The harness needs three changes beyond the harness page's first steps: `ALLOWED_PARENT_ORIGIN` set to the harness origin, `spaceJwksUrl` set to `/api/__dev/jwks.json`, and server token verification through the dev issuer. | Scratch run on Node 25.9.0 with the installed 0.2.4 SDK, [Research the dev harness against the quickstart code](../.scratch/quickstart-review/issues/01-research-harness-against-quickstart.md). Not run on Node 20.19 or in a real Space. |
| The `client-config` route sends no `tokenIssuer`, so the client uses the SDK default `vector-space`, which matches the Space issuer and the dev issuer. | The default from the 0.2.4 dist, [Research the token path for the diagram](../.scratch/quickstart-review/issues/02-research-token-path.md). The Space issuer value is a statement of the Space code, [Decide the auto-apply manifest request](../.scratch/quickstart-review/issues/11-decide-auto-apply-manifest.md). |
