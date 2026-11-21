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
export const toDate = (value) => new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(String(value)) ? value : `${value}Z`);

// A day for lists: "Today", "Yesterday", or "Nov 20" (with the year when it is not this year).
// Empty if the date can't be read. `now` is only for tests.
export function formatDay(value, now = new Date()) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const options = date.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Newest first. Used to merge the lists of several groups. (An id that isn't a number counts as 0.)
export const newestFirst = (a, b) => toDate(b.settlement_time) - toDate(a.settlement_time) || (Number(b.id) || 0) - (Number(a.id) || 0);

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

// Money that was paid to you in the same month as `now`, from the server's settlements.
// Returns { total, byRow, manualTotal, manualByRow } in cents. byRow is keyed "group-payer", like a row on the
// Balances screen. The manual ones are the payments you recorded yourself (recorded_by is you), not the payer.
export function receivedThisMonth(settlements, myId, now = new Date()) {
  const byRow = {};
  const manualByRow = {};
  let total = 0;
  let manualTotal = 0;
  (settlements ?? []).forEach((s) => {
    if (s.recipient !== myId || s.paid_by === myId) return;
    const when = toDate(s.settlement_time);
    if (Number.isNaN(when.getTime()) || when.getFullYear() !== now.getFullYear() || when.getMonth() !== now.getMonth()) return;
    const cents = toCents(s.amount);
    if (cents === null) return;
    const key = `${s.group_id}-${s.paid_by}`;
    byRow[key] = (byRow[key] ?? 0) + cents;
    total += cents;
    if ((s.recorded_by ?? s.paid_by) === myId) {
      manualByRow[key] = (manualByRow[key] ?? 0) + cents;
      manualTotal += cents;
    }
  });
  return { total, byRow, manualTotal, manualByRow };
}
