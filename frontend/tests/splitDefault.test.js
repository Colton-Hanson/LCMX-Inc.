// Tests for the group default split helpers (lib/splitDefault.js). The default itself comes from the server. Run with: npm test

import { checkPercents, defaultBasisPoints, EVEN_DEFAULT } from '../src/lib/splitDefault.js';

describe('EVEN_DEFAULT', () => {
  it('is an even split with no percentages, the same shape the server sends', () => {
    expect(EVEN_DEFAULT).toEqual({ method: 'even', percents: {} });
  });
});

describe('defaultBasisPoints', () => {
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  it('gives equal shares when the group is even, first people get the extra', () => {
    expect(defaultBasisPoints(EVEN_DEFAULT, [1, 2, 3])).toEqual({ 1: 3334, 2: 3333, 3: 3333 });
  });

  it('gives the saved percentages when everyone is in', () => {
    const saved = { method: 'percentage', percents: { 1: 5000, 2: 3000, 3: 2000 } };
    expect(defaultBasisPoints(saved, [1, 2, 3])).toEqual({ 1: 5000, 2: 3000, 3: 2000 });
  });

  it('scales to the people in the split and always adds up to 100%', () => {
    const saved = { method: 'percentage', percents: { 1: 5000, 2: 3000, 3: 2000 } };
    expect(defaultBasisPoints(saved, [1, 2])).toEqual({ 1: 6250, 2: 3750 });
    const odd = { method: 'percentage', percents: { 1: 3333, 2: 3333, 3: 3334 } };
    [[1, 2], [2, 3], [1, 3], [1, 2, 3]].forEach((ids) => expect(sum(defaultBasisPoints(odd, ids))).toBe(10000));
  });

  it('falls back to equal when someone has no saved percentage or all are zero', () => {
    const missing = { method: 'percentage', percents: { 1: 6000, 2: 4000 } };
    expect(defaultBasisPoints(missing, [1, 2, 3])).toEqual({ 1: 3334, 2: 3333, 3: 3333 });
    const zero = { method: 'percentage', percents: { 1: 0, 2: 0 } };
    expect(defaultBasisPoints(zero, [1, 2])).toEqual({ 1: 5000, 2: 5000 });
  });

  it('gives nothing for nobody', () => {
    expect(defaultBasisPoints(EVEN_DEFAULT, [])).toEqual({});
  });
});

describe('checkPercents', () => {
  it('is valid when the percentages add up to 100', () => {
    const r = checkPercents([1, 2], { 1: '60', 2: '40.00' });
    expect(r).toMatchObject({ valid: true, difference: 0, message: '', basisPoints: { 1: 6000, 2: 4000 } });
  });

  it('says how much is left or over', () => {
    expect(checkPercents([1, 2], { 1: '60', 2: '30' })).toMatchObject({ valid: false, difference: 1000, message: '10.00% left to assign.' });
    expect(checkPercents([1, 2], { 1: '60', 2: '50' })).toMatchObject({ valid: false, difference: -1000, message: '10.00% over 100%.' });
  });

  it('counts a blank box as 0 and flags text that is not a number', () => {
    expect(checkPercents([1, 2], { 1: '100', 2: '' }).valid).toBe(true);
    const r = checkPercents([1, 2], { 1: 'abc', 2: '50' });
    expect(r.valid).toBe(false);
    expect(r.invalidIds).toEqual([1]);
    expect(r.message).toBe('Enter each percentage as a number from 0 to 100.');
  });
});
