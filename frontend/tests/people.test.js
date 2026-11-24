// Tests for short names (lib/people.js) and day labels (formatDay in lib/settle.js). Run with: npm test

import { labelsFor, personLabel } from '../src/lib/people.js';
import { formatDay } from '../src/lib/settle.js';

describe('personLabel', () => {
  it('shows first name and last initial', () => {
    expect(personLabel({ name: 'Alice Rivera', email: 'a@x.com' })).toBe('Alice R.');
    expect(personLabel({ name: 'Mary Jane Watson' })).toBe('Mary W.');
  });

  it('keeps a one-word name as it is, and tidies one typed in a single case', () => {
    expect(personLabel({ name: 'Alice' })).toBe('Alice');
    expect(personLabel({ name: 'alice rivera' })).toBe('Alice R.');
    expect(personLabel({ name: 'ALICE' })).toBe('Alice');
    expect(personLabel({ name: 'McKie' })).toBe('McKie');
  });

  it('uses the start of the email when there is no name, never the whole email', () => {
    expect(personLabel({ name: null, email: 'alice@example.com' })).toBe('Alice');
    expect(personLabel({ name: '', email: 'alice.rivera@example.com' })).toBe('Alice R.');
    expect(personLabel({ email: 'alice_rivera+tips@example.com' })).toBe('Alice T.');
    expect(personLabel({ email: 'sam2@umkc.edu' })).toBe('Sam');
  });

  it('falls back to Member when nothing readable is left', () => {
    expect(personLabel({ email: '12345@example.com' })).toBe('Member');
    expect(personLabel({})).toBe('Member');
    expect(personLabel()).toBe('Member');
  });

  it('works with non-English letters', () => {
    expect(personLabel({ name: 'José Álvarez' })).toBe('José Á.');
  });
});

describe('labelsFor', () => {
  it('gives every member a label by user id', () => {
    const labels = labelsFor([
      { user_id: 2, name: 'Maya Ortiz', email: 'maya@example.com' },
      { user_id: 1, name: null, email: 'sam@umkc.edu' },
    ]);
    expect(labels).toEqual({ 1: 'Sam', 2: 'Maya O.' });
  });

  it('numbers people who would share a label, lowest id first', () => {
    const labels = labelsFor([
      { user_id: 9, name: 'Alice Rivera', email: 'a2@x.com' },
      { user_id: 3, name: 'Alice Reed', email: 'a1@x.com' },
      { user_id: 5, name: 'Alice Ramos', email: 'a3@x.com' },
    ]);
    expect(labels).toEqual({ 3: 'Alice R.', 5: 'Alice R. (2)', 9: 'Alice R. (3)' });
  });

  it('handles an empty or missing list', () => {
    expect(labelsFor([])).toEqual({});
    expect(labelsFor(undefined)).toEqual({});
  });
});

describe('formatDay', () => {
  const now = new Date(2026, 10, 20, 15, 0); // Nov 20, 2026, 3 pm local
  const local = (y, m, d, h = 12) => new Date(y, m, d, h).toISOString();

  it('says Today and Yesterday', () => {
    expect(formatDay(local(2026, 10, 20, 1), now)).toBe('Today');
    expect(formatDay(local(2026, 10, 19, 23), now)).toBe('Yesterday');
  });

  it('writes older days as "Nov 3", with the year only when it is not this year', () => {
    expect(formatDay(local(2026, 10, 3), now)).toBe('Nov 3');
    expect(formatDay(local(2026, 11, 28), new Date(2026, 11, 30))).toBe('Dec 28');
    expect(formatDay(local(2025, 11, 28), now)).toBe('Dec 28, 2025');
  });

  it('reads the server’s times that come without a zone', () => {
    expect(formatDay('2026-11-03T12:00:00', now)).toBe('Nov 3');
  });

  it('is empty for a date it cannot read', () => {
    expect(formatDay('not a date', now)).toBe('');
    expect(formatDay(undefined, now)).toBe('');
  });
});
