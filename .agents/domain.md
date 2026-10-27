# Domain Docs

How the engineering skills read this repo's domain documentation. `docs/` is the published Docusaurus site, so agent config and ADRs live outside it.

## Before exploring, read these

- **`docs/glossary.md`**: the published glossary, one name per concept. It is the vocabulary source.
- **`.agents/adr/`**: ADRs touching the area about to change.

If either is missing, proceed silently. `/domain-modeling` creates them when terms or decisions are resolved.

## Use the glossary's vocabulary

Name domain concepts as `docs/glossary.md` defines them. A concept missing from it is a gap to note for `/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, say so explicitly rather than silently overriding it.
