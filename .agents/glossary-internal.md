# Internal glossary

Terms only the Vector team needs. Docusaurus does not publish this file. A term lives here or in `docs/glossary.md`, never in both. See `.agents/domain.md` for the publish rule.

## Terms

### app developer

The reader the docs are written for first: a developer new to Vector who builds an app from scratch. Pages order concepts so this reader never meets an undefined term.

- Maps to: no SDK symbol.
- Owner: docs.

### binding

An app attached to one space. It snapshots the manifest's grantable capabilities, acts and approvals, and holds that space's model, connector and module choices. Re-snapshotted on every pull or apply.

- Maps to: no SDK symbol. The SDK sees the effect through the verified token and `loadAppClientConfig`.
- Owner: Space.

### Check

A line in a quickstart step that starts with `**Check**` and tells the reader what to run or look at and what the result is. Part 1 has two: `npm ls` in step 1 and the harness output in the run step ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). A tour step has none. Each step of Part 2 has one.

- Maps to: no SDK symbol. The `Checks` assertion in `scripts/quickstart-page.test.mjs`.
- Owner: docs.

### Role

A line under a quickstart step heading that names who does the step: `**Role**: Organization admin.` on step 3, `**Role**: space manager.` on steps 4 and 5. It carries the role name and no persona. It mirrors the `**Check**` line.

- Maps to: no SDK symbol. `scripts/quickstart-page.test.mjs` pins it.
- Owner: docs.

### code block

A block of code in a docs page, opened and closed by three backticks. The text after the opening backticks names the language, such as `ts` or `mermaid`. A `ts` or `tsx` code block is a code snippet: `scripts/check-snippets.mjs` typechecks it. A `starter` code block also carries `title="path"` and must be a verbatim copy of text in that file of the starter repo. `scripts/starter-sync.mjs` checks this. A `mermaid` code block is a diagram: the page test counts them, and `DiagramControls` wraps each one.

- Maps to: no SDK symbol. `codeBlocks` in `scripts/quickstart-page.test.mjs` and `checkCodeBlocks` in `scripts/starter-sync.mjs`.
- Owner: docs.

### Space Page

A grid of widgets in a space, with page filters. A different thing from the published term page: the SDK has no part in it, and no published docs page uses it.

- Maps to: no SDK symbol. `Page` in vector-spaces, stored as `pages.pages`.
- Owner: Space.

### staff

Vector employees who administer Space itself. Only staff register apps, apply manifest changes and edit an organization license. External developers are not staff. A space manager works inside one space instead.

- Maps to: no SDK symbol.
- Owner: Space.

### tour

The quickstart steps that follow the harness run. Each one shows files of the starter and names the line of the harness Check that the files explain.

- Maps to: no SDK symbol.
- Owner: docs.

### axis

One row of the flavour picker: `client` or `server`. A page varies on the axes whose flavours its blocks name ([ADR 0004](adr/0004-flavours-are-client-and-server-axes.md)).

- Maps to: the keys of `axes` in `flavours.config.json`.
- Owner: docs.

### flavour

One value of an axis: client `react`; server `node` (Node.js + TypeScript) or `nest` (Nest.js). A flavour name is lowercase, belongs to one axis and never equals a doc folder name.

- Maps to: a key under an axis in `flavours.config.json`, the name in a `<!-- flavour <name> -->` marker, and one template directory of the starter.
- Owner: docs.

### pair

One client flavour and one server flavour together, such as `react+node`. It names the unit that the picker saves, that gets a search index and that the quickstart scaffolds. It has no link to the pair of app and space in "service secret".

- Maps to: one value combination of both axes in the generated tree.
- Owner: docs.

### flavour block

Source text between `<!-- flavour <name> -->` and `<!-- /flavour -->`. `todo` after the name marks a block nobody has written. The generator keeps the block in the trees of its flavour and drops it from the others.

- Maps to: `parse` in `scripts/generate.mjs`.
- Owner: docs.

### neutral page

A page with no flavour block. It is published once, at its own address, and the picker does not change it.

- Maps to: a page that `scripts/generate.mjs` copies unchanged.
- Owner: docs.

