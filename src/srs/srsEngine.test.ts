/**
 * Lightweight self-checks for the SRS engine. Run with: node --test (after a
 * ts build) or via your preferred runner. Framework-agnostic assertions so it
 * works even without jest configured.
 */
import assert from 'node:assert';
import { test } from 'node:test';
import { scheduleNext, gradeFromScore, SrsState } from './srsEngine';

const base: SrsState = { intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 };
const NOW = 1_700_000_000_000;

test('score bands map to grades per scope', () => {
  assert.equal(gradeFromScore(50), 'fail');
  assert.equal(gradeFromScore(72), 'hard');
  assert.equal(gradeFromScore(88), 'good');
  assert.equal(gradeFromScore(97), 'easy');
});

test('a failing score is due again today and increments lapses', () => {
  const r = scheduleNext(base, 55, NOW);
  assert.equal(r.grade, 'fail');
  assert.equal(r.dueAt, NOW);
  assert.equal(r.lapses, 1);
  assert.equal(r.repetitions, 0);
});

test('a strong score eventually pushes the card 7+ days out', () => {
  let state: SrsState = base;
  let last = scheduleNext(state, 90, NOW); // rep 1 -> 1 day
  state = last;
  last = scheduleNext(state, 90, NOW); // rep 2 -> >= 7 days
  const days = (last.dueAt - NOW) / (24 * 60 * 60 * 1000);
  assert.ok(days >= 7, `expected >=7 days, got ${days}`);
});

test('ease never drops below 1.3', () => {
  let state: SrsState = { ...base, easeFactor: 1.3 };
  for (let i = 0; i < 5; i++) state = scheduleNext(state, 40, NOW);
  assert.ok(state.easeFactor >= 1.3);
});

console.log('SRS engine checks defined.');
