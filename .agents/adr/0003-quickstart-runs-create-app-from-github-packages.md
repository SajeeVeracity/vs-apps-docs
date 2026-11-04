# The quickstart runs `@vectoragents/create-app` from GitHub Packages

Supersedes [ADR 0002](0002-quickstart-clones-a-starter-repo.md).

The quickstart tells the reader to run a command, `npm create @vectoragents/app`, which scaffolds a working app from the starter repo. The reader runs it in the harness, then reads its code in a tour of excerpts. The reader edits no file in Part 1. A scaffold gives a running app at once, where an empty folder needs four `package.json` files, four `tsconfig` files, `.npmrc` and `.gitignore` first. The command takes a client flavour and a server flavour ([ADR 0004](0004-flavours-are-client-and-server-axes.md)), so one starter serves every pair.

The starter repo is `VectorAgents/vector-app-quickstart`, owned by Vector. It holds templates, one directory per flavour, and the command-line interface (CLI) package `@vectoragents/create-app`. The package name and the repo are the values `CLI_PACKAGE` and `STARTER_REPO` in `scripts/starter-source.mjs`, shared by the page, its test and CI. The CLI downloads the templates from `main` of the starter when it runs. The flag `--ref <ref>` selects another ref, and a local template path replaces the download.

## Considered options

- **The reader builds the app from an empty folder.** Rejected: the reader spends most of the page on configuration instead of the token path.
- **Manual setup beside the scaffold, as a second path or behind a collapsible block.** Rejected: two paths double the commands to keep correct, and only the scaffold path has CI.
- **A `starter` branch or a release tag.** Rejected: `main` holds the templates, so no second ref has to stay in step with it.
- **Publish `create-vector-app` on public npm.** Rejected: a scoped name needs the owner of the `@vectoragents` scope on npmjs.com, so the name would be unscoped, and the first publish would come from a personal account. GitHub Packages names the package `@vectoragents/create-app`, owned by the `VectorAgents` org, and a GitHub Actions workflow publishes it with `GITHUB_TOKEN`, from the first release. The reader already needs a `read:packages` token for the SDK, which is also on GitHub Packages, so no new credential appears.
- **Clone-then-prune.** The reader clones the whole starter and runs a script that moves the chosen flavour directories to `client/` and `server/` and deletes the rest. Rejected: the reader gets every flavour on disk and runs a deletion script before the first run. The CLI writes only the chosen pair.

## Consequences

- The starter holds templates and a CLI. The generated project has the harness wired, so `npm run dev` needs no `.env`. The starter's own CI generates every pair with and without the overlay, then runs `npm install`, `npm run typecheck`, the tests, and boots each server in `dev` and `dev:space`.
- The page and the starter live in two repos, so they can drift. A CI job in this repo runs the CLI once per pair against a generated project and fails when any of these hold:
  - The generated project pins an SDK version that differs from the SDK version installed here.
  - A page `starter` code block is not a verbatim substring of its generated file.
  - A path in the page's directory tree is missing from the generated project.
  - The start overlay a page names with `start: leads-app` in its front matter is missing from the starter.
  - A page uses an environment variable that the generated `.env.example` and `.npmrc` lack and the page does not set.
  - A flavour that a block names has no template whose `flavour.json` names it, or a server template has no block or `todo` on a flavoured page.
- The starter's overlay drift test fails when an overlay file differs from its template file outside the four files the overlay replaces.
- A starter commit can fail this repo's CI with no change here, and a page edit to an excerpt can need a starter commit first.
- The CLI version is independent of the templates. A new flavour is a new template directory with a `flavour.json`, with no CLI release. The CLI refuses an unknown `schemaVersion` and tells the reader to run `npm create @vectoragents/app@latest`.
- `scripts/check-snippets.mjs` skips every `starter` code block and leaves it out of the `snippets` count. The starter's CI typechecks those excerpts instead. Every other page is still typechecked here.
- Part 1 has two Checks: `npm ls @vectoragents/vs-apps` after install, and the harness run. The page shows excerpts of the generated project and the reader edits no file.
- The starter repo is public. The CLI package is on GitHub Packages and needs a token with the `read:packages` scope, which step 0 of the quickstart sets up in the user-level `~/.npmrc`. The package must be readable by the same token as the SDK, including for a reader with no access to the starter repo. If it is not, the package access is granted in the org package settings.
- The harness reference is a manual-wiring guide for an app that is not built from the starter.
