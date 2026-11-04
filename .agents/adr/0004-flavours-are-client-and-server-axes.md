# Flavours are client and server axes with URL trees, markers and per-pair search

Supersedes [ADR 0001](0001-docs-assume-only-typescript-node-react.md).

The published docs assume TypeScript 5 with `strict`, Node 20.19+ and `npm` for every reader, and nothing else. Beyond that baseline the docs offer flavours. A flavour is one value of an axis: on the client axis `react`; on the server axis `node` (Node.js + TypeScript) and `nest` (Nest.js). The reader picks one flavour per axis, a pair, and the pick shapes the URL of every page that differs by flavour. A second client framework or a Python server fits by adding a flavour name, a template directory in the starter and blocks in the pages. Vector's own apps use Vite and `pnpm`; an external developer may use neither, so no page assumes them.

## Decision

- **Markers.** One source page per topic under `docs/`. Text between `<!-- flavour <name> -->` and `<!-- /flavour -->` belongs to one flavour. `<!-- flavour <name> todo -->` marks a block nobody has written. Blocks do not nest, and prose outside blocks is shared.
- **Generator.** `scripts/generate.mjs` reads the source pages and `flavours.config.json` and writes the published tree to `docs-gen/`. It runs first in `pnpm check`, and before `pnpm build` and `pnpm start`.
- **URL rule.** A page's URL carries the axes its blocks use: `/<server>/...`, `/<client>/...`, `/<client>/<server>/...`, or no prefix for a neutral page. A page is emitted once per value combination of those axes. Flavour names are lowercase and differ across axes and from doc folders, so the first URL segment is unambiguous.
- **Stubs and links.** A flavoured page also has a flavourless stub at its old address, which carries its sidebar entry. Authors write relative links. Inside a tree they point into the same tree, except to a page that uses an axis the tree lacks, which gets the stub. A neutral page keeps links to the stub.
- **Saved choice.** The choice lives in `localStorage`, applies only on flavourless URLs, and starts as `react` + `node`. A shared link always wins and overwrites it.
- **Search.** One index per pair, scoped with `searchContextByPaths` through a local wrapper plugin. The search plugin version is pinned because the wrapper imports its internals. A test after `docusaurus build` checks each index.
- **Gaps.** A `todo` block renders a visible notice with a link to the written flavour. `flavours.config.json` holds a cap on `todo` blocks, and `pnpm check` fails above it.
- **Marker errors fail the generator.** An unclosed or nested block, an unknown flavour, and a flavoured page with no block or `todo` for a flavour of an axis it uses.

## Considered options

- **Tabs for the flavours.** Rejected: a tab is local to its page, so the choice does not reach the next page, the first paint shows the default flavour, and a link cannot carry the choice.
- **Tabs for each package manager.** Rejected: triples the commands to keep correct. `npm` ships with Node, so the Node guarantee already covers it.
- **Leave the bundler to the reader.** Rejected for the quickstart: the reader scaffolds a starter that ships Vite already wired, so the reader never picks a bundler ([ADR 0003](0003-quickstart-runs-create-app-from-github-packages.md)). Other pages say "your bundler".
- **Single package with client and server in one `src/`.** Rejected for the quickstart: Vite and Node need different `tsconfig` settings, so the app definition would be copied or imported across folders.

## Consequences

- Node.js pages use `node:http` on the SDK's `/server` subpath. Nest pages use `/nest`. Nest.js is an equal server flavour, so a page names Nest in a `nest` block and `docs/nest/` goes away.
- The guard test bans `Vite`, `Express`, `Fastify`, `pnpm` and `yarn` in published pages, with the quickstart's Vite allowance. `.agents/` files are exempt. The guard no longer sees a flavour term in neutral prose or in another flavour's block.
- Node 20.19+ is the oldest version that Vite 8 supports, and it is newer than 20.6, where `--env-file` starts to work. The SDK declares no `engines` field, so the number has no SDK source.
- The harness dev routes exist only as a Nest controller in the SDK. The harness page ships a hand-written `node:http` handler until the SDK has a framework-free one, and the Nest template sets `devIssuer` from `VA_DEV_ISSUER`.
- The quickstart starter is an npm-workspaces monorepo with `client/`, `server/` and `shared/`. Other pages show single files and make no layout claim.
- The site's own build tooling is outside the rule and keeps Nest and Vite.
- Every `todo` block is a visible gap, so a pair with no written block still opens and shows notices that count against the cap.
