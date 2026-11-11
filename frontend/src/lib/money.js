// Money and date helpers for receipts. Money is turned into cents so we never add decimals.

// "3.50" -> 350. Gives null if it is not a real amount.
export function toCents(text) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(text ?? '').trim());
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign ? -cents : cents;
}

// 4640 -> "$46.40"
export function formatCents(cents) {
  const abs = Math.abs(cents);
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$${dollars}.${rest}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-03" -> "Oct 3, 2026". Empty if it is not a date.
export function formatReceiptDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ''));
  if (!match) return '';
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return '';
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

// Store, date, item count and total for the summary. Total is all the item totals added up.
export function summarizeReceipt(receipt) {
  const items = Array.isArray(receipt?.items) ? receipt.items : [];
  const totalCents = items.reduce((sum, item) => sum + (toCents(item.line_total) ?? 0), 0);
  return {
    store: receipt?.store ?? '',
    date: formatReceiptDate(receipt?.receipt_date),
    itemCount: items.length,
    total: formatCents(totalCents),
  };
}
