const PROCEDURE_MAX = 20;
const SENTENCE_MAX = 25;
const PARAGRAPH_MAX = 4;
const CONTRACTION = /\b(?:\w+n['’]t|\w+['’](?:re|ve|ll|d|m)|(?:it|that|there|here|what|let|he|she)['’]s)\b/i;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+/;

/** Splits markdown into prose blocks, skipping frontmatter, fences, tables, headings and admonition markers. */
function blocks(markdown) {
  const lines = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const out = [];
  let current = null;
  let fence = false;
  const flush = () => {
    if (current) out.push(current);
    current = null;
  };
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      fence = !fence;
    } else if (fence || /^\s*\|/.test(line) || /^#{1,6}\s/.test(line) || /^\s*:::/.test(line)) {
      flush();
    } else if (line.trim() === '') {
      flush();
    } else if (LIST_ITEM.test(line)) {
      flush();
      current = { procedure: true, text: line.replace(LIST_ITEM, '') };
    } else if (current) {
      current.text += ` ${line.trim()}`;
    } else {
      current = { procedure: false, text: line.trim() };
    }
  }
  flush();
  return out;
}

/**
 * Reports STE rule breaks in prose. Inline code counts as one word and is not
 * checked for banned forms. A list item or numbered step is a procedure.
 * @returns {{ rule: string, text: string }[]}
 */
export function steViolations(markdown) {
  const violations = [];
  for (const block of blocks(markdown)) {
    const text = block.text
      .replace(/`[^`]*`/g, 'CODE')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    if (text.includes(';')) violations.push({ rule: 'semicolon', text });
    if (CONTRACTION.test(text)) violations.push({ rule: 'contraction', text });
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    const max = block.procedure ? PROCEDURE_MAX : SENTENCE_MAX;
    for (const sentence of sentences) {
      if (sentence.split(/\s+/).length > max) {
        violations.push({ rule: block.procedure ? 'procedure-length' : 'sentence-length', text: sentence });
      }
    }
    if (!block.procedure && sentences.length > PARAGRAPH_MAX) {
      violations.push({ rule: 'paragraph-length', text });
    }
  }
  return violations;
}
