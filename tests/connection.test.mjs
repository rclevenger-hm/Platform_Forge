import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnectionCheck } from '../src/lib/connection.mjs';

test('disconnect aborts the pending check and rejects late success or failure', () => {
  const checks = createConnectionCheck();
  const pending = checks.start();
  assert.equal(pending.current(), true);
  checks.cancel();
  assert.equal(pending.signal.aborted, true);
  assert.equal(pending.current(), false);
  checks.cancel();
});
test('a replacement aborts its predecessor and stale cleanup preserves the new check', () => {
  const checks = createConnectionCheck();
  const first = checks.start();
  const next = checks.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.current(), false);
  first.finish();
  assert.equal(next.current(), true);
  assert.equal(next.signal.aborted, false);
  next.finish();
  assert.equal(next.current(), false);
});
test('a new check remains usable after cancellation or a completed check', () => {
  const checks = createConnectionCheck();
  checks.start().finish();
  checks.cancel();
  const next = checks.start();
  assert.equal(next.current(), true);
  checks.cancel();
  assert.equal(next.current(), false);
});
