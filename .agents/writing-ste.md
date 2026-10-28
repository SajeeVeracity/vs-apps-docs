# STE rules

Scope: `docs/quickstart.md` only. Rules come from ASD-STE100 Issue 9. Text about them says "follows rules from ASD-STE100 Issue 9", never "STE compliant". The page makes no STE claim.
Precedence: where these rules and `.agents/writing-language.md` differ, the stricter rule wins.

## Limits

- **Procedure sentence:** 20 words or fewer. A list item or numbered step is a procedure.
- **Other sentence:** 25 words or fewer. This replaces L3, which has a 40-word hard cap.
- **Paragraph:** 4 sentences or fewer. L4 is stricter than STE (6) and stays.
- **Noun stack:** no 3 nouns in a row. L7 is stricter than STE (3-word cluster) and stays.

## Banned forms

- Contractions (STE 4.2). The repo-wide contraction decision stays pending.
- Semicolons (STE 8.1).
- Most "-ing" forms (STE 3.5).

## Unchanged rules

V1-V5, T1-T3, A1-A5, H1-H2, L1, L2, L5, L6, L8 and L9 apply as written.

## Dictionary

Follow the ASD-STE100 dictionary by judgement. Review enforces it. The repo holds no dictionary file because the licence forbids redistribution. Replace any word outside the dictionary with a plain word, unless it is a Technical Name.

## Technical Names

Allowed without a swap: glossary terms, and tool and command names. Current list: `npm`, `JWKS`, `Space`, `tsx`, `Vite`. Add a name here when the page needs it.

## Enforcement

`steViolations` in `scripts/ste.mjs` checks these rules outside code: procedure length, sentence length, paragraph length, contractions and semicolons. Inline code counts as one word. The check skips frontmatter, fences, tables, headings and the directory tree. Review checks word choice, tense, "-ing" forms and noun stacks.
