// Tests for the check and assign screen (SCRUM-134): the share math, editing items, picking people,
// saving the items and the expense, and every state the screen can be in. The API modules are mocked.

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import * as receiptsApi from '../src/api/receipts.js';
import { lineCents, shareTotals, splitEvenly, toQuantity } from '../src/lib/receiptMath.js';
import { buildAssignments } from '../src/components/receipt/ReceiptReview.jsx';
import { checkA11y } from './a11y.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');
vi.mock('../src/api/receipts.js');
vi.mock('../src/api/proposed.js', async (original) => ({ ...(await original()), deleteReceiptPicture: vi.fn() }));

const group = { id: 5, name: 'Lake House', type: 'outing' };
const members = [
  { user_id: 1, email: 'sam@example.com', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];
const item = (id, name, quantity, unit, position) => ({ id, name, quantity, unit_price: unit, line_total: ((quantity * Math.round(Number(unit) * 100)) / 100).toFixed(2), position });
// Milk 2 x 3.50 = 7.00, Bread 4.25, Gum 1.00. Total 12.25.
const receipt = {
  id: 9, group_id: 5, uploader: 1, expense_id: null, status: 'read', store: 'Corner Market', store_location: null, receipt_date: '2026-10-03',
  items: [item(1, 'Milk', 2, '3.50', 0), item(2, 'Bread', 1, '4.25', 1), item(3, 'Gum', 1, '1.00', 2)],
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('groups:1', JSON.stringify([group]));
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
  receiptsApi.getReceipt.mockResolvedValue(ok(receipt));
  // Like the server: the saved items come back in the order sent, each with its id.
  receiptsApi.saveReceiptItems.mockImplementation((id, list) =>
    Promise.resolve(ok({ receipt_id: id, items: list.map((it, i) => ({ ...it, id: it.id ?? 100 + i, position: i })) }))
  );
  receiptsApi.confirmReceipt.mockResolvedValue(
    ok({ receipt_id: 9, expense_id: 30, status: 'confirmed', amount: '12.25', shares: { 1: '4.11', 2: '4.07', 3: '4.07' }, excluded_item_ids: [] }, 201)
  );
  receiptsApi.getReceiptPicture.mockResolvedValue({ ok: true, status: 200, blob: new Blob(['jpeg'], { type: 'image/jpeg' }) });
  groupsApi.getGroupEvents.mockResolvedValue(ok([]));
  expensesApi.getGroupExpenses.mockResolvedValue(ok([]));
});

async function openReview() {
  const user = userEvent.setup();
  renderApp('/receipts/9/review');
  await screen.findByRole('heading', { name: 'What the AI found', level: 2 });
  return user;
}
const row = (name) => screen.getByRole('group', { name: new RegExp(`^Item \\d+: ${name}$`) });
const shareRows = () => Array.from(document.querySelectorAll('.prow')).map((el) => el.textContent);

describe('Receipt math', () => {
  it('reads a quantity as a whole number from 1 up', () => {
    expect(toQuantity('3')).toBe(3);
    expect(toQuantity(' 12 ')).toBe(12);
    ['0', '-1', '1.5', 'two', ''].forEach((text) => expect(toQuantity(text)).toBeNull());
  });

  it('multiplies quantity by price in cents', () => {
    expect(lineCents('2', '3.50')).toBe(700);
    expect(lineCents('3', '0.10')).toBe(30);
    expect(lineCents('x', '3.50')).toBeNull();
    expect(lineCents('2', 'abc')).toBeNull();
  });

  it('splits evenly and gives every leftover cent to the first person', () => {
    expect(splitEvenly(700, [1, 2])).toEqual({ 1: 350, 2: 350 });
    expect(splitEvenly(100, [1, 2, 3])).toEqual({ 1: 34, 2: 33, 3: 33 });
    expect(splitEvenly(200, [1, 2, 3])).toEqual({ 1: 68, 2: 66, 3: 66 });
    expect(splitEvenly(1, [1, 2, 3])).toEqual({ 1: 1, 2: 0, 3: 0 });
    expect(splitEvenly(500, [])).toEqual({});
  });

  it('always adds up to the line total', () => {
    for (let cents = 0; cents <= 250; cents += 7) {
      for (let count = 1; count <= 6; count += 1) {
        const shares = splitEvenly(cents, Array.from({ length: count }, (_, i) => i));
        expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(cents);
      }
    }
  });

  it('adds up each person’s items and leaves unassigned items out', () => {
    const totals = shareTotals(
      [{ cents: 700, people: [1, 2] }, { cents: 425, people: [3] }, { cents: 100, people: [] }, { cents: 100, people: [2, 3, 1] }],
      [1, 2, 3]
    );
    expect(totals).toEqual({ shares: { 1: 384, 2: 383, 3: 458 }, assigned: 1225, leftOut: 100, total: 1325 });
  });

  it('ignores people who are not on the receipt', () => {
    expect(shareTotals([{ cents: 100, people: [1, 9] }], [1, 2]).shares).toEqual({ 1: 100, 2: 0 });
  });
});

describe('Confirm body', () => {
  const sum = (shares) => shares.reduce((total, s) => total + Math.round(Number(s.amount) * 100), 0);

  it('makes each item’s shares add up to its line total to the cent, as decimal strings', () => {
    const rows = [{ cents: 100, in: [1, 2, 3] }, { cents: 1999, in: [2, 3] }, { cents: 7, in: [1, 2, 3, 4] }];
    const assignments = buildAssignments(rows, [11, 12, 13]);
    expect(assignments[0]).toEqual({ item_id: 11, shares: [{ user_id: 1, amount: '0.34' }, { user_id: 2, amount: '0.33' }, { user_id: 3, amount: '0.33' }] });
    assignments.forEach((a, i) => expect(sum(a.shares)).toBe(rows[i].cents));
    assignments.forEach((a) => a.shares.forEach((s) => expect(s.amount).toMatch(/^\d+\.\d{2}$/)));
  });

  it('always adds up for many totals and group sizes', () => {
    for (let cents = 1; cents <= 400; cents += 13) {
      for (let count = 1; count <= 5; count += 1) {
        const people = Array.from({ length: count }, (_, i) => i + 1);
        const [a] = buildAssignments([{ cents, in: people }], [1]);
        expect(sum(a.shares)).toBe(cents);
      }
    }
  });

  it('skips items with no price and items nobody is on, and drops zero shares', () => {
    const assignments = buildAssignments([{ cents: 0, in: [1] }, { cents: 500, in: [] }, { cents: 2, in: [1, 2, 3] }], [1, 2, 3]);
    expect(assignments).toEqual([{ item_id: 3, shares: [{ user_id: 1, amount: '0.02' }] }]);
  });
});

describe('Check and assign: what it shows', () => {
  it('shows the title, the steps, the AI note and what was read', async () => {
    await openReview();
    expect(screen.getByRole('heading', { name: 'Check your receipt', level: 1 })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('Check and assign');
    expect(screen.getByText(/It can make mistakes\. Fix any name, quantity, or price/)).toBeInTheDocument();
    expect(screen.getByLabelText('Store')).toHaveValue('Corner Market');
    expect(screen.getByLabelText('Date')).toHaveValue('Oct 3, 2026');
    expect(screen.getByLabelText('Group')).toHaveValue('Lake House');
    expect(screen.getByLabelText('Paid by')).toHaveValue('1');
    expect(within(row('Milk')).getByLabelText('Item name')).toHaveValue('Milk');
    expect(within(row('Milk')).getByLabelText('Quantity for Milk')).toHaveValue('2');
    expect(within(row('Milk')).getByLabelText('Price for Milk')).toHaveValue('3.50');
  });

  it('starts with everyone in on every item and shows each person’s share', async () => {
    await openReview();
    expect(within(row('Milk')).getByRole('button', { name: 'Who is in on Milk: Everyone (3)' })).toBeInTheDocument();
    // 7.00 -> 2.34 2.33 2.33, 4.25 -> 1.43 1.41 1.41, 1.00 -> 0.34 0.33 0.33
    expect(shareRows()).toEqual(['Ssam@example.com (you)34%$4.11', 'Mmaya@example.com33%$4.07', 'Ddevin@example.com33%$4.07']);
    const totals = screen.getByText('Split between people').closest('dl');
    expect(totals).toHaveTextContent('Receipt total$12.25');
    expect(totals).toHaveTextContent('Left out (not assigned)$0.00');
    expect(totals).toHaveTextContent('Split between people$12.25');
  });

  it('shows the mini receipt, the picture and the delete picture button', async () => {
    await openReview();
    expect(screen.getByRole('group', { name: 'Receipt: Corner Market, 10/03/26, 3 items, total 12.25' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Photo of the receipt from Corner Market' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Delete receipt picture' })).toBeInTheDocument();
  });

  it('shows Picture removed when the picture was deleted', async () => {
    receiptsApi.getReceiptPicture.mockResolvedValue(fail(404, { detail: 'Receipt picture was removed.' }));
    await openReview();
    expect(await screen.findByRole('img', { name: 'Picture removed. The items are kept.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete receipt picture' })).not.toBeInTheDocument();
  });

  it('has no accessibility problems', async () => {
    const user = await openReview();
    expect(await checkA11y()).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Who is in on Gum: Everyone (3)' }));
    await user.click(within(screen.getByRole('group', { name: 'Who is in on Gum' })).getByRole('button', { name: 'None' }));
    expect(await checkA11y()).toHaveNoViolations();
  });
});

describe('Check and assign: picking people', () => {
  it('takes one person off an item and updates the shares live', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is in on Bread: Everyone (3)' }));
    const panel = screen.getByRole('group', { name: 'Who is in on Bread' });
    const devin = within(panel).getByRole('button', { name: 'devin@example.com' });
    expect(devin).toHaveAttribute('aria-pressed', 'true');
    await user.click(devin);
    expect(devin).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Who is in on Bread: 2 of 3' })).toHaveAttribute('aria-expanded', 'true');
    // Bread 4.25 between two -> 2.13 and 2.12
    expect(shareRows()).toEqual(['Ssam@example.com (you)39%$4.81', 'Mmaya@example.com39%$4.78', 'Ddevin@example.com22%$2.66']);
  });

  it('has None, Everyone and Done on each item', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is in on Gum: Everyone (3)' }));
    const panel = screen.getByRole('group', { name: 'Who is in on Gum' });
    await user.click(within(panel).getByRole('button', { name: 'None' }));
    expect(screen.getByRole('button', { name: 'Who is in on Gum: Nobody' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Everyone' }));
    expect(screen.getByRole('button', { name: 'Who is in on Gum: Everyone (3)' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('group', { name: 'Who is in on Gum' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Who is in on Gum: Everyone (3)' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('flags an item nobody is on and leaves it out of every share', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is in on Gum: Everyone (3)' }));
    await user.click(within(screen.getByRole('group', { name: 'Who is in on Gum' })).getByRole('button', { name: 'None' }));
    expect(within(row('Gum')).getByText('Not assigned yet. It is left out of everyone’s share until you pick someone.')).toBeInTheDocument();
    expect(screen.getByText('1 item is not assigned yet. $1.00 is left out of the split.')).toBeInTheDocument();
    const totals = screen.getByText('Split between people').closest('dl');
    expect(totals).toHaveTextContent('Left out (not assigned)$1.00');
    expect(totals).toHaveTextContent('Split between people$11.25');
    expect(screen.getByRole('button', { name: 'Save expense' })).toBeEnabled();
  });

  it('searches the people in a panel', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is in on Milk: Everyone (3)' }));
    const panel = screen.getByRole('group', { name: 'Who is in on Milk' });
    await user.type(within(panel).getByLabelText('Search people'), 'may');
    expect(within(panel).getByRole('button', { name: 'maya@example.com' })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'devin@example.com' })).not.toBeInTheDocument();
    await user.type(within(panel).getByLabelText('Search people'), 'zzz');
    expect(within(panel).getByText('Nobody matches that search.')).toBeInTheDocument();
  });

  it('takes someone off the whole receipt with the receipt picker, and puts them back on every item', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is on this receipt: Everyone (3)' }));
    const panel = screen.getByRole('group', { name: 'Who is on this receipt' });
    await user.click(within(panel).getByRole('button', { name: 'devin@example.com' }));
    expect(screen.getByRole('button', { name: 'Who is on this receipt: 2 of 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Who is in on Milk: Everyone (2)' })).toBeInTheDocument();
    expect(shareRows()).toEqual(['Ssam@example.com (you)50%$6.13', 'Mmaya@example.com50%$6.12']);
    await user.click(within(panel).getByRole('button', { name: 'devin@example.com' }));
    expect(screen.getByRole('button', { name: 'Who is in on Milk: Everyone (3)' })).toBeInTheDocument();
  });

  it('works with the keyboard', async () => {
    const user = await openReview();
    const button = screen.getByRole('button', { name: 'Who is in on Milk: Everyone (3)' });
    button.focus();
    await user.keyboard('{Enter}');
    const panel = screen.getByRole('group', { name: 'Who is in on Milk' });
    await user.tab();
    expect(within(panel).getByLabelText('Search people')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(within(panel).getByRole('button', { name: 'None' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Who is in on Milk: Nobody' })).toBeInTheDocument();
  });
});

describe('Check and assign: editing items', () => {
  it('saves the whole item list when a changed field is left', async () => {
    const user = await openReview();
    const price = within(row('Milk')).getByLabelText('Price for Milk');
    await user.clear(price);
    await user.type(price, '4.00');
    expect(receiptsApi.saveReceiptItems).not.toHaveBeenCalled();
    await user.tab();
    expect(receiptsApi.saveReceiptItems).toHaveBeenCalledWith(9, [
      { id: 1, name: 'Milk', quantity: 2, unit_price: '4.00' },
      { id: 2, name: 'Bread', quantity: 1, unit_price: '4.25' },
      { id: 3, name: 'Gum', quantity: 1, unit_price: '1.00' },
    ]);
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(screen.getByText('Split between people').closest('dl')).toHaveTextContent('Receipt total$13.25');
  });

  it('updates the shares and the mini receipt as a name and quantity change', async () => {
    const user = await openReview();
    const name = within(row('Gum')).getByLabelText('Item name');
    await user.clear(name);
    await user.type(name, 'Mints');
    const qty = within(row('Mints')).getByLabelText('Quantity for Mints');
    await user.clear(qty);
    await user.type(qty, '3');
    expect(screen.getByRole('group', { name: 'Receipt: Corner Market, 10/03/26, 3 items, total 14.25' })).toHaveTextContent('MINTS 3 @ 1.00');
    expect(screen.getByText('Split between people').closest('dl')).toHaveTextContent('Split between people$14.25');
  });

  it('does not save while a field cannot be read, and marks it', async () => {
    const user = await openReview();
    const qty = within(row('Milk')).getByLabelText('Quantity for Milk');
    await user.clear(qty);
    await user.type(qty, '1.5');
    await user.tab();
    expect(qty).toHaveAttribute('aria-invalid', 'true');
    expect(receiptsApi.saveReceiptItems).not.toHaveBeenCalled();
    const save = screen.getByRole('button', { name: 'Save expense' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Fix the highlighted items to save.');
  });

  it('marks an empty name and a price that is not money', async () => {
    const user = await openReview();
    await user.clear(within(row('Bread')).getByLabelText('Item name'));
    expect(screen.getByRole('group', { name: 'Item 2: item 2' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Item 2: item 2' })).getByLabelText('Item name')).toHaveAttribute('aria-invalid', 'true');
    const price = within(row('Gum')).getByLabelText('Price for Gum');
    await user.clear(price);
    await user.type(price, '1.234');
    expect(price).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the server message when the items cannot be saved', async () => {
    receiptsApi.saveReceiptItems.mockResolvedValue(fail(409, { detail: 'This receipt can no longer be changed.' }));
    const user = await openReview();
    const price = within(row('Milk')).getByLabelText('Price for Milk');
    await user.clear(price);
    await user.type(price, '4.00');
    await user.tab();
    expect(await findAlert('This receipt can no longer be changed.')).toBeInTheDocument();
  });

  it('warns, without blocking, when the receipt’s own numbers do not add up', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...receipt, items: [{ ...receipt.items[0], line_total: '9.99' }, receipt.items[1]] }));
    await openReview();
    expect(screen.getByText('Some item totals on the receipt don’t match the quantity times the price. Check the prices. You can still save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save expense' })).toBeEnabled();
  });

  it('warns, without blocking, when the items do not add up to the printed total', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...receipt, total: '13.00' }));
    await openReview();
    expect(screen.getByText('The items add up to $12.25, but the receipt total says $13.00. Check the prices. You can still save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save expense' })).toBeEnabled();
  });

  it('has no warning when everything adds up', async () => {
    await openReview();
    expect(screen.queryByText(/You can still save/)).not.toBeInTheDocument();
  });
});

describe('Check and assign: saving and cancelling', () => {
  // Changed for the real backend: saving confirms the receipt with each item's shares (no plain expense call).
  it('confirms the receipt with each item split in cents, then goes to the group', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    // Milk 7.00 -> 2.34 2.33 2.33, Bread 4.25 -> 1.43 1.41 1.41, Gum 1.00 -> 0.34 0.33 0.33
    const share = (user_id, amount) => ({ user_id, amount });
    expect(receiptsApi.confirmReceipt).toHaveBeenCalledWith(9, {
      paid_by: 1,
      description: 'Corner Market',
      assignments: [
        { item_id: 1, shares: [share(1, '2.34'), share(2, '2.33'), share(3, '2.33')] },
        { item_id: 2, shares: [share(1, '1.43'), share(2, '1.41'), share(3, '1.41')] },
        { item_id: 3, shares: [share(1, '0.34'), share(2, '0.33'), share(3, '0.33')] },
      ],
    });
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
    expect(receiptsApi.saveReceiptItems).not.toHaveBeenCalled();
    expect(await screen.findByText('Expense “Corner Market” saved: $12.25 shared by 3 people.')).toBeInTheDocument();
  });

  it('leaves out unassigned items and people with no share, and uses the chosen payer and store name', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is in on Gum: Everyone (3)' }));
    const gum = screen.getByRole('group', { name: 'Who is in on Gum' });
    await user.click(within(gum).getByRole('button', { name: 'None' }));
    await user.click(within(gum).getByRole('button', { name: 'Done' }));
    for (const name of ['Milk', 'Bread']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^Who is in on ${name}:`) }));
      const panel = screen.getByRole('group', { name: `Who is in on ${name}` });
      await user.click(within(panel).getByRole('button', { name: 'devin@example.com' }));
      await user.click(within(panel).getByRole('button', { name: 'Done' }));
    }
    await user.selectOptions(screen.getByLabelText('Paid by'), 'maya@example.com');
    await user.clear(screen.getByLabelText('Store'));
    await user.type(screen.getByLabelText('Store'), 'Groceries run');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    // Gum is left out of assignments, so the server excludes it. Milk 3.50 each, Bread 2.13 and 2.12.
    expect(receiptsApi.confirmReceipt).toHaveBeenCalledWith(9, {
      paid_by: 2,
      description: 'Groceries run',
      assignments: [
        { item_id: 1, shares: [{ user_id: 1, amount: '3.50' }, { user_id: 2, amount: '3.50' }] },
        { item_id: 2, shares: [{ user_id: 1, amount: '2.13' }, { user_id: 2, amount: '2.12' }] },
      ],
    });
  });

  it('uses the item ids from the latest items save', async () => {
    receiptsApi.saveReceiptItems.mockImplementation((id, list) =>
      Promise.resolve(ok({ receipt_id: id, items: list.map((it, i) => ({ ...it, id: 41 + i, position: i })) }))
    );
    const user = await openReview();
    const price = within(row('Gum')).getByLabelText('Price for Gum');
    await user.clear(price);
    await user.type(price, '2.00');
    await user.tab(); // saves on leaving the field
    await screen.findByText('Changes saved.');
    const name = within(row('Milk')).getByLabelText('Item name');
    await user.type(name, 's');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(receiptsApi.confirmReceipt).toHaveBeenCalled());
    // The second save sends the ids the first save gave back.
    expect(receiptsApi.saveReceiptItems.mock.calls[1][1].map((it) => it.id)).toEqual([41, 42, 43]);
    expect(receiptsApi.confirmReceipt.mock.calls[0][1].assignments.map((a) => a.item_id)).toEqual([41, 42, 43]);
  });

  it('skips an item with no price', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...receipt, items: [...receipt.items.slice(0, 2), item(3, 'Free bag', 1, '0.00', 2)] }));
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(receiptsApi.confirmReceipt.mock.calls[0][1].assignments.map((a) => a.item_id)).toEqual([1, 2]);
  });

  it('sends the chosen event, and none when the group has no events', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([{ id: 7, group_id: 5, name: 'Lake Cabin', member_ids: [1, 2] }]));
    const user = await openReview();
    const picker = await screen.findByLabelText('Event (optional)');
    expect(picker).toHaveValue('');
    await user.selectOptions(picker, 'Lake Cabin');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(receiptsApi.confirmReceipt.mock.calls[0][1].event_id).toBe(7);
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('has no event picker when the group has no events and sends no event_id', async () => {
    const user = await openReview();
    expect(screen.queryByLabelText('Event (optional)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(receiptsApi.confirmReceipt.mock.calls[0][1]).not.toHaveProperty('event_id');
  });

  it('saves edited items first, then the expense', async () => {
    const user = await openReview();
    const price = within(row('Gum')).getByLabelText('Price for Gum');
    await user.clear(price);
    await user.type(price, '2.00');
    receiptsApi.saveReceiptItems.mockClear();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(receiptsApi.confirmReceipt).toHaveBeenCalled());
    expect(receiptsApi.saveReceiptItems.mock.calls.at(-1)[1][2]).toEqual({ id: 3, name: 'Gum', quantity: 1, unit_price: '2.00' });
    const gum = receiptsApi.confirmReceipt.mock.calls[0][1].assignments[2];
    expect(gum.shares.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0)).toBe(200);
  });

  it('calls the expense "Receipt" when the store name is empty', async () => {
    const user = await openReview();
    await user.clear(screen.getByLabelText('Store'));
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(receiptsApi.confirmReceipt.mock.calls[0][1].description).toBe('Receipt');
  });

  it('shows the server message when the server sends it as an object', async () => {
    receiptsApi.confirmReceipt.mockResolvedValue(fail(409, { detail: { code: 'not_ready', message: 'Receipt is not ready for confirmation.', action: 'Reload the receipt.' } }));
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await findAlert('Receipt is not ready for confirmation.')).toBeInTheDocument();
  });

  it('cannot save when nothing is assigned, and says why', async () => {
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Who is on this receipt: Everyone (3)' }));
    await user.click(within(screen.getByRole('group', { name: 'Who is on this receipt' })).getByRole('button', { name: 'None' }));
    const save = screen.getByRole('button', { name: 'Save expense' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Pick who shares at least one item to save.');
    expect(screen.getByText('Nobody is on this receipt yet.')).toBeInTheDocument();
    expect(screen.getByText('3 items are not assigned yet. $12.25 is left out of the split.')).toBeInTheDocument();
  });

  it('shows the server message when the expense cannot be saved, and lets you try again', async () => {
    receiptsApi.confirmReceipt.mockResolvedValue(fail(422, { detail: 'Shares must add up to the total.' }));
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await findAlert('Shares must add up to the total.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save expense' })).toBeEnabled();
  });

  it('says so when the server cannot be reached', async () => {
    receiptsApi.confirmReceipt.mockResolvedValue(network);
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await findAlert('We couldn’t reach the server.')).toBeInTheDocument();
  });

  it('sends a logged-out user to log in', async () => {
    receiptsApi.confirmReceipt.mockResolvedValue(fail(401));
    const user = await openReview();
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('Cancel goes Home and saves nothing', async () => {
    await openReview();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/home');
    expect(screen.getByText(/Cancel throws away what the AI found\./)).toBeInTheDocument();
    expect(receiptsApi.confirmReceipt).not.toHaveBeenCalled();
    expect(receiptsApi.saveReceiptItems).not.toHaveBeenCalled();
  });
});

describe('Check and assign: when the receipt is not ready', () => {
  const open = async (data) => {
    receiptsApi.getReceipt.mockResolvedValue(data);
    renderApp('/receipts/9/review');
  };

  it('shows a loading line while it waits', async () => {
    receiptsApi.getReceipt.mockReturnValue(new Promise(() => {}));
    renderApp('/receipts/9/review');
    expect(await screen.findByText('Loading your receipt…')).toBeInTheDocument();
  });

  it('says the AI is still reading for uploaded and reading', async () => {
    await open(ok({ ...receipt, status: 'uploaded', items: [] }));
    expect(await screen.findByRole('heading', { name: 'The AI is still reading this receipt' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the receipt' })).toHaveAttribute('href', '/receipts/9');
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('AI reads it');
  });

  it('says it could not be read when it failed', async () => {
    await open(ok({ ...receipt, status: 'failed', items: [] }));
    expect(await screen.findByRole('heading', { name: 'The AI couldn’t read this receipt' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try another picture' })).toHaveAttribute('href', '/receipts/new?group=5');
  });

  it('says it could not be read when no items were found', async () => {
    await open(ok({ ...receipt, items: [] }));
    expect(await screen.findByRole('heading', { name: 'The AI couldn’t read this receipt' })).toBeInTheDocument();
    expect(screen.getByText(/No items were found on it\./)).toBeInTheDocument();
  });

  it('says an abandoned receipt was abandoned', async () => {
    await open(ok({ ...receipt, status: 'abandoned', items: [] }));
    expect(await screen.findByRole('heading', { name: 'This receipt was abandoned' })).toBeInTheDocument();
    expect(screen.getByText(/within 7 days, so its picture was deleted/)).toBeInTheDocument();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('says a receipt that is already an expense is already saved', async () => {
    await open(ok({ ...receipt, expense_id: 30 }));
    expect(await screen.findByRole('heading', { name: 'This receipt is already saved' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the group' })).toHaveAttribute('href', '/groups/5');
  });

  it('treats the confirmed status as already saved', async () => {
    await open(ok({ ...receipt, status: 'confirmed', expense_id: 30 }));
    expect(await screen.findByRole('heading', { name: 'This receipt is already saved' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save expense' })).not.toBeInTheDocument();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('says it cannot be opened when it does not exist or is not yours', async () => {
    await open(fail(404, { detail: 'Receipt not found.' }));
    expect(await findAlert('We couldn’t open this receipt.')).toBeInTheDocument();
  });

  it('offers Try again when it cannot be loaded', async () => {
    receiptsApi.getReceipt.mockResolvedValueOnce(network).mockResolvedValue(ok(receipt));
    const user = userEvent.setup();
    renderApp('/receipts/9/review');
    await findAlert('We couldn’t load this receipt.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'What the AI found' })).toBeInTheDocument();
  });

  it('offers Try again when the members cannot be loaded', async () => {
    groupsApi.getMembers.mockResolvedValueOnce(network).mockResolvedValue(ok(members));
    const user = userEvent.setup();
    renderApp('/receipts/9/review');
    await findAlert('We couldn’t load the members.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'What the AI found' })).toBeInTheDocument();
  });

  it('says so when you are not a member of the group', async () => {
    groupsApi.getMembers.mockResolvedValue(fail(403, { detail: 'Not a member.' }));
    renderApp('/receipts/9/review');
    expect(await findAlert('You can’t add an expense to this group.')).toBeInTheDocument();
  });

  it('sends a logged-out user to log in', async () => {
    await open(fail(401));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});
