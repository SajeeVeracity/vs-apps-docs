# Flavour pages

How to write a page that differs by flavour. Terms: axis, flavour, pair, flavour block and neutral page in `.agents/glossary-internal.md`. Decision: [ADR 0004](adr/0004-flavours-are-client-and-server-axes.md).

## Markers

```md
<!-- flavour node -->
...text for Node.js + TypeScript...
<!-- /flavour -->

<!-- flavour nest todo -->
<!-- /flavour -->
```

- Each marker sits alone on its line. Blocks do not nest.
- A page that uses an axis needs a block or a `todo` block for every flavour of that axis.
- A page-level `react` block wraps the body of a client-only page. A `react` block may sit next to server blocks.
- Prose, the app definition and the manifest stay outside blocks.
- Link to a flavoured page with a relative link such as `[x](../guides/x.md)`. The generator rewrites it.

## Generator

- `pnpm generate` reads `docs/` and writes `docs-gen/`, which Docusaurus publishes. `docs-gen/` is generated and git-ignored.
- `pnpm start` generates once at launch. After an edit to `docs/`, restart it: the dev server does not watch `docs/`.
- `flavours.config.json` holds `docsRoot` (the source folder), `outDir`, the `axes` with their flavour names and labels, the `defaults` and `todoCap` (the most `todo` blocks allowed).
- The generator fails on a marker error, on a flavour name that equals a top-level folder of `docs/` and when the `todo` blocks exceed `todoCap`. `pnpm check`, `pnpm test`, `pnpm build` and `pnpm start` run it first.
- `docs-gen/flavours.json` lists each flavoured page with its stub address and its tree addresses.
- Outputs: a neutral page at its own path; a flavoured page at `<server>/`, `<client>/` or `<client>/<server>/` plus its path; a stub at its own path.

## Picker and redirects

- The navbar item `custom-flavourPicker` (`src/components/FlavourPicker.tsx`) shows on a page that varies by flavour (a tree page or a stub), also in the mobile drawer, and is hidden on a neutral page (`isFlavouredPage` in `src/flavours/resolve.mjs`). The trigger shows short text (`React · Node.js`, the flavour name up to ` + `); the popover rows show full names. Choosing a flavour on a page that varies on that axis opens the same page in the new pair.
- The saved choice is JSON in `localStorage` under `vs-apps-docs.flavours`. A flavourless address that is in the redirect table goes to the saved choice (default pair when empty). A tree address wins and overwrites the saved choice. Both rules run in `src/theme/Layout` (`FlavourRoute`); on a full page load a `<head>` script (`src/flavours/head-script.mjs`) redirects before the body paints.
- The redirect table maps each stub address to the axes of its page. Add an old address in `flavours.config.json` as `legacyRedirects: [{ "from": "/nest/x", "to": "/guides/x", "fixed": { "server": "nest" } }]`: `to` must be a flavoured page, `fixed` pins flavours over the reader's choice. The head script also runs on `404.html`, and the Layout runs it for a not-found route, so the old address needs no page.
- The sidebar lists stubs. `src/theme/DocRoot/Layout` re-provides the sidebar with each entry pointed into the reader's pair, so the active entry, expanded categories, breadcrumbs and the sidebar links all match a tree page. `src/theme/DocItem/Paginator` takes previous and next from that sidebar (`src/flavours/sidebar.mjs`, tested in `scripts/flavours-sidebar.test.mjs`), because the build computed them for stubs. `scripts/build-check/tree-pages.test.mjs` checks every built tree page. A pair that the URL does not fully name takes its missing axes from the saved choice.
- `src/flavours/resolve.mjs` holds the pure logic (`scripts/flavours-resolve.test.mjs`). `normalizePath`, `completeChoice` and `redirectTarget` are inlined into the head script through `Function.prototype.toString`, so they stay self-contained.

## Starter check

- `pnpm check:starter` generates a project for each pair with the starter CLI and checks every flavoured page in each of its trees against that project (SDK pin, `starter` code blocks, directory tree, ports, environment variables). A neutral page is checked against the default pair.
- A page that starts from the `leads-app` overlay says so in front matter: `start: leads-app`. The default is `hello`.
- It fails when a block names a flavour that no starter template names in `flavour.json`, or when a template of an axis has no block or `todo` on a flavoured page that uses the axis.
