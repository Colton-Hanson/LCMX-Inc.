// validators.test.js — automated tests for the input-checking functions in validators.js.
// Run with: npm test.  `describe` groups related tests, `it` is one test, `expect` is the check.
import { validateEmail, validatePassword, validateConfirm, checkPasswordRules } from '../src/lib/validators.js';

describe('validateEmail', () => {
  it('rejects empty and malformed emails', () => {
    expect(validateEmail('')).not.toBe('');        // empty -> returns an error message
    expect(validateEmail('abc')).not.toBe('');     // no @ at all
    expect(validateEmail('a@b')).not.toBe('');     // no ".com"-style ending
    expect(validateEmail('a b@c.com')).not.toBe(''); // contains a space
  });
  it('accepts a valid email', () => {
    expect(validateEmail('cole@umkc.edu')).toBe(''); // '' means "no error"
  });
});

describe('password rules', () => {
  it('flags each unmet rule', () => {
    const r = checkPasswordRules('abc'); // too short, no capital, no symbol
    expect(r.every((x) => !x.met)).toBe(true); // so NONE of the rules are met
  });
  it('requires length, capital, symbol', () => {
    expect(validatePassword('Abcdefg!')).toBe('');            // meets all three rules
    expect(validatePassword('abcdefg!')).not.toBe('');        // missing a capital
    expect(validatePassword('Abcdefgh')).not.toBe('');        // missing a symbol
    expect(validatePassword('Ab!')).not.toBe('');             // too short
  });
});

describe('validateConfirm', () => {
  it('requires a match', () => {
    expect(validateConfirm('Abcdefg!', '')).not.toBe('');          // confirm left empty
    expect(validateConfirm('Abcdefg!', 'Abcdefg?')).not.toBe('');  // doesn't match
    expect(validateConfirm('Abcdefg!', 'Abcdefg!')).toBe('');      // matches
  });
});
