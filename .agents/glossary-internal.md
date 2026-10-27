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

### Space Page

A grid of widgets in a space, with page filters. A different thing from the published term page: the SDK has no part in it, and no published docs page uses it.

- Maps to: no SDK symbol. `Page` in vector-spaces, stored as `pages.pages`.
- Owner: Space.
