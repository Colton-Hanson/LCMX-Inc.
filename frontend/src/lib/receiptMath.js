// Receipt math in whole cents: line totals, lines for the mini receipt, and each person's share.
import { formatCents, toCents } from './splits.js';

// Quantity typed as a whole number from 1 up, or null.
export function toQuantity(text) {
  const value = String(text ?? '').trim();
  return /^\d{1,4}$/.test(value) && Number(value) >= 1 ? Number(value) : null;
}

// Quantity times price, or null when either can't be read.
export function lineCents(quantity, priceText) {
  const qty = toQuantity(quantity);
  const price = toCents(priceText);
  return qty === null || price === null ? null : qty * price;
}

// Splits one amount evenly. Leftover cents go to the first person so it always adds up.
export function splitEvenly(cents, ids) {
  if (ids.length === 0) return {};
  const base = Math.floor(cents / ids.length);
  const shares = Object.fromEntries(ids.map((id) => [id, base]));
  shares[ids[0]] += cents - base * ids.length;
  return shares;
}

// Everyone's total from the items. items: [{ cents, people: [id] }], order: ids in display order.
// Returns { shares: { id: cents }, assigned, leftOut, total }.
export function shareTotals(items, order) {
  const shares = Object.fromEntries(order.map((id) => [id, 0]));
  let assigned = 0;
  let leftOut = 0;
  items.forEach((item) => {
    const cents = item.cents ?? 0;
    const people = order.filter((id) => item.people.includes(id));
    if (people.length === 0) {
      leftOut += cents;
      return;
    }
    assigned += cents;
    Object.entries(splitEvenly(cents, people)).forEach(([id, part]) => {
      shares[id] += part;
    });
  });
  return { shares, assigned, leftOut, total: assigned + leftOut };
}

// Lines for the mini receipt: "PASTA  2 @ 2.19" and "4.38".
export function slipLines(items) {
  return items.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const name = String(item.name ?? '').trim().toUpperCase() || `ITEM ${index + 1}`;
    const unit = toCents(item.unit_price);
    const total = toCents(item.line_total) ?? (unit === null ? null : unit * qty);
    return {
      key: item.id ?? index,
      label: qty > 1 && unit !== null ? `${name}  ${qty} @ ${formatCents(unit)}` : name,
      amount: total === null ? '' : formatCents(total),
    };
  });
}

// "10/03/26" from "2026-10-03". Empty if it is not a date.
export function slipDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ''));
  return match ? `${match[2]}/${match[3]}/${match[1].slice(2)}` : '';
}
