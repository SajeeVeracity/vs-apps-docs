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

A line in a quickstart step that starts with `**Check**` and tells the reader what to run or look at and what the result is. The quickstart has two: `npm ls` in step 1 and the harness output in the run step ([ADR 0002](adr/0002-quickstart-clones-a-starter-repo.md)). A tour step has none.

- Maps to: no SDK symbol. The `Checks` assertion in `scripts/quickstart-page.test.mjs`.
- Owner: docs.

### fence

A block of code in a docs page, opened and closed by three backticks. The text after the opening backticks names the language, such as `ts` or `mermaid`. A `starter` fence also carries `title="path"` and must be a verbatim copy of text in that file of the starter repo. `scripts/starter-sync.mjs` checks this. A `mermaid` fence is a diagram: the page test counts them, and `DiagramControls` wraps each one.

- Maps to: no SDK symbol. `fences` in `scripts/quickstart-page.test.mjs` and `checkFences` in `scripts/starter-sync.mjs`.
- Owner: docs.

### pin

An assertion in `scripts/quickstart-page.test.mjs` or `scripts/starter-sync.mjs` that fixes a piece of page text or structure. A change to pinned text needs a test change in the same hand-off.

- Maps to: no SDK symbol.
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
