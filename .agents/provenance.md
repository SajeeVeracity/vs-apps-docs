# Provenance

What each claim in these docs rests on.

## Sources

- SDK behaviour rests on the installed `@vectoragents/vs-apps` 0.2.4 dist (compiled output and type declarations) and its README. The SDK source is not available, so a claim never rests on it.
- Every code snippet typechecks against the installed package. The stamp at the foot of each page shows the version and date of the last run.
- Space-side claims come from Space-side documentation. This covers registration, the pending review, auto-apply, navigation entries, grants and the configuration sheet.

## SDK gaps

- The SDK declares no `engines` field. The Node 20.19+ minimum in the docs rests on the Vite 8 `engines` field, not on an SDK number.
- The SDK has no framework-free dev routes. The harness dev routes (`/api/__dev/manifests`, `/api/__dev/token`) exist only as a Nest controller, so the harness page carries a hand-written `node:http` handler. The SDK handler replaces it once the SDK ships framework-free dev routes.
- The dev route shapes rest on the compiled dev controller (`nest/platform/controllers/dev-issuer.controller.js`), `server/dev-issuer.js` and the harness component, all in the installed 0.2.4 dist.

## Not yet verified in a real Space

No page has been walked through in a real Space, including the `node:http` quickstart. Quickstart step 4 and step 6, the Space UI labels, and the Space-side behaviour listed in the [app definition](../docs/app-definition.md) page are statements of the Space documentation, not observations.
