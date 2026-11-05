# vs-apps-docs

Docusaurus documentation site for `@vectoragents/vs-apps`. `docs/` holds the source pages. `scripts/generate.mjs` turns them into `docs-gen/`, which Docusaurus publishes. `scripts/` also holds the snippet typecheck.

## Agent skills

### Issue tracker

Issues and specs are local markdown under `.scratch/<feature>/`. See `.agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `.agents/triage-labels.md`.

### Domain docs

Single-context: `docs/glossary.md` plus `.agents/adr/`. See `.agents/domain.md`.

### Writing language

Language rules for `docs/`: simple English, defined abbreviations, numeric limits. See `.agents/writing-language.md`.

## Runbooks and sibling repos

- Register an app in a Space as Vector staff: `.agents/staff-registration.md`.
- Run a local Space and drive its UI: `.agents/local-space.md`.
- Write a page that differs by client or server flavour (axis, flavour, pair, `<!-- flavour <name> -->` blocks): `.agents/flavours.md`. Config: `flavours.config.json`.
- Master docs: `../vector-spaces/docs` is the source of truth for Vector Space behaviour and shared terms. It is written for the Vector Space team and is dense, so read the entry points and never copy from it. Start at `product/OVERVIEW.md` and `product/GLOSSARY.md`, then `systems/apps/` for Vector Apps (`README.md`, `REGISTRY.md`, `BINDINGS.md`, `PROTOCOL.md`, `SDK.md`). `docs/CLAUDE.md` there says where the rest lives. Published pages here are the simplified outside version, and `.agents/provenance.md` names the master doc each claim rests on. The master docs are not published, so a page never names them.
- Reference material: [Vector Spaces Field Guide](https://claude.ai/artifact/9CxaYn29Mv8CSZY6orKdpd) (internal, Draft v1, 30 Sep 2026). It covers what Spaces and Vector Apps are, their building blocks and the integration model, for sales and the Core Team. Background only: a published page never cites it.
- Sibling repos: `../vector-spaces` (the Space, owns its start commands) and `../vector-app-quickstart` (the templates and CLI the quickstart runs).
- Commit gate: `pnpm check` (its first step, `pnpm generate`, fails on a marker error or on `todo` blocks above `todoCap`), run by `.githooks/pre-commit` (skipped for merge commits) and CI. `pnpm check:snippets` typechecks neutral pages once from `docs/`, and flavoured pages from `docs-gen/` with one `tsc` project per pair (`react+node`, `react+nest`; Nest adds both decorator flags). Recipe and guide snippet titles start with `client/`, `server/` or `shared/`, checked on the source pages.
- Page tests import shared helpers (`section`, `snippetsOf`, `titledSnippets`, `codeOf`, `linksOf`, `nextLinks`, `treesOf`) from `scripts/page-helpers.mjs`. `treesOf(source)` returns `{ tree, text }` for each generated tree of a source page (one entry, `tree` '', for a neutral page): run the same assertions on every entry. It needs `pnpm generate` first.
- `pnpm test:build` runs after `pnpm build`: the per-pair search indexes (`src/plugins/search-per-pair.mjs`), checked on the built site and on a small fixture site under `scripts/build-check/`.
- `STARTER_DIR=<path> pnpm check:starter` runs the starter's CLI from a local starter checkout, once per pair (`client+server`), and checks the pages against each generated project. Without it, the published `@vectoragents/create-app` runs against `STARTER_REF` (default `main`). Package name and repo: `scripts/starter-source.mjs`. A page asks for the overlay with `start: leads-app` in front matter.
