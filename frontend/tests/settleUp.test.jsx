// Tests for settling up on the Balances screen (SCRUM-136). The API modules are mocked, so no backend is needed.

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { checkA11y } from './a11y.js';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import * as proposedApi from '../src/api/proposed.js';
import { checkPartAmount, historyText, receivedThisMonth, shortName } from '../src/lib/settle.js';
import { renderApp, findAlert, me, ok, fail, network, mockGroups } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');
vi.mock('../src/api/proposed.js', async (original) => ({ ...(await original()), getGroupSettlements: vi.fn(), recordSettlement: vi.fn() }));

const members = [
  { user_id: 1, email: 'sam@example.com', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];
const line = (user, owed, owe) => ({ group_id: 5, other_user_id: user, net_amount: '0.00', owed_to_you: owed, you_owe: owe });
// Maya owes you 30.00. You owe Devin 12.50.
const reply = { group_balances: [line(2, '30.00', '0.00'), line(3, '0.00', '12.50')], overall_balances: [], total_net: '17.50' };
const notBuilt = fail(405, { detail: 'Method Not Allowed' });

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mockGroups(groupsApi, [{ id: 5, name: 'Lake House', type: 'outing' }]);
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
  expensesApi.getBalances.mockResolvedValue(ok(reply));
  expensesApi.getGroupExpenses.mockResolvedValue(ok([]));
  proposedApi.getGroupSettlements.mockResolvedValue(ok([]));
  proposedApi.recordSettlement.mockResolvedValue(ok({ id: 1 }, 201));
});

async function openPage() {
  const user = userEvent.setup();
  renderApp('/balances');
  await screen.findByRole('heading', { name: 'Who owes you', level: 2 });
  return user;
}

// Nobody owes you right now, so the page starts on "You owe". Open the other tab to see who paid you.
async function openOwedOnly() {
  const user = userEvent.setup();
  renderApp('/balances');
  await screen.findByRole('heading', { name: 'Who you owe', level: 2 });
  await user.click(screen.getByRole('button', { name: /^Show who owes you/ }));
  return user;
}

async function openPay(user) {
  await user.click(screen.getByRole('button', { name: /^Show who you owe/ }));
  await user.click(screen.getByRole('button', { name: 'Pay Devin' }));
  return screen.getByRole('dialog', { name: 'Pay Devin' });
}

describe('Settle up helpers', () => {
  it('takes whole cents between one cent and what is owed', () => {
    expect(checkPartAmount('10', 1250).cents).toBe(1000);
    expect(checkPartAmount('12.50', 1250).cents).toBe(1250);
    expect(checkPartAmount('0.01', 1250).cents).toBe(1);
    expect(checkPartAmount('$5.5', 1250).cents).toBe(550);
  });

  it('refuses zero, negative, too many decimals, letters and more than owed', () => {
    ['0', '0.00', '-5', '1.234', 'abc', '', '12.51', '100'].forEach((text) => {
      const result = checkPartAmount(text, 1250);
      expect(result.cents).toBeNull();
      expect(result.error).toBe('Enter an amount between $0.01 and $12.50.');
    });
  });

  it('shortens an email to the part before the @', () => {
    expect(shortName('maya@example.com')).toBe('maya');
    expect(shortName('Former member')).toBe('Former member');
  });

  it('writes the history line from your side', () => {
    const names = { 2: 'Maya' };
    expect(historyText({ paid_by: 1, recipient: 2, recorded_by: 1 }, 1, names)).toBe('You marked a payment to Maya as paid outside the app');
    expect(historyText({ paid_by: 2, recipient: 1, recorded_by: 2 }, 1, names)).toBe('Maya marked a payment to you as paid outside the app');
    expect(historyText({ paid_by: 2, recipient: 1, recorded_by: 1 }, 1, names)).toBe('You marked Maya as paid (manual)');
    expect(historyText({ paid_by: 1, recipient: 2, recorded_by: 2 }, 1, names)).toBe('Maya marked your payment as received');
    expect(historyText({ paid_by: 9, recipient: 1, recorded_by: 9 }, 1, names)).toBe('A group member marked a payment to you as paid outside the app');
  });

  it('adds up what was paid to you this month, per person and in total', () => {
    const now = new Date(2026, 10, 20); // Nov 20, 2026 (local time)
    const list = [
      { group_id: 5, paid_by: 2, recipient: 1, amount: '10.00', settlement_time: '2026-11-03T12:00:00' },
      { group_id: 5, paid_by: 2, recipient: 1, amount: '2.50', settlement_time: '2026-11-10T12:00:00' },
      { group_id: 5, paid_by: 2, recipient: 1, amount: '9.00', settlement_time: '2026-10-28T12:00:00' }, // last month
      { group_id: 5, paid_by: 1, recipient: 3, amount: '4.00', settlement_time: '2026-11-04T12:00:00' }, // you paid
      { group_id: 5, paid_by: 3, recipient: 2, amount: '7.00', settlement_time: '2026-11-04T12:00:00' }, // not yours
    ];
    // list[0] was recorded by you (recorded_by 1); the others were recorded by the payer
    const withMine = [{ ...list[0], recorded_by: 1 }, { ...list[1], recorded_by: 2 }, ...list.slice(2)];
    expect(receivedThisMonth(withMine, 1, now)).toEqual({ total: 1250, byRow: { '5-2': 1250 }, manualTotal: 1000, manualByRow: { '5-2': 1000 } });
    expect(receivedThisMonth(undefined, 1, now)).toEqual({ total: 0, byRow: {}, manualTotal: 0, manualByRow: {} });
  });
});

describe('Is the route built yet', () => {
  // The real routes exist now, so only a lost connection, 405 or 501 means "not available".
  it('treats only a lost connection, 405 and 501 as not available', () => {
    expect(proposedApi.isNotAvailable(network)).toBe(true);
    expect(proposedApi.isNotAvailable(fail(405, { detail: 'Method Not Allowed' }))).toBe(true);
    expect(proposedApi.isNotAvailable(fail(501))).toBe(true);
  });

  it('does not treat other replies as not available, so their own message shows', () => {
    expect(proposedApi.isNotAvailable(ok({}))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(404, { detail: 'Not Found' }))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(404))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(404, { detail: 'Expense not found.' }))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(403, { detail: 'No.' }))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(409, { detail: { code: 'x', message: 'Busy.' } }))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(422, { detail: 'Bad.' }))).toBe(false);
    expect(proposedApi.isNotAvailable(fail(500))).toBe(false);
  });
});

describe('Settlement calls', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({}) })));
  afterEach(() => vi.unstubAllGlobals());

  it('records with paid_by, recipient and a decimal string amount on the group route', async () => {
    const real = await vi.importActual('../src/api/proposed.js');
    await real.recordSettlement({ groupId: 5, paidBy: 3, recipient: 1, amount: '12.50' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/groups/5/settlements');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ paid_by: 3, recipient: 1, amount: '12.50' });
  });

  it('lists one group at a time', async () => {
    const real = await vi.importActual('../src/api/proposed.js');
    await real.getGroupSettlements(7);
    expect(fetch.mock.calls[0][0]).toBe('/api/groups/7/settlements');
    expect(fetch.mock.calls[0][1].method).toBe('GET');
  });
});

describe('Balances: the two cards and the list', () => {
  it('starts on who owes you, with Mark received on each row', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: /^Show who owes you/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mark received from Maya' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay Devin' })).not.toBeInTheDocument();
  });

  it('switches to who you owe, with Pay on each row', async () => {
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: /^Show who you owe/ }));
    expect(screen.getByRole('heading', { name: 'Who you owe', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay Devin' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mark received/ })).not.toBeInTheDocument();
  });

  it('shows both lists together with Show both, and goes back', async () => {
    const user = await openPage();
    const both = screen.getByRole('button', { name: 'Show both' });
    await user.click(both);
    expect(both).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Between you and others', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay Devin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark received from Maya' })).toBeInTheDocument();
    await user.click(both);
    expect(screen.getByRole('heading', { name: 'Who you owe', level: 2 })).toBeInTheDocument();
  });

  it('says the app does not move money', async () => {
    await openPage();
    expect(screen.getByText(/This app does not move money\. “Pay” records that a payment was made outside the app\./)).toBeInTheDocument();
  });

  it('works with the keyboard', async () => {
    const user = await openPage();
    const tab = screen.getByRole('button', { name: /^Show who you owe/ });
    for (let i = 0; i < 30 && document.activeElement !== tab; i += 1) await user.tab();
    expect(tab).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Who you owe', level: 2 })).toBeInTheDocument();
  });
});

describe('Settle dialog', () => {
  it('opens with a title, a description and the note that no money moves', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    expect(dialog).toHaveAccessibleDescription('You owe Devin $12.50 in Lake House.');
    expect(within(dialog).getByText(/This app does not move money\./)).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'How much did you pay Devin?' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Full amount ($12.50)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByText('Nothing will be left over. This balance will be paid.')).toBeInTheDocument();
  });

  it('asks the other way round when they owe you', async () => {
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: 'Mark received from Maya' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark received from Maya' });
    expect(dialog).toHaveAccessibleDescription('Maya owes you $30.00 in Lake House.');
    expect(within(dialog).getByRole('group', { name: 'How much did Maya pay you?' })).toBeInTheDocument();
  });

  it('records a part payment from the person who was owed, with them as the payer', async () => {
    const user = await openPage();
    await user.click(screen.getByRole('button', { name: 'Mark received from Maya' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Part of it' }));
    await user.type(within(dialog).getByLabelText('Amount paid'), '10');
    expect(within(dialog).getByText('$20.00 will stay outstanding.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
    expect(proposedApi.recordSettlement).toHaveBeenCalledWith({ groupId: 5, paidBy: 2, recipient: 1, amount: '10.00' });
    expect(await screen.findByText(/\$10\.00 marked as paid with Maya..*\$20\.00 is still outstanding\./)).toBeInTheDocument();
    // the green banner stays until the grey X is pressed
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByText(/marked as paid with Maya/)).not.toBeInTheDocument();
  });

  it('closes when you click the dark area outside the box, the same as Cancel', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(dialog); // inside the box: stays open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(dialog.parentElement); // the dark area around it
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(proposedApi.recordSettlement).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pay Devin' })).toHaveFocus();
  });

  it('does not close when a press starts inside the box and lets go outside it', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    await user.pointer([{ keys: '[MouseLeft>]', target: within(dialog).getByRole('button', { name: 'Part of it' }) }, { keys: '[/MouseLeft]', target: dialog.parentElement }]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('records the full amount after the confirm step and refreshes the balances', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    expect(proposedApi.recordSettlement).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Mark $12.50 as paid?')).toBeInTheDocument();
    const yes = within(dialog).getByRole('button', { name: 'Yes, mark as paid' });
    expect(yes).toHaveFocus();
    await user.click(yes);
    expect(proposedApi.recordSettlement).toHaveBeenCalledWith({ groupId: 5, paidBy: 1, recipient: 3, amount: '12.50' });
    const note = await screen.findByText('$12.50 marked as paid with Devin. It is in the settlement history for both of you.');
    expect(note.closest('[role="status"]')).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(expensesApi.getBalances).toHaveBeenCalledTimes(2));
    expect(proposedApi.getGroupSettlements).toHaveBeenCalledTimes(2);
  });

  it('blocks a part amount that is empty, zero, negative, too precise or more than owed', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Part of it' }));
    const field = within(dialog).getByLabelText('Amount paid');
    const next = within(dialog).getByRole('button', { name: 'Mark as paid' });
    expect(next).toBeDisabled();
    for (const text of ['0', '-3', '1.234', '12.51', 'abc']) {
      await user.clear(field);
      await user.type(field, text);
      expect(next).toBeDisabled();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(await findAlert('Enter an amount between $0.01 and $12.50.')).toBeInTheDocument();
    }
    await user.clear(field);
    await user.type(field, '12.50');
    expect(next).toBeEnabled();
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('goes back from the confirm step without saving', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Go back' }));
    expect(within(dialog).getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument();
    expect(proposedApi.recordSettlement).not.toHaveBeenCalled();
  });

  it('closes with Escape and Cancel, and gives focus back to the button that opened it', async () => {
    const user = await openPage();
    await openPay(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay Devin' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Pay Devin' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = await openPage();
    const dialog = await openPay(user);
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
  });

  it('shows a calm not available note and turns the button off when the server cannot record yet', async () => {
    proposedApi.recordSettlement.mockResolvedValue(notBuilt);
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
    const note = await within(dialog).findByText('Recording a payment isn’t available yet. Nothing was saved.');
    expect(note.closest('[role="status"]')).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    const yes = within(dialog).getByRole('button', { name: 'Yes, mark as paid' });
    expect(yes).toBeDisabled();
    expect(yes).toHaveAccessibleDescription('Recording a payment isn’t available yet. Nothing was saved.');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(expensesApi.getBalances).toHaveBeenCalledTimes(1);
  });

  it('shows the server message when recording fails for another reason', async () => {
    proposedApi.recordSettlement.mockResolvedValue(fail(422, { detail: 'That is more than the balance.' }));
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
    expect(await findAlert('That is more than the balance.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Yes, mark as paid' })).toBeEnabled();
  });

  // Changed for the real backend: a lost connection now shows the calm not available note.
  it('shows the not available note when the server cannot be reached', async () => {
    proposedApi.recordSettlement.mockResolvedValue(network);
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
    expect(await within(dialog).findByText('Recording a payment isn’t available yet. Nothing was saved.')).toBeInTheDocument();
  });

  it('shows the real server messages for paying too much, not owing, and not being allowed', async () => {
    for (const [status, detail] of [
      [422, 'Settlement cannot exceed the outstanding debt.'],
      [409, 'The payer does not currently owe this recipient.'],
      [403, 'Only a party or a group administrator can record this settlement.'],
    ]) {
      proposedApi.recordSettlement.mockResolvedValue(fail(status, { detail }));
      const user = await openPage();
      const dialog = await openPay(user);
      await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
      await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
      expect(await findAlert(detail)).toBeInTheDocument();
      cleanup();
    }
  });

  it('sends a logged-out user to log in', async () => {
    proposedApi.recordSettlement.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('Settlement history', () => {
  const history = [
    { id: 2, group_id: 5, paid_by: 2, recipient: 1, amount: '10.00', recorded_by: 1, settlement_time: '2026-11-03T12:00:00' },
    { id: 1, group_id: 5, paid_by: 1, recipient: 3, amount: '4.00', recorded_by: 1, settlement_time: '2026-11-02T12:00:00' },
  ];

  it('lists each payment with who, the group, the amount and the date', async () => {
    proposedApi.getGroupSettlements.mockResolvedValue(ok(history));
    await openPage();
    const card = within(screen.getByRole('region', { name: 'Settlement history' }));
    const rows = await card.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('You marked Maya as paid (manual)');
    expect(rows[0]).toHaveTextContent('Lake House');
    expect(rows[0]).toHaveTextContent('$10.00');
    expect(rows[0]).toHaveTextContent('Nov 3');
    expect(rows[1]).toHaveTextContent('You marked a payment to Devin as paid outside the app');
  });

  it('shows only payments you are part of, not other people’s payments in the same group', async () => {
    const others = { id: 3, group_id: 5, paid_by: 2, recipient: 3, amount: '7.00', recorded_by: 2, settlement_time: '2026-11-04T12:00:00' };
    proposedApi.getGroupSettlements.mockResolvedValue(ok([others, ...history]));
    await openPage();
    const card = within(screen.getByRole('region', { name: 'Settlement history' }));
    const rows = await card.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(card.queryByText('$7.00')).not.toBeInTheDocument();
  });

  // Payments from this month, so they count in the "received this month" card.
  const now = new Date().toISOString().slice(0, 19);
  const byMe = { id: 11, group_id: 5, paid_by: 2, recipient: 1, amount: '10.00', recorded_by: 1, settlement_time: now };
  const byThem = { id: 12, group_id: 5, paid_by: 2, recipient: 1, amount: '5.00', recorded_by: 2, settlement_time: now };

  it('has no yellow pill on a row where the person still owes more (a part payment), only Mark received', async () => {
    proposedApi.getGroupSettlements.mockResolvedValue(ok([byMe]));
    await openPage();
    const row = screen.getByRole('button', { name: 'Mark received from Maya' }).closest('li');
    await within(screen.getByRole('region', { name: 'Settlement history' })).findAllByRole('listitem'); // the payments have loaded
    expect(within(row).queryByText('Received (manual)')).not.toBeInTheDocument();
  });

  it('shows the full amount and how much has been received, from the server’s payments only', async () => {
    proposedApi.getGroupSettlements.mockResolvedValue(ok([byMe, byThem]));
    await openPage();
    const card = screen.getByRole('button', { name: /^Show who owes you/ });
    // 30.00 still owed + 15.00 already paid this month = 45.00 in all
    expect(await within(card).findByText('+$45.00')).toBeInTheDocument();
    expect(within(card).getByText('Actual amount received')).toBeInTheDocument();
    expect(card).toHaveTextContent('$15.00 of $45.00');
    expect(within(card).getByText('includes $10.00 marked by you')).toBeInTheDocument();
  });

  it('shows a green Payment received row for someone who paid you in full, and no yellow line when you marked nothing', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(2, '0.00', '0.00'), line(3, '0.00', '12.50')] }));
    proposedApi.getGroupSettlements.mockResolvedValue(ok([byThem]));
    await openOwedOnly();
    const row = (await screen.findByText('paid you')).closest('li');
    expect(within(row).getByText('+$5.00')).toBeInTheDocument();
    expect(within(row).getByText('Payment received')).toBeInTheDocument();
    expect(screen.queryByText(/marked by you/)).not.toBeInTheDocument();
  });

  it('shows a yellow pill, not a green one, when you recorded the full payment yourself', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(2, '0.00', '0.00'), line(3, '0.00', '12.50')] }));
    proposedApi.getGroupSettlements.mockResolvedValue(ok([byMe]));
    await openOwedOnly();
    const row = (await screen.findByText('paid you')).closest('li');
    expect(within(row).getByText('Received (manual)')).toBeInTheDocument();
    expect(within(row).queryByText('Payment received')).not.toBeInTheDocument();
  });

  it('leaves out payments from earlier months in the received amount, but still lists them', async () => {
    const old = { ...byThem, id: 13, settlement_time: '2020-01-05T12:00:00' };
    proposedApi.getGroupSettlements.mockResolvedValue(ok([old]));
    await openPage();
    const card = screen.getByRole('button', { name: /^Show who owes you/ });
    expect(await within(card).findByText('+$30.00')).toBeInTheDocument();
    expect(card).toHaveTextContent('$0.00 of $30.00');
    expect(await within(screen.getByRole('region', { name: 'Settlement history' })).findAllByRole('listitem')).toHaveLength(1);
  });

  it('asks every group in the balances and shows their payments together, newest first', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(2, '30.00', '0.00'), { ...line(3, '0.00', '12.50'), group_id: 6 }] }));
    mockGroups(groupsApi, [{ id: 5, name: 'Lake House', type: 'outing' }, { id: 6, name: 'Apartment 4B', type: 'roommate' }]);
    proposedApi.getGroupSettlements.mockImplementation((id) =>
      Promise.resolve(ok(Number(id) === 5 ? [history[1]] : [{ ...history[0], id: 3, group_id: 6, paid_by: 1, recipient: 3, settlement_time: '2026-11-04T09:00:00' }]))
    );
    await openPage();
    const card = within(screen.getByRole('region', { name: 'Settlement history' }));
    const rows = await card.findAllByRole('listitem');
    expect(proposedApi.getGroupSettlements.mock.calls.map((c) => Number(c[0])).sort()).toEqual([5, 6]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Apartment 4B');
    expect(rows[0]).toHaveTextContent('Nov 4');
    expect(rows[1]).toHaveTextContent('Lake House');
  });

  it('has no pill when nothing was marked by you', async () => {
    await openPage();
    expect(screen.queryByText('Received (manual)')).not.toBeInTheDocument();
  });

  it('says there are no payments yet when the list is empty', async () => {
    await openPage();
    expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument();
  });

  it('shows a loading line while it waits', async () => {
    proposedApi.getGroupSettlements.mockReturnValue(new Promise(() => {}));
    await openPage();
    expect(screen.getByText('Loading history…')).toBeInTheDocument();
  });

  it('shows a calm not available note when the server has no history yet', async () => {
    proposedApi.getGroupSettlements.mockResolvedValue(notBuilt);
    await openPage();
    const card = within(screen.getByRole('region', { name: 'Settlement history' }));
    expect(await card.findByText(/Settlement history isn’t available yet\./)).toBeInTheDocument();
    expect(card.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers Try again when the history cannot be loaded', async () => {
    proposedApi.getGroupSettlements.mockResolvedValueOnce(fail(500)).mockResolvedValue(ok(history));
    const user = await openPage();
    await findAlert('We couldn’t load the history.');
    const card = within(screen.getByRole('region', { name: 'Settlement history' }));
    await user.click(card.getByRole('button', { name: 'Try again' }));
    expect(await card.findAllByRole('listitem')).toHaveLength(2);
  });
});

describe('Settle up: accessibility checks', () => {
  it('has no problems on the balances screen', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(2, '0.00', '0.00'), line(3, '0.00', '12.50')] })); // a fully paid row, so the yellow pill shows
    proposedApi.getGroupSettlements.mockResolvedValue(ok([{ id: 2, group_id: 5, paid_by: 2, recipient: 1, amount: '10.00', recorded_by: 1, settlement_time: new Date().toISOString().slice(0, 19) }]));
    const user = await openOwedOnly();
    await user.click(screen.getByRole('button', { name: 'Show both' }));
    await screen.findByText('Received (manual)');
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('has no problems when the history is not available', async () => {
    proposedApi.getGroupSettlements.mockResolvedValue(notBuilt);
    await openPage();
    await screen.findByText(/Settlement history isn’t available yet\./);
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('has no problems in the dialog, on both steps and when not available', async () => {
    proposedApi.recordSettlement.mockResolvedValue(notBuilt);
    const user = await openPage();
    const dialog = await openPay(user);
    await user.click(within(dialog).getByRole('button', { name: 'Part of it' }));
    await user.type(within(dialog).getByLabelText('Amount paid'), '99');
    expect(await checkA11y()).toHaveNoViolations();
    await user.clear(within(dialog).getByLabelText('Amount paid'));
    await user.type(within(dialog).getByLabelText('Amount paid'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    expect(await checkA11y()).toHaveNoViolations();
    await user.click(within(dialog).getByRole('button', { name: 'Yes, mark as paid' }));
    await within(dialog).findByText(/isn’t available yet/);
    expect(await checkA11y()).toHaveNoViolations();
  });
});
