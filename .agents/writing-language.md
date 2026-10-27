# Docs language checklist

Reader: a working TypeScript developer who knows React and NestJS and has not used Space.
Coverage: prose, tables, headings, code comments. Not identifiers or string values in code.
Precedence: rules here win over any reference.

## Shared layer (all pages)

### Simple English

- **L1 Plain word.** Use the common word. Bad: "feeds ten uses". Good: "is used in ten places".
- **L2 One idea per sentence.** Split at "and", "so" and ";" when each side could stand alone.
- **L3 Sentence length.** Target 25 words or fewer. Hard cap 40. References: mean 13-14, p90 25-28.
- **L4 Paragraph length.** 4 sentences or fewer. References: mean 1.4-1.9.
- **L5 Table cell and reference description.** 15 words or fewer. A cell over 15 words is a note, not an error. References: 9-11.
- **L6 Active voice.** Name the actor. Bad: "A slot nobody set runs nothing". Good: "If no one sets a slot, the app cannot use that model."
- **L7 No noun stacks.** Three nouns in a row need a verb. Bad: "Connector-event handler wiring". Good: "Register connector event handlers".
- **L8 One name per thing.** Use the glossary name every time, with the same capitals. Bad: "registry entry" for "app registration".
- **L9 Spell out the figure.** Give exact numbers and limits, not "a few" or "many".

### Terms

- **T1 Vector and SDK terms.** Define at first use, or link to the glossary at first use. This includes role words such as "staff" and "space manager". Link at the first use in the page, not at the first use in a section.
- **T2 Standard terms.** Standard web, TypeScript and NestJS terms need no definition.
- **T3 Informal words.** A word used with a private meaning ("pull", "boot ping", "ungated", "surface") is a Vector term: apply T1, or replace it with a plain phrase.

### Abbreviations

- **A1 Define at first use.** Write the full form, then the abbreviation in brackets, or link to a glossary entry. Bad: "the SDK refuses". Good: "the software development kit (SDK) refuses".
- **A2 Exempt list.** HTTP, JSON, API and URL need no definition. Add to this list only with maintainer approval.
- **A3 Shortened words count.** "nav", "env", "config" are abbreviations. Write the full word, or define it.
- **A4 Glossary entry.** An abbreviation defined in a page has a glossary entry that the page links to.
- **A5 Code values.** Names in code font (`REST`, `ANTHROPIC`) are identifiers and are not abbreviations.

### Headings

- **H1 Sentence case.**
- **H2 Say what the section gives.** A task heading starts with a verb. A concept heading is a noun phrase. No questions.

## Concept page

- **C1 Open with the definition.** First sentence says what the thing is. Second says what it does for the reader.
- **C2 Example early.** A minimal example follows the definition and the main rule.
- **C3 Rule, then reason.** State the rule, then the consequence in the same or the next sentence.
- **C4 End with what next.** Last section gives a result and one next step.

## Not in this checklist

- Contractions. Decision pending.
- Existing writing standard (hyphens, we/our, current state only). Reported in a separate section.
