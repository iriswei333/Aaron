import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockActionLabel, blockConfirmCopy, unblockConfirmCopy } from '../src/user-blocks.js';

test('block copy names the family and falls back politely', () => {
  assert.equal(blockConfirmCopy('Priya').title, 'Block Priya?');
  assert.match(blockConfirmCopy('Priya').message, /Priya won’t be told/);
  assert.equal(blockConfirmCopy('').title, 'Block this family?');
  assert.equal(unblockConfirmCopy('Sam').title, 'Unblock Sam?');
});

test('menu label avoids the generic "Parent" placeholder', () => {
  assert.equal(blockActionLabel('Priya'), 'Block Priya');
  assert.equal(blockActionLabel('Parent'), 'Block this family');
  assert.equal(blockActionLabel(''), 'Block this family');
});
