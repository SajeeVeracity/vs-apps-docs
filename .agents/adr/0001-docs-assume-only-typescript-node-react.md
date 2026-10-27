# Published docs assume only TypeScript, Node and React

The published docs and their examples assume TypeScript 5 with `strict`, Node 20.6+ with `npm`, and React 18+. Vector's own apps use NestJS, Vite and `pnpm`, but an external developer may use none of them, so a page that names one makes that reader translate before they can start. Servers are `node:http` on the SDK's `/server` subpath, clients are plain React files with no bundler named, and installs use `npm`, which ships with Node.

## Considered options

- **Nest as the main path with a plain tab beside it.** Rejected: every page then carries two stacks, and the Nest one is the only one Vector tests.
- **Tabs for each package manager.** Rejected: triples the commands to keep correct. `npm` ships with Node, so the Node guarantee already covers it.
- **Name one bundler as the example.** Rejected: any bundler named reads as a requirement. A reader with an empty folder brings their own.

## Consequences

- One optional recipe page maps each plain step to the `/nest` adapter. It is the only published page allowed to name Nest.
- A guard test bans `Nest`, `NestJS`, `Vite`, `Express`, `Fastify`, `pnpm`, `yarn` and their config in published pages. `.agents/` files are exempt.
- Node 20.6+ is the oldest version where the quickstart's `--env-file` flag works. The SDK declares no `engines` field, so the number has no official source until it adds one.
- The harness dev routes exist only as a Nest controller in the SDK, so the harness page ships a hand-written `node:http` handler until the SDK has a framework-free one.
- The site's own build tooling is outside the rule and keeps Nest and Vite.
