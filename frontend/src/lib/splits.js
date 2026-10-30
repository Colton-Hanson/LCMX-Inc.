// splits.js — split math for the Add expense page.
//
// Money is counted in whole cents: $10.00 is 1000. Percentages are in basis points: 33.33% is 3333.
// Same rules as the backend (backend/app/services/split_calculator.py):
//   even        total divided evenly; leftover cents go one each to the first people in the list
//   custom      each person's own amount; the amounts must add up to the total
//   percentage  must add up to exactly 100%; each share rounds down to the cent, leftover cents go
//               one each to the first people in the list
// The list order is the order of memberIds, which is also the order sent as participant_ids.

export const SPLIT_METHODS = ['even', 'custom', 'percentage'];

// Largest total the database accepts: $99,999,999.99.
export const MAX_TOTAL_CENTS = 9999999999;

const MONEY_PATTERN = /^(\d{1,8})(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/;
const PERCENT_PATTERN = /^(\d{1,3})(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/;

// Turns what someone typed ("10", "10.5", "$10.50") into whole cents, or null if it is not a valid amount
// (letters, a negative sign, more than 2 decimals, too large).
export function toCents(input) {
  const match = MONEY_PATTERN.exec(String(input ?? '').trim().replace(/^\$/, ''));
  if (!match) return null;
  const whole = match[1] ?? '0';
  const fraction = (match[2] ?? match[3] ?? '').padEnd(2, '0');
  return Number(whole) * 100 + Number(fraction);
}

// Turns what someone typed ("50", "33.33", "25%") into basis points (50 -> 5000), or null if not valid.
export function toBasisPoints(input) {
  const match = PERCENT_PATTERN.exec(String(input ?? '').trim().replace(/%$/, ''));
  if (!match) return null;
  const whole = match[1] ?? '0';
  const fraction = (match[2] ?? match[3] ?? '').padEnd(2, '0');
  const basisPoints = Number(whole) * 100 + Number(fraction);
  return basisPoints > 10000 ? null : basisPoints;
}

// 334 -> "3.34". Also used for basis points: 3333 -> "33.33". Handles a negative number too.
export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
export const formatBasisPoints = formatCents;

const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// 123450 -> "$1,234.50", for showing on screen.
export const formatMoney = (cents) => moneyFormat.format(cents / 100);

// Even split: everyone gets the same whole-cent share; the first `remainder` people get one extra cent.
export function evenShares(totalCents, memberIds) {
  const base = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents % memberIds.length;
  const shares = {};
  const adjustedIds = [];
  memberIds.forEach((id, index) => {
    const extra = index < remainder ? 1 : 0;
    shares[id] = base + extra;
    if (extra) adjustedIds.push(id);
  });
  return { shares, adjustedIds };
}

// Percentage split: each share is rounded down to the cent, then the leftover cents go to the first people.
// basisPointsById is { memberId: basisPoints } and must add up to 10000 (100%).
export function percentageShares(totalCents, memberIds, basisPointsById) {
  const shares = {};
  let allocated = 0;
  memberIds.forEach((id) => {
    shares[id] = Math.floor((totalCents * basisPointsById[id]) / 10000);
    allocated += shares[id];
  });
  const adjustedIds = memberIds.slice(0, totalCents - allocated);
  adjustedIds.forEach((id) => {
    shares[id] += 1;
  });
  return { shares, adjustedIds };
}

// The one function the page calls on every keystroke.
//   totalCents  the expense total in cents (an integer), or null while it is not a valid amount yet
//   memberIds   the people in the split, in the order they will be sent
//   method      'even' | 'custom' | 'percentage'
//   values      what was typed for each person, { memberId: 'text' } (used by custom and percentage)
// Returns:
//   valid        true when the split can be saved
//   shares       { memberId: cents } or null when no preview can be shown yet
//   adjustedIds  people who got a leftover cent
//   difference   custom: cents still to assign (negative = over the total); percentage: basis points still
//                to assign (negative = over 100%); even: 0
//   invalidIds   people whose typed amount is not a valid number
//   message      a short plain sentence saying what to fix, or '' when valid
export function calculateSplit({ totalCents, memberIds, method, values = {} }) {
  const result = { valid: false, shares: null, adjustedIds: [], difference: 0, invalidIds: [], message: '' };

  if (!Number.isInteger(totalCents) || totalCents <= 0 || totalCents > MAX_TOTAL_CENTS) {
    result.message = 'Enter a total above $0.00.';
    return result;
  }
  if (!memberIds.length) {
    result.message = 'Pick at least one person to split with.';
    return result;
  }

  if (method === 'even') {
    return { ...result, ...evenShares(totalCents, memberIds), valid: true };
  }

  if (method === 'custom') {
    const shares = {};
    memberIds.forEach((id) => {
      const text = String(values[id] ?? '').trim();
      const cents = text === '' ? 0 : toCents(text);
      if (cents === null) result.invalidIds.push(id);
      shares[id] = cents ?? 0;
    });
    const assigned = memberIds.reduce((sum, id) => sum + shares[id], 0);
    result.shares = shares;
    result.difference = totalCents - assigned;
    if (result.invalidIds.length) {
      result.message = 'Enter each amount as dollars and cents, like 12.50.';
    } else if (result.difference > 0) {
      result.message = `${formatMoney(result.difference)} left to assign.`;
    } else if (result.difference < 0) {
      result.message = `${formatMoney(-result.difference)} over the total.`;
    } else {
      result.valid = true;
    }
    return result;
  }

  if (method === 'percentage') {
    const basisPointsById = {};
    memberIds.forEach((id) => {
      const text = String(values[id] ?? '').trim();
      const basisPoints = text === '' ? 0 : toBasisPoints(text);
      if (basisPoints === null) result.invalidIds.push(id);
      basisPointsById[id] = basisPoints ?? 0;
    });
    const assigned = memberIds.reduce((sum, id) => sum + basisPointsById[id], 0);
    result.difference = 10000 - assigned;
    if (result.invalidIds.length) {
      result.message = 'Enter each percentage as a number from 0 to 100.';
    } else if (result.difference > 0) {
      result.message = `${formatBasisPoints(result.difference)}% left to assign.`;
    } else if (result.difference < 0) {
      result.message = `${formatBasisPoints(-result.difference)}% over 100%.`;
    } else {
      result.valid = true;
      Object.assign(result, percentageShares(totalCents, memberIds, basisPointsById));
    }
    return result;
  }

  result.message = 'Choose how to split this expense.';
  return result;
}

// What to send as split_values for the chosen method: dollar strings for custom, percent strings for
// percentage, and nothing for even (the backend works it out). Keys are member ids.
export function splitValuesForRequest({ method, memberIds, values = {}, shares }) {
  if (method === 'custom') {
    return Object.fromEntries(memberIds.map((id) => [id, formatCents(shares[id])]));
  }
  if (method === 'percentage') {
    return Object.fromEntries(memberIds.map((id) => [id, formatBasisPoints(toBasisPoints(values[id]) ?? 0)]));
  }
  return undefined;
}
