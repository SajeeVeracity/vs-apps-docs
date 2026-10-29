const SENTENCE_MAX = 40;
const PARAGRAPH_MAX = 5;
const CONTRACTION = /\b(?:\w+n['’]t|\w+['’](?:re|ve|ll|d|m)|(?:it|that|there|here|what|let|he|she)['’]s)\b/i;
const CHECKBOX = /^\[[ xX]\]\s+/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+/;

/** Splits markdown into prose blocks, skipping frontmatter, fences (the directory tree is one), tables, headings and admonition markers. */
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
      current = { item: true, text: line.replace(LIST_ITEM, '').replace(CHECKBOX, '') };
    } else if (current) {
      current.text += ` ${line.trim()}`;
    } else {
      current = { item: false, text: line.trim() };
    }
  }
  flush();
  return out;
}

/**
 * Reports tutorial-voice breaks in prose: sentence over 40 words, paragraph
 * over 5 sentences, contractions. Inline code counts as one word and is not
 * checked for contractions. A list item is not counted as a paragraph.
 * @returns {{ rule: string, text: string }[]}
 */
export function voiceViolations(markdown) {
  const violations = [];
  for (const block of blocks(markdown)) {
    const text = block.text
      .replace(/`[^`]*`/g, 'CODE')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    if (CONTRACTION.test(text)) violations.push({ rule: 'contraction', text });
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    for (const sentence of sentences) {
      if (sentence.split(/\s+/).length > SENTENCE_MAX) {
        violations.push({ rule: 'sentence-length', text: sentence });
      }
    }
    if (!block.item && sentences.length > PARAGRAPH_MAX) {
      violations.push({ rule: 'paragraph-length', text });
    }
  }
  return violations;
}
