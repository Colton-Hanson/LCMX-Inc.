// expenseValidators.js — checks for the Add expense form. Each returns '' when fine, or a message to show.

import { MAX_TOTAL_CENTS, toCents } from './splits.js';

export const EXPENSE_TITLE_MAX_LENGTH = 100; // the backend allows up to 100 characters

// Title: required, up to 100 characters.
export function validateExpenseTitle(title) {
  const value = (title ?? '').trim(); // ignore spaces at the ends
  if (!value) return 'Enter a title for this expense.';
  if (Array.from(value).length > EXPENSE_TITLE_MAX_LENGTH) {
    return `Title must be ${EXPENSE_TITLE_MAX_LENGTH} characters or fewer.`;
  }
  return '';
}

// Total: dollars and cents, above $0.00 and no more than $99,999,999.99.
export function validateExpenseTotal(text) {
  const value = String(text ?? '').trim();
  if (!value) return 'Enter the total amount.';
  const cents = toCents(value); // null when it is not a valid amount
  if (cents === null) return 'Enter the total as dollars and cents, like 24.50.';
  if (cents <= 0) return 'The total must be more than $0.00.';
  if (cents > MAX_TOTAL_CENTS) return 'That total is too large.';
  return '';
}
