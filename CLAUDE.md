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
- Sibling repos: `../vector-spaces` (the Space, owns its start commands) and `../vector-app-quickstart` (the starter the quickstart clones).
- Commit gate: `pnpm check` (its first step, `pnpm generate`, fails on a marker error or on `todo` blocks above `todoCap`), run by `.githooks/pre-commit` (skipped for merge commits) and CI. Recipe, guide and Nest snippet titles start with `client/`, `server/` or `shared/`.
- Page tests import shared helpers (`section`, `snippetsOf`, `titledSnippets`, `codeOf`, `linksOf`, `nextLinks`) from `scripts/page-helpers.mjs`.
- `STARTER_DIR=<path> pnpm check:starter` checks the pages against a local starter checkout instead of cloning main.
