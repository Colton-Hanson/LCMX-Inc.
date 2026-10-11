// Tests for initialsFor: the letters shown in the round avatar.
// Run with: npm test

import { initialsFor } from '../src/lib/initials.js';

describe('initialsFor', () => {
  it('uses the first letter of the first two words', () => {
    expect(initialsFor('Cole Hanson', 'x@y.com')).toBe('CH');
    expect(initialsFor('  mary ann  smith ', 'x@y.com')).toBe('MA');
  });
  it('uses one letter for a single word', () => {
    expect(initialsFor('Cole', 'x@y.com')).toBe('C');
  });
  it('falls back to the email when there is no name', () => {
    expect(initialsFor('', 'xyz@y.com')).toBe('X');
    expect(initialsFor(null, 'xyz@y.com')).toBe('X');
  });
});
