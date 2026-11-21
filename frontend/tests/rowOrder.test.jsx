// Balances rows go newest first, and show a quiet date. The API modules are mocked. Run with: npm test

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import * as proposedApi from '../src/api/proposed.js';
import { renderApp, me, ok, mockGroups } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');
vi.mock('../src/api/proposed.js', async (original) => ({ ...(await original()), getGroupSettlements: vi.fn(), recordSettlement: vi.fn() }));

const members = [
  { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
  { user_id: 4, name: 'Priya Natarajan', email: 'p@example.com', is_admin: false },
];
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19);
const line = (user, owed, expenses = []) => ({ group_id: 5, other_user_id: user, net_amount: owed, owed_to_you: owed, you_owe: '0.00', expenses });
const spent = (id, created_at) => ({ id, group_id: 5, description: `Expense ${id}`, amount: '10.00', paid_by: 1, your_share: '5.00', counterparty_share: '5.00', signed_amount: '5.00', created_at });

beforeEach(() => {
  vi.resetAllMocks();
  mockGroups(groupsApi, [{ id: 5, name: 'Lake House', type: 'outing' }]);
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
  expensesApi.getGroupExpenses.mockResolvedValue(ok([]));
  proposedApi.getGroupSettlements.mockResolvedValue(ok([]));
});

async function openPage() {
  renderApp('/balances');
  await screen.findByRole('heading', { name: 'Who owes you', level: 2 });
}
const rowNames = () => screen.getAllByRole('listitem').filter((li) => li.classList.contains('bal-row')).map((li) => within(li).getAllByRole('button')[0].textContent);

describe('Balances: newest first, with a quiet date', () => {
  it('puts the person with the newest expense first, not the biggest amount', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({
      group_balances: [
        line(2, '90.00', [spent(1, daysAgo(9))]),
        line(3, '5.00', [spent(2, daysAgo(0))]),
        line(4, '40.00', [spent(3, daysAgo(3))]),
      ],
    }));
    await openPage();
    expect(rowNames()).toEqual(['Devin', 'Priya N.', 'Maya']);
  });

  it('counts a newer payment as activity, so that person moves up', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({
      group_balances: [line(2, '90.00', [spent(1, daysAgo(9))]), line(3, '5.00', [spent(2, daysAgo(3))])],
    }));
    proposedApi.getGroupSettlements.mockResolvedValue(ok([
      { id: 8, group_id: 5, paid_by: 2, recipient: 1, amount: '1.00', recorded_by: 2, settlement_time: daysAgo(1) },
    ]));
    await openPage();
    await screen.findAllByText('Yesterday'); // in the row and in the history
    expect(rowNames()).toEqual(['Maya', 'Devin']);
  });

  it('shows Today, Yesterday or the day in small grey text under each amount', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({
      group_balances: [line(2, '10.00', [spent(1, daysAgo(0))]), line(3, '10.00', [spent(2, daysAgo(1))]), line(4, '10.00', [spent(3, '2020-01-05T12:00:00')])],
    }));
    await openPage();
    const whens = [...document.querySelectorAll('.bal-when')].map((el) => el.textContent);
    expect(whens).toEqual(['Today', 'Yesterday', 'Jan 5, 2020']);
  });

  it('shows the date on each expense line when a row is opened', async () => {
    const user = userEvent.setup();
    expensesApi.getBalances.mockResolvedValue(ok({ group_balances: [line(2, '5.00', [spent(1, '2020-01-05T12:00:00')])] }));
    expensesApi.getGroupExpenses.mockResolvedValue(ok([{ id: 1, group_id: 5, description: 'Expense 1', amount: '10.00', paid_by: 1, event_id: null, created_at: '2020-01-05T12:00:00', shares: { 1: '5.00', 2: '5.00' } }]));
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Show the expenses for Maya' }));
    expect(await screen.findByText('Jan 5, 2020', { selector: '.bal-line-when' })).toBeInTheDocument();
  });
});

describe('Balances: names and the +N more link', () => {
  it('shows short names, and a tap shows the email under the name', async () => {
    const user = userEvent.setup();
    expensesApi.getBalances.mockResolvedValue(ok({ group_balances: [line(2, '5.00'), line(4, '4.00')] }));
    await openPage();
    expect(screen.getByRole('button', { name: 'Priya N., show email' })).toBeInTheDocument();
    expect(screen.queryByText('p@example.com')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Priya N., show email' }));
    expect(screen.getByText('p@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Priya N., hide email' }));
    expect(screen.queryByText('p@example.com')).not.toBeInTheDocument();
  });

  it('opens the whole list from +N more, and the link goes away once it is open', async () => {
    const user = userEvent.setup();
    const many = [1, 2, 3, 4, 5].map((id) => ({ id, group_id: 5, description: `Item ${id}`, amount: '10.00', paid_by: 1, event_id: null, created_at: '2020-01-05T12:00:00', shares: { 1: '5.00', 2: '5.00' } }));
    expensesApi.getBalances.mockResolvedValue(ok({ group_balances: [line(2, '25.00', many.map((e) => spent(e.id, e.created_at)))] }));
    expensesApi.getGroupExpenses.mockResolvedValue(ok(many));
    await openPage();
    const more = screen.getByRole('button', { name: 'Show 2 more expenses for Maya' });
    expect(more).toHaveTextContent('+2 more');
    await user.click(more);
    expect(screen.getByRole('button', { name: 'Hide the expenses for Maya' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('button', { name: /^Item \d$/ })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /more expenses for Maya/ })).not.toBeInTheDocument();
  });

  it('hides the grey summary line while a row is open and brings it back when closed', async () => {
    const user = userEvent.setup();
    const many = [1, 2].map((id) => ({ id, group_id: 5, description: `Item ${id}`, amount: '10.00', paid_by: 1, event_id: null, created_at: '2020-01-05T12:00:00', shares: { 1: '5.00', 2: '5.00' } }));
    expensesApi.getBalances.mockResolvedValue(ok({ group_balances: [line(2, '10.00', many.map((e) => spent(e.id, e.created_at)))] }));
    expensesApi.getGroupExpenses.mockResolvedValue(ok(many));
    await openPage();
    expect(document.querySelector('.bal-summary-text')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show the expenses for Maya' }));
    expect(document.querySelector('.bal-summary-text')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Hide the expenses for Maya' }));
    expect(document.querySelector('.bal-summary-text')).not.toBeNull();
  });
});
