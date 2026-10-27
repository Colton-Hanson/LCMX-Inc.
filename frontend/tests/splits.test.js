// splits.test.js — checks the split math in splits.js against the backend's rules
// (backend/app/services/split_calculator.py). No server needed. Run with: npm test

import {
  toCents,
  toBasisPoints,
  formatCents,
  formatMoney,
  evenShares,
  percentageShares,
  calculateSplit,
  splitValuesForRequest,
} from '../src/lib/splits.js';

const sum = (shares) => Object.values(shares).reduce((a, b) => a + b, 0);

describe('toCents', () => {
  it('reads dollars and cents without rounding errors', () => {
    expect(toCents('10')).toBe(1000);
    expect(toCents('10.5')).toBe(1050);
    expect(toCents('10.50')).toBe(1050);
    expect(toCents('$12.34')).toBe(1234);
    expect(toCents('.99')).toBe(99);
    expect(toCents('0.07')).toBe(7);
    expect(toCents(' 5. ')).toBe(500);
    expect(toCents('99999999.99')).toBe(9999999999);
  });

  it('rejects anything that is not dollars and cents', () => {
    ['', '   ', 'abc', '-5', '1.234', '1,000', '10.5.1', '100000000', '1e3', '$', '.'].forEach((bad) => {
      expect(toCents(bad)).toBeNull();
    });
    expect(toCents(undefined)).toBeNull();
    expect(toCents(null)).toBeNull();
  });
});

describe('toBasisPoints', () => {
  it('reads percentages as hundredths of a percent', () => {
    expect(toBasisPoints('50')).toBe(5000);
    expect(toBasisPoints('33.33')).toBe(3333);
    expect(toBasisPoints('25%')).toBe(2500);
    expect(toBasisPoints('100')).toBe(10000);
    expect(toBasisPoints('0')).toBe(0);
    expect(toBasisPoints('.5')).toBe(50);
  });

  it('rejects anything over 100 or not a number', () => {
    ['', 'abc', '-1', '100.01', '101', '12.345', '1,5'].forEach((bad) => {
      expect(toBasisPoints(bad)).toBeNull();
    });
  });
});

describe('formatCents and formatMoney', () => {
  it('shows cents with two decimals', () => {
    expect(formatCents(334)).toBe('3.34');
    expect(formatCents(1000)).toBe('10.00');
    expect(formatCents(5)).toBe('0.05');
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(-250)).toBe('-2.50');
    expect(formatCents(3333)).toBe('33.33');
  });

  it('shows dollars on screen with a comma for thousands', () => {
    expect(formatMoney(334)).toBe('$3.34');
    expect(formatMoney(123450)).toBe('$1,234.50');
  });
});

describe('even split', () => {
  it('splits $10.00 three ways as 3.34, 3.33, 3.33 and flags the first person', () => {
    const { shares, adjustedIds } = evenShares(1000, [7, 8, 9]);
    expect(shares).toEqual({ 7: 334, 8: 333, 9: 333 });
    expect(adjustedIds).toEqual([7]);
  });

  it('gives one extra cent to each of the first people when more than one cent is left over', () => {
    const { shares, adjustedIds } = evenShares(1001, [1, 2, 3, 4]); // 250 each, 1 left
    expect(shares).toEqual({ 1: 251, 2: 250, 3: 250, 4: 250 });
    expect(adjustedIds).toEqual([1]);
    const second = evenShares(1002, [1, 2, 3, 4]); // 250 each, 2 left
    expect(second.adjustedIds).toEqual([1, 2]);
    expect(sum(second.shares)).toBe(1002);
  });

  it('follows the order of the list, not the id numbers', () => {
    expect(evenShares(1000, [9, 8, 7]).adjustedIds).toEqual([9]);
  });

  it('has no leftover when it divides evenly, and handles one person', () => {
    expect(evenShares(900, [1, 2, 3]).adjustedIds).toEqual([]);
    expect(evenShares(1234, [5])).toEqual({ shares: { 5: 1234 }, adjustedIds: [] });
  });

  it('handles totals smaller than the number of people', () => {
    const { shares, adjustedIds } = evenShares(2, [1, 2, 3]);
    expect(shares).toEqual({ 1: 1, 2: 1, 3: 0 });
    expect(adjustedIds).toEqual([1, 2]);
  });

  it('always adds back up to the total', () => {
    for (let total = 1; total <= 500; total += 7) {
      for (let people = 1; people <= 9; people += 1) {
        const ids = Array.from({ length: people }, (_, i) => i + 1);
        expect(sum(evenShares(total, ids).shares)).toBe(total);
      }
    }
  });
});

describe('percentage split', () => {
  it('rounds each share down, then gives leftover cents to the first people', () => {
    // $10.00 at 33.33 / 33.33 / 33.34: shares round down to 3.33 each (0.01 left over) so the first gets it.
    const { shares, adjustedIds } = percentageShares(1000, [1, 2, 3], { 1: 3333, 2: 3333, 3: 3334 });
    expect(shares).toEqual({ 1: 334, 2: 333, 3: 333 });
    expect(adjustedIds).toEqual([1]);
  });

  it('splits cleanly when the percentages land on whole cents', () => {
    const { shares, adjustedIds } = percentageShares(1000, [1, 2], { 1: 7000, 2: 3000 });
    expect(shares).toEqual({ 1: 700, 2: 300 });
    expect(adjustedIds).toEqual([]);
  });

  it('gives one person everything at 100% and nothing at 0%', () => {
    expect(percentageShares(1234, [1, 2], { 1: 10000, 2: 0 }).shares).toEqual({ 1: 1234, 2: 0 });
  });
});

describe('calculateSplit: even', () => {
  it('is valid whenever there is a total and at least one person', () => {
    const result = calculateSplit({ totalCents: 1000, memberIds: [1, 2, 3], method: 'even' });
    expect(result.valid).toBe(true);
    expect(result.shares).toEqual({ 1: 334, 2: 333, 3: 333 });
    expect(result.adjustedIds).toEqual([1]);
    expect(result.message).toBe('');
  });

  it('asks for a total first', () => {
    [null, 0, -5, 1.5, 10000000000].forEach((bad) => {
      const result = calculateSplit({ totalCents: bad, memberIds: [1], method: 'even' });
      expect(result.valid).toBe(false);
      expect(result.shares).toBeNull();
      expect(result.message).toBe('Enter a total above $0.00.');
    });
  });

  it('asks for at least one person', () => {
    const result = calculateSplit({ totalCents: 1000, memberIds: [], method: 'even' });
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Pick at least one person to split with.');
  });
});

describe('calculateSplit: custom amounts', () => {
  const base = { totalCents: 1000, memberIds: [1, 2, 3], method: 'custom' };

  it('is valid when the amounts add up to the total', () => {
    const result = calculateSplit({ ...base, values: { 1: '5', 2: '3.50', 3: '1.5' } });
    expect(result.valid).toBe(true);
    expect(result.shares).toEqual({ 1: 500, 2: 350, 3: 150 });
    expect(result.difference).toBe(0);
    expect(result.adjustedIds).toEqual([]);
  });

  it('says how much is left when the amounts fall short', () => {
    const result = calculateSplit({ ...base, values: { 1: '5', 2: '3', 3: '' } });
    expect(result.valid).toBe(false);
    expect(result.difference).toBe(200);
    expect(result.message).toBe('$2.00 left to assign.');
    expect(result.shares).toEqual({ 1: 500, 2: 300, 3: 0 });
  });

  it('says how much is over when the amounts go past the total', () => {
    const result = calculateSplit({ ...base, values: { 1: '6', 2: '3', 3: '2.50' } });
    expect(result.valid).toBe(false);
    expect(result.difference).toBe(-150);
    expect(result.message).toBe('$1.50 over the total.');
  });

  it('flags the people whose amount is not a valid number', () => {
    const result = calculateSplit({ ...base, values: { 1: 'abc', 2: '5', 3: '5' } });
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toEqual([1]);
    expect(result.message).toBe('Enter each amount as dollars and cents, like 12.50.');
  });

  it('treats blank boxes as $0.00', () => {
    const result = calculateSplit({ ...base, values: {} });
    expect(result.valid).toBe(false);
    expect(result.difference).toBe(1000);
  });
});

describe('calculateSplit: percentage', () => {
  const base = { totalCents: 1000, memberIds: [1, 2, 3], method: 'percentage' };

  it('is valid at exactly 100% and gives the leftover cent to the first person', () => {
    const result = calculateSplit({ ...base, values: { 1: '33.33', 2: '33.33', 3: '33.34' } });
    expect(result.valid).toBe(true);
    expect(result.shares).toEqual({ 1: 334, 2: 333, 3: 333 });
    expect(result.adjustedIds).toEqual([1]);
    expect(sum(result.shares)).toBe(1000);
  });

  it('says how much is left under 100%', () => {
    const result = calculateSplit({ ...base, values: { 1: '50', 2: '30', 3: '' } });
    expect(result.valid).toBe(false);
    expect(result.shares).toBeNull();
    expect(result.difference).toBe(2000);
    expect(result.message).toBe('20.00% left to assign.');
  });

  it('says how much is over 100%', () => {
    const result = calculateSplit({ ...base, values: { 1: '60', 2: '30', 3: '15.5' } });
    expect(result.valid).toBe(false);
    expect(result.difference).toBe(-550);
    expect(result.message).toBe('5.50% over 100%.');
  });

  it('flags a percentage that is not a number between 0 and 100', () => {
    const result = calculateSplit({ ...base, values: { 1: '50', 2: 'x', 3: '150' } });
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toEqual([2, 3]);
    expect(result.message).toBe('Enter each percentage as a number from 0 to 100.');
  });
});

describe('calculateSplit: unknown method', () => {
  it('is never valid', () => {
    const result = calculateSplit({ totalCents: 1000, memberIds: [1], method: 'by-item' });
    expect(result.valid).toBe(false);
  });
});

describe('splitValuesForRequest', () => {
  it('sends nothing for an even split', () => {
    expect(splitValuesForRequest({ method: 'even', memberIds: [1, 2] })).toBeUndefined();
  });

  it('sends dollar strings for custom amounts', () => {
    const out = splitValuesForRequest({ method: 'custom', memberIds: [1, 2], shares: { 1: 500, 2: 5 } });
    expect(out).toEqual({ 1: '5.00', 2: '0.05' });
  });

  it('sends percent strings for percentages', () => {
    const out = splitValuesForRequest({
      method: 'percentage',
      memberIds: [1, 2, 3],
      values: { 1: '33.33', 2: '33.33', 3: '33.34' },
    });
    expect(out).toEqual({ 1: '33.33', 2: '33.33', 3: '33.34' });
  });

  it('writes whole and short percentages with two decimals', () => {
    const out = splitValuesForRequest({ method: 'percentage', memberIds: [1, 2], values: { 1: '70', 2: '30.5' } });
    expect(out).toEqual({ 1: '70.00', 2: '30.50' });
  });
});
