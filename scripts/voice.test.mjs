import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voiceViolations } from './voice.mjs';

const words = (n) => Array.from({ length: n }, () => 'word').join(' ');
const rules = (md) => voiceViolations(md).map((v) => v.rule);

test('sentence-length: 40 words pass, 41 fail, in prose and list items', () => {
  assert.deepEqual(rules(`${words(40)}.`), []);
  assert.deepEqual(rules(`${words(41)}.`), ['sentence-length']);
  assert.deepEqual(rules(`1. ${words(41)}.`), ['sentence-length']);
});

test('paragraph-length: 5 sentences pass, 6 fail', () => {
  assert.deepEqual(rules('One. Two. Three. Four. Five.'), []);
  assert.deepEqual(rules('One. Two. Three. Four. Five. Six.'), ['paragraph-length']);
});

test('contraction: flagged in prose, allowed in code', () => {
  assert.deepEqual(rules('You do not need it.'), []);
  assert.deepEqual(rules("You don't need it."), ['contraction']);
  assert.deepEqual(rules("Use `don't` here."), []);
});

test('a semicolon and a 21-word step are not violations', () => {
  assert.deepEqual(rules('Run it; then stop.'), []);
  assert.deepEqual(rules(`- ${words(21)}.`), []);
});

test('skips frontmatter, fences, tables and headings', () => {
  const md = [
    '---', `title: ${words(50)} don't`, '---',
    `# ${words(50)}`,
    '```', `${words(50)} don't`, '```',
    `| ${words(50)} |`,
    '', 'Short.',
  ].join('\n');
  assert.deepEqual(rules(md), []);
});

test('skips the directory tree fence', () => {
  assert.deepEqual(rules(['```text', `client/ ${words(50)}`, '```'].join('\n')), []);
});

test('a list item is not part of a paragraph count', () => {
  assert.deepEqual(rules('Intro.\n- One. Two. Three. Four. Five. Six.'), []);
});
