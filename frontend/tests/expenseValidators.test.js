// expenseValidators.test.js — checks the title and total rules for the Add expense form. Run with: npm test

import { validateExpenseTitle, validateExpenseTotal } from '../src/lib/expenseValidators.js';

describe('validateExpenseTitle', () => {
  it('accepts a normal title', () => {
    expect(validateExpenseTitle('Groceries')).toBe('');
    expect(validateExpenseTitle('  Pizza night  ')).toBe('');
  });

  it('asks for a title when it is empty or only spaces', () => {
    expect(validateExpenseTitle('')).toBe('Enter a title for this expense.');
    expect(validateExpenseTitle('   ')).toBe('Enter a title for this expense.');
    expect(validateExpenseTitle(undefined)).toBe('Enter a title for this expense.');
  });

  it('allows 100 characters and no more', () => {
    expect(validateExpenseTitle('a'.repeat(100))).toBe('');
    expect(validateExpenseTitle('a'.repeat(101))).toBe('Title must be 100 characters or fewer.');
  });
});

describe('validateExpenseTotal', () => {
  it('accepts dollars and cents', () => {
    ['10', '10.5', '10.50', '$24.50', '.99', '99999999.99'].forEach((good) => {
      expect(validateExpenseTotal(good)).toBe('');
    });
  });

  it('asks for a total when it is empty', () => {
    expect(validateExpenseTotal('')).toBe('Enter the total amount.');
    expect(validateExpenseTotal('  ')).toBe('Enter the total amount.');
  });

  it('rejects amounts that are not dollars and cents', () => {
    ['abc', '-5', '1.234', '1,000', '12.5.1'].forEach((bad) => {
      expect(validateExpenseTotal(bad)).toBe('Enter the total as dollars and cents, like 24.50.');
    });
  });

  it('rejects zero and amounts that are too large', () => {
    expect(validateExpenseTotal('0')).toBe('The total must be more than $0.00.');
    expect(validateExpenseTotal('0.00')).toBe('The total must be more than $0.00.');
    expect(validateExpenseTotal('100000000')).toBe('Enter the total as dollars and cents, like 24.50.');
  });
});
