import assert from 'node:assert/strict';
import { test } from 'node:test';
import { steViolations } from './ste.mjs';

const words = (n) => Array.from({ length: n }, () => 'word').join(' ');
const rules = (md) => steViolations(md).map((v) => v.rule);

test('procedure-length: 20 words pass, 21 fail, in list items and steps', () => {
  assert.deepEqual(rules(`- ${words(20)}.`), []);
  assert.deepEqual(rules(`- ${words(21)}.`), ['procedure-length']);
  assert.deepEqual(rules(`1. ${words(21)}.`), ['procedure-length']);
});

test('sentence-length: 25 words pass, 26 fail in prose', () => {
  assert.deepEqual(rules(`${words(25)}.`), []);
  assert.deepEqual(rules(`${words(26)}.`), ['sentence-length']);
});

test('paragraph-length: 4 sentences pass, 5 fail', () => {
  assert.deepEqual(rules('One. Two. Three. Four.'), []);
  assert.deepEqual(rules('One. Two. Three. Four. Five.'), ['paragraph-length']);
});

test('contraction: flagged in prose, allowed in code', () => {
  assert.deepEqual(rules('You do not need it.'), []);
  assert.deepEqual(rules("You don't need it."), ['contraction']);
  assert.deepEqual(rules("Use `don't` here."), []);
});

test('semicolon: flagged in prose, allowed in code', () => {
  assert.deepEqual(rules('Run it. Then stop.'), []);
  assert.deepEqual(rules('Run it; then stop.'), ['semicolon']);
  assert.deepEqual(rules('Run `a; b` now.'), []);
});

test('inline code counts as one word', () => {
  assert.deepEqual(rules(`- ${words(19)} \`npm run dev --workspace @hello-app/server\`.`), []);
});

test('skips frontmatter, fences, tables, headings and the tree', () => {
  const md = [
    '---', `title: ${words(40)}; don't`, '---',
    `# ${words(40)}`,
    '```', `${words(40)}; don't`, '```',
    `| ${words(40)} |`,
    '', 'Short.',
  ].join('\n');
  assert.deepEqual(rules(md), []);
});

test('a list item is not part of a paragraph count', () => {
  assert.deepEqual(rules('Intro.\n- One. Two. Three. Four. Five.'), []);
});
