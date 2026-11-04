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
- `flavours.config.json` holds `docsRoot` (the source folder), `outDir`, the `axes` with their flavour names and labels, the `defaults` and `todoCap` (the most `todo` blocks allowed).
- The generator fails on a marker error and when the `todo` blocks exceed `todoCap`. `pnpm check`, `pnpm build` and `pnpm start` run it first.
- `docs-gen/flavours.json` lists each flavoured page with its stub address and its tree addresses.
- Outputs: a neutral page at its own path; a flavoured page at `<server>/`, `<client>/` or `<client>/<server>/` plus its path; a stub at its own path.
