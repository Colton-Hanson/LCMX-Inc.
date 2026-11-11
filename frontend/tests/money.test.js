// Tests for the money and date helpers.
import { toCents, formatCents, formatReceiptDate, summarizeReceipt } from '../src/lib/money.js';

describe('toCents', () => {
  it('turns decimal strings into whole cents', () => {
    expect(toCents('3.50')).toBe(350);
    expect(toCents('7')).toBe(700);
    expect(toCents('7.5')).toBe(750);
    expect(toCents('0.07')).toBe(7);
    expect(toCents('-1.25')).toBe(-125);
  });
  it('returns null for anything that is not a plain amount', () => {
    expect(toCents('')).toBeNull();
    expect(toCents(null)).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(toCents('1.234')).toBeNull();
    expect(toCents('1,000.00')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats dollars and cents', () => {
    expect(formatCents(4640)).toBe('$46.40');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(123456789)).toBe('$1,234,567.89');
    expect(formatCents(-125)).toBe('-$1.25');
  });
});

describe('formatReceiptDate', () => {
  it('formats like the mockup', () => {
    expect(formatReceiptDate('2026-10-03')).toBe('Oct 3, 2026');
    expect(formatReceiptDate('2026-11-06')).toBe('Nov 6, 2026');
  });
  it('returns an empty string for a missing or invalid date', () => {
    expect(formatReceiptDate(null)).toBe('');
    expect(formatReceiptDate('soon')).toBe('');
    expect(formatReceiptDate('2026-13-01')).toBe('');
  });
});

describe('summarizeReceipt', () => {
  it('adds the line totals in cents so 0.1 + 0.2 style errors cannot happen', () => {
    const summary = summarizeReceipt({
      store: 'Corner Market',
      receipt_date: '2026-10-03',
      items: [
        { line_total: '0.10' },
        { line_total: '0.20' },
        { line_total: '46.10' },
      ],
    });
    expect(summary).toEqual({ store: 'Corner Market', date: 'Oct 3, 2026', itemCount: 3, total: '$46.40' });
  });
  it('copes with a receipt that has no items yet', () => {
    expect(summarizeReceipt({ store: null, receipt_date: null, items: [] })).toEqual({ store: '', date: '', itemCount: 0, total: '$0.00' });
  });
});
