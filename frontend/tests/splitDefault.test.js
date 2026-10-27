// Tests for the group default split helpers (lib/splitDefault.js). Run with: npm test

import { checkPercents, defaultBasisPoints, EVEN_DEFAULT, getSplitDefault, saveSplitDefault } from '../src/lib/splitDefault.js';

beforeEach(() => localStorage.clear());

describe('saving and reading the default', () => {
  it('is even when nothing is saved', () => {
    expect(getSplitDefault(5)).toEqual(EVEN_DEFAULT);
  });

  it('gives back what was saved, per group', () => {
    const saved = { method: 'percentage', percents: { 1: 7000, 2: 3000 } };
    expect(saveSplitDefault(5, saved)).toBe(true);
    expect(getSplitDefault(5)).toEqual(saved);
    expect(getSplitDefault(6)).toEqual(EVEN_DEFAULT);
  });

  it('treats damaged data as even', () => {
    localStorage.setItem('splitDefault:5', 'not json');
    expect(getSplitDefault(5)).toEqual(EVEN_DEFAULT);
    localStorage.setItem('splitDefault:5', JSON.stringify({ method: 'percentage', percents: { 1: 'x' } }));
    expect(getSplitDefault(5)).toEqual(EVEN_DEFAULT);
    localStorage.setItem('splitDefault:5', JSON.stringify({ method: 'percentage', percents: { 1: 10001 } }));
    expect(getSplitDefault(5)).toEqual(EVEN_DEFAULT);
  });

  it('returns false when the browser will not store it', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(saveSplitDefault(5, EVEN_DEFAULT)).toBe(false);
    spy.mockRestore();
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
