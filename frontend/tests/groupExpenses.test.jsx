// Tests for the Recent expenses card on the group page, the group page's Add expense button, and the top bar links.
// The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');

const members = [
  { user_id: 1, email: 'cole@umkc.edu', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
];
const group = { id: 5, name: 'Lake House', type: 'outing' };

const expense = (id, description, paidBy, amount, shares, created = '2026-10-30T12:00:00Z') => ({
  id,
  group_id: 5,
  description,
  amount,
  paid_by: paidBy,
  created_at: created,
  shares,
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('groups:1', JSON.stringify([group]));
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
  expensesApi.getGroupExpenses.mockResolvedValue(ok([]));
});

async function openGroup() {
  renderApp('/groups/5', { group });
  await screen.findByRole('heading', { name: 'Recent expenses', level: 2 });
}

const card = () => within(screen.getByRole('region', { name: 'Recent expenses' }));

// The expense rows only; each row also holds a small list of the people in its split.
const expenseRows = (items) => items.filter((li) => li.classList.contains('row-item'));

describe('Recent expenses card', () => {
  it('lists each expense with who paid, the date, the total and your share', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(
      ok([
        expense(3, 'Pizza night', 2, '30.00', { 1: '10.00', 2: '20.00' }),
        expense(2, 'Groceries', 1, '46.40', { 1: '20.11', 2: '26.29' }),
        expense(1, 'Gas', 9, '12.00', { 2: '12.00' }),
      ])
    );
    await openGroup();
    const rows = expenseRows(await card().findAllByRole('listitem'));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Pizza night');
    expect(rows[0]).toHaveTextContent('maya@example.com paid. Oct 30');
    expect(rows[0]).toHaveTextContent('$30.00');
    expect(rows[0]).toHaveTextContent('Your share $10.00');
    expect(rows[1]).toHaveTextContent('You paid.');
    expect(rows[1]).toHaveTextContent('Your share $20.11');
    expect(rows[2]).toHaveTextContent('Former member paid.');
    expect(rows[2]).toHaveTextContent('Not in this split');
    expect(expensesApi.getGroupExpenses).toHaveBeenCalledWith(5);
  });

  it('shows only the 5 newest and says how many there are', async () => {
    const many = [7, 6, 5, 4, 3, 2, 1].map((n) => expense(n, `Expense ${n}`, 1, '1.00', { 1: '1.00' }));
    expensesApi.getGroupExpenses.mockResolvedValue(ok(many));
    await openGroup();
    expect(expenseRows(await card().findAllByRole('listitem'))).toHaveLength(5);
    expect(card().getByText('Expense 7')).toBeInTheDocument();
    expect(card().queryByText('Expense 2')).not.toBeInTheDocument();
    expect(card().getByText('Showing the 5 newest of 7.')).toBeInTheDocument();
  });

  it('lists everyone in a split of 2 or more with their share, the payer first', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(
      ok([
        expense(3, 'Pizza night', 2, '30.00', { 1: '10.00', 2: '20.00' }),
        expense(1, 'Gas', 1, '12.00', { 2: '12.00' }),
        expense(4, 'Tickets', 1, '9.00', { 1: '3.00', 2: '3.00', 9: '3.00' }),
      ])
    );
    await openGroup();
    const rows = expenseRows(await card().findAllByRole('listitem'));
    const names = (row) => within(row).getAllByRole('listitem').map((li) => li.textContent);
    expect(within(rows[0]).getByText('Split between 2 people')).toBeInTheDocument();
    expect(names(rows[0])).toEqual(['maya@example.com$20.00', 'You$10.00']);
    expect(within(rows[1]).queryByText(/Split between/)).not.toBeInTheDocument(); // one person: nothing to open
    expect(within(rows[1]).queryAllByRole('listitem')).toHaveLength(0);
    expect(names(rows[2])).toEqual(['You$3.00', 'Former member$3.00', 'maya@example.com$3.00']);
  });

  it('shows an empty state with a link to add the first expense', async () => {
    await openGroup();
    expect(await card().findByText('No expenses yet. Add the first one for this group.')).toBeInTheDocument();
    expect(card().getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/groups/5/expenses/new');
  });

  it('offers Try again when the expenses cannot be loaded', async () => {
    expensesApi.getGroupExpenses.mockResolvedValueOnce(network).mockResolvedValue(
      ok([expense(1, 'Groceries', 1, '10.00', { 1: '10.00' })])
    );
    const user = userEvent.setup();
    await openGroup();
    await findAlert('We couldn’t load the expenses.');
    await user.click(card().getByRole('button', { name: 'Try again' }));
    expect(await card().findByText('Groceries')).toBeInTheDocument();
  });

  it('sends a logged-out user to log in', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    renderApp('/groups/5', { group });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('Group page and top bar links', () => {
  it('has an Add expense button for this group next to New event', async () => {
    await openGroup();
    const header = within(screen.getByRole('main'));
    expect(header.getAllByRole('link', { name: 'Add expense' })[0]).toHaveAttribute('href', '/groups/5/expenses/new');
    expect(header.getAllByRole('link', { name: 'New event' })[0]).toHaveAttribute('href', '/groups/5/events/new');
  });

  it('has Home, Groups and Balances links and an Add expense button in the top bar', async () => {
    await openGroup();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'Balances' })).toHaveAttribute('href', '/balances');
    expect(nav.getByRole('link', { name: 'Groups' })).toHaveAttribute('href', '/groups');
    const bar = within(screen.getByRole('banner'));
    expect(bar.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/expenses/new');
  });
});
