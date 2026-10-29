# The quickstart clones a starter repo

The quickstart tells the reader to clone a working app from the starter repo, run it in the harness, then read its code in a tour of excerpts. The reader edits no file in Part 1. A clone gives a running app at once, where an empty folder needs four `package.json` files, four `tsconfig` files, `.npmrc` and `.gitignore` first. The repo's target home is `VectorAgents/vector-app-quickstart`, owned by Vector. Until the move it lives under the `SajeeVeracity` GitHub account. The clone URL is the single value `STARTER_URL` in `scripts/starter-url.mjs`, shared by the page, its test and CI. The ref is `main`.

## Considered options

- **The reader builds the app from an empty folder.** Rejected: the reader spends most of the page on configuration instead of the token path.
- **Manual setup beside the clone, as a second path or behind a collapsible block.** Rejected: two paths double the commands to keep correct, and only the clone path has CI.
- **A `starter` branch or a release tag.** Rejected: `main` holds the full working app, so no second ref has to stay in step with it.

## Consequences

- The starter holds the full app with the harness wired, so `npm run dev` needs no `.env`. Its own CI runs `npm install` and `npm run typecheck`.
- The page and the starter live in two repos, so they can drift. A CI job in this repo clones the starter `main` and fails when any of these hold:
  - The starter's pinned SDK version differs from the SDK version installed here.
  - A page `starter` fence is not a verbatim substring of its starter file.
  - A path in the page's directory tree is missing from the starter.
- A starter commit can fail this repo's CI with no change here, and a page edit to an excerpt can need a starter commit first.
- `scripts/check-snippets.mjs` skips every `starter` fence and leaves it out of the `snippets` count. The starter's CI typechecks those excerpts instead. Every other page is still typechecked here.
- Part 1 has two Checks: `npm ls @vectoragents/vs-apps` after install, and the harness run. The page shows excerpts of the starter and the reader edits no file.
- The starter repo is public from its first push, so the clone takes no credential. The URL value changes once, in `scripts/starter-url.mjs`, at the move.
- The harness reference is a manual-wiring guide for an app that is not built from the starter.
