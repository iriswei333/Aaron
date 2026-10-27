import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_REPORT_DETAILS_MAX, CHAT_REPORT_REASONS, chatReportReasonLabel, isChatReportReason, normalizeChatReport } from '../src/chat-report.js';

test('reason ids match the chat_reports check constraint', () => {
  assert.deepEqual(CHAT_REPORT_REASONS.map((reason) => reason.id), ['spam', 'harassment', 'inappropriate', 'child_safety', 'other']);
  assert.equal(isChatReportReason('spam'), true);
  assert.equal(isChatReportReason('nope'), false);
  assert.equal(chatReportReasonLabel('harassment'), 'Harassment or bullying');
});

test('normalizes a valid report', () => {
  assert.deepEqual(normalizeChatReport({ messageId: ' m1 ', reason: 'spam', details: '  buy   now ' }), { messageId: 'm1', reason: 'spam', details: 'buy now' });
});

test('rejects missing message, unknown reason, and empty "other"', () => {
  assert.ok(normalizeChatReport({ reason: 'spam' }).error);
  assert.ok(normalizeChatReport({ messageId: 'm1', reason: 'bogus' }).error);
  assert.ok(normalizeChatReport({ messageId: 'm1', reason: 'other' }).error);
  assert.equal(normalizeChatReport({ messageId: 'm1', reason: 'other', details: 'rude' }).reason, 'other');
});

test('caps details length', () => {
  const { details } = normalizeChatReport({ messageId: 'm1', reason: 'spam', details: 'x'.repeat(2000) });
  assert.equal(details.length, CHAT_REPORT_DETAILS_MAX);
});
