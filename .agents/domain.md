# Domain Docs

How the engineering skills read this repo's domain documentation. `docs/` is the published Docusaurus site, so agent config and ADRs live outside it.

## Before exploring, read these

- **`docs/glossary.md`**: the published glossary, terms an external developer needs.
- **`.agents/glossary-internal.md`**: terms only the Vector team needs. Not published.
- **`.agents/adr/`**: ADRs touching the area about to change.

If any is missing, proceed silently. `/domain-modeling` creates them when terms or decisions are resolved.

## Use the glossaries' vocabulary

Name domain concepts as the two glossaries define them. A concept missing from both is a gap to note for `/domain-modeling`.

## Where a term lives

A term is published if a published docs page uses it, or it maps to an SDK symbol or manifest field. Otherwise it is internal. A term lives in exactly one file.

## Flag ADR conflicts

If output contradicts an existing ADR, say so explicitly rather than silently overriding it.
