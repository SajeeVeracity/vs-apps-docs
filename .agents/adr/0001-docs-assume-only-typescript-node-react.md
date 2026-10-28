# Published docs assume only TypeScript, Node and React

The published docs and their examples assume TypeScript 5 with `strict`, Node 20.19+ with `npm`, and React 18+. Vector's own apps use NestJS, Vite and `pnpm`, but an external developer may use none of them, so a page that names one makes that reader translate before they can start. Servers are `node:http` on the SDK's `/server` subpath, clients are plain React files, and installs use `npm`, which ships with Node.

## Considered options

- **Nest as the main path with a plain tab beside it.** Rejected: every page then carries two stacks, and the Nest one is the only one Vector tests.
- **Tabs for each package manager.** Rejected: triples the commands to keep correct. `npm` ships with Node, so the Node guarantee already covers it.
- **Leave the bundler to the reader.** Rejected for the quickstart: a reader with an empty folder has none, and without a `dev:client` script the ports in `.env` need a second, manual entry in the bundler config. The quickstart uses Vite, with `dev:client` loading `.env` like `dev:server`. Other pages say "your bundler".
- **Single package with client and server in one `src/`.** Rejected for the quickstart: Vite and Node need different `tsconfig` settings, so the app definition would be copied or imported across folders.

## Consequences

- One optional recipe page maps each plain step to the `/nest` adapter. It is the only published page allowed to name Nest.
- A guard test bans `Nest`, `NestJS`, `Vite`, `Express`, `Fastify`, `pnpm`, `yarn` and their config in published pages. `.agents/` files are exempt. The quickstart may name Vite, and the Nest page may name Nest.
- Node 20.19+ is the oldest version that Vite 8 supports, and it is newer than 20.6, where `--env-file` starts to work. The SDK declares no `engines` field, so the number has no SDK source.
- The harness dev routes exist only as a Nest controller in the SDK, so the harness page ships a hand-written `node:http` handler until the SDK has a framework-free one.
- The quickstart uses an npm-workspaces monorepo with `client/`, `server/` and `shared/`, and `tsx` runs the server. Other pages show single files and make no layout claim.
- The site's own build tooling is outside the rule and keeps Nest and Vite.
