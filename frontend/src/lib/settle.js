// Helpers for settling up. Amounts are whole cents.
import { formatMoney, toCents } from './splits.js';

// The part of an email before the @, for short titles.
export const shortName = (text) => String(text ?? '').split('@')[0] || String(text ?? '');

// Checks a typed part payment. Returns { cents, error }.
export function checkPartAmount(text, owedCents) {
  const cents = toCents(text);
  const ok = cents !== null && cents > 0 && cents <= owedCents;
  return { cents: ok ? cents : null, error: ok ? '' : `Enter an amount between $0.01 and ${formatMoney(owedCents)}.` };
}

// The server sends times in UTC without a zone, so add one before reading it.
const toDate = (value) => new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(String(value)) ? value : `${value}Z`);

// "Nov 3" for the history list. Empty if the date can't be read.
export function shortDate(value) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Newest first. Used to merge the lists of several groups.
export const newestFirst = (a, b) => toDate(b.settlement_time) - toDate(a.settlement_time) || b.id - a.id;

// One history line from your side. names is { userId: 'name' }.
export function historyText(s, myId, names = {}) {
  const nameOf = (id) => names[id] ?? 'A group member';
  const iPaid = s.paid_by === myId;
  const other = nameOf(iPaid ? s.recipient : s.paid_by);
  const byMe = (s.recorded_by ?? s.paid_by) === myId;
  if (iPaid && byMe) return `You marked a payment to ${other} as paid outside the app`;
  if (iPaid) return `${other} marked your payment as received`;
  if (byMe) return `You marked ${other} as paid (manual)`;
  return `${other} marked a payment to you as paid outside the app`;
}

// Keys ("group-user") of people you marked as received yourself.
export function manualKeys(settlements, myId) {
  const keys = new Set();
  (settlements ?? []).forEach((s) => {
    if (s.recipient === myId && (s.recorded_by ?? s.paid_by) === myId) keys.add(`${s.group_id}-${s.paid_by}`);
  });
  return keys;
}
