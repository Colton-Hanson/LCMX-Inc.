// Tests for the Balances screen (SCRUM-85). The API modules are mocked, so no backend is needed. Run with: npm test

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

const membersByGroup = {
  5: [
    { user_id: 1, email: 'cole@umkc.edu', is_admin: true },
    { user_id: 2, email: 'maya@example.com', is_admin: false },
    { user_id: 3, email: 'devin@example.com', is_admin: false },
  ],
  6: [
    { user_id: 1, email: 'cole@umkc.edu', is_admin: true },
    { user_id: 2, email: 'maya@example.com', is_admin: false },
  ],
};

// An expense as GET /groups/{id}/expenses sends it: who paid, and each person's share.
const spent = (id, description, paidBy, shares) => ({ id, group_id: 5, description, amount: '0.00', paid_by: paidBy, shares });

// The expenses behind the balances above (you are user 1).
const expensesByGroup = {
  5: [
    spent(15, 'Takeout', 2, { 1: '13.00', 2: '13.00' }),
    spent(14, 'Movies', 1, { 2: '3.00' }),
    spent(13, 'Pizza', 1, { 2: '5.00' }),
    spent(12, 'Gas', 1, { 2: '15.00' }),
    spent(11, 'Groceries', 1, { 2: '20.00' }),
    spent(16, 'Dinner', 3, { 1: '12.50', 3: '12.50' }),
    spent(17, 'Tickets', 1, { 9: '4.00' }),
  ],
  6: [spent(20, 'Coffee', 2, { 1: '5.00' })],
};

const line = (group, user, owed, owe) => ({
  group_id: group,
  other_user_id: user,
  net_amount: (Number(owed) - Number(owe)).toFixed(2),
  owed_to_you: owed,
  you_owe: owe,
});

// Maya owes you 30.00 and a former member owes 4.00 (group 5); you owe Devin 12.50 and Maya 5.00.
const reply = {
  group_balances: [line(5, 2, '30.00', '0.00'), line(5, 3, '0.00', '12.50'), line(5, 9, '4.00', '0.00'), line(6, 2, '0.00', '5.00')],
  overall_balances: [],
  total_net: '16.50',
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('groups:1', JSON.stringify([{ id: 5, name: 'Lake House', type: 'outing' }]));
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockImplementation((id) => Promise.resolve(ok(membersByGroup[id] ?? [])));
  expensesApi.getBalances.mockResolvedValue(ok(reply));
  expensesApi.getGroupExpenses.mockImplementation((id) => Promise.resolve(ok(expensesByGroup[id] ?? [])));
});

async function openPage() {
  renderApp('/balances');
  await screen.findByRole('heading', { name: 'Balances', level: 1 });
  await screen.findByRole('heading', { name: 'Owes you', level: 2 });
}

// The people rows only; a row can also hold a list of its expenses.
const listItems = (heading) =>
  within(screen.getByRole('region', { name: heading }))
    .getAllByRole('listitem')
    .filter((li) => li.classList.contains('row-item'));

describe('Balances screen', () => {
  it('shows the two totals first', async () => {
    await openPage();
    const totals = screen.getByRole('region', { name: 'Totals' });
    expect(within(totals).getByText('Owed to you')).toBeInTheDocument();
    expect(within(totals).getByText('+$34.00')).toBeInTheDocument();
    expect(within(totals).getByText('You owe')).toBeInTheDocument();
    expect(within(totals).getByText('−$17.50')).toBeInTheDocument();
  });

  it('keeps who owes you and who you owe in separate lists, biggest first', async () => {
    await openPage();
    const owes = listItems('Owes you');
    expect(owes).toHaveLength(2);
    expect(owes[0]).toHaveTextContent('maya@example.com owes you');
    expect(owes[0]).toHaveTextContent('Lake House');
    expect(owes[0]).toHaveTextContent('+$30.00');
    const owe = listItems('You owe');
    expect(owe).toHaveLength(2);
    expect(owe[0]).toHaveTextContent('You owe devin@example.com');
    expect(owe[0]).toHaveTextContent('−$12.50');
    expect(owe[1]).toHaveTextContent('You owe maya@example.com');
  });

  it('shows "Former member" for someone who left, and "Group 6" when the group name is unknown', async () => {
    await openPage();
    expect(listItems('Owes you')[1]).toHaveTextContent('Former member owes you');
    expect(listItems('You owe')[1]).toHaveTextContent('Group 6');
  });

  it('asks for each group’s members once, not once per row', async () => {
    await openPage();
    expect(groupsApi.getMembers).toHaveBeenCalledTimes(2);
    expect(groupsApi.getMembers).toHaveBeenCalledWith(5);
    expect(groupsApi.getMembers).toHaveBeenCalledWith(6);
  });

  it('asks for each group’s expenses once', async () => {
    await openPage();
    expect(expensesApi.getGroupExpenses).toHaveBeenCalledTimes(2);
    expect(expensesApi.getGroupExpenses).toHaveBeenCalledWith(5);
    expect(expensesApi.getGroupExpenses).toHaveBeenCalledWith(6);
  });

  it('shows the expenses behind each balance, the ones that make it up first, and "+N more"', async () => {
    await openPage();
    const maya = listItems('Owes you')[0];
    expect(maya).toHaveTextContent('Lake House · Groceries $20.00, Gas $15.00, Pizza $5.00 +2 more');
    expect(listItems('Owes you')[1]).toHaveTextContent('Lake House · Tickets $4.00');
    expect(listItems('You owe')[0]).toHaveTextContent('Lake House · Dinner $12.50');
    expect(listItems('You owe')[1]).toHaveTextContent('Group 6 · Coffee $5.00');
  });

  it('lists every expense when opened, with a minus on the one that takes away from the total', async () => {
    await openPage();
    const maya = within(listItems('Owes you')[0]);
    const lines = maya.getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual(['Groceries$20.00', 'Gas$15.00', 'Pizza$5.00', 'Movies$3.00', 'Takeout−$13.00']);
    expect(maya.getByText('Amounts with a minus take away from the total.')).toBeInTheDocument();
  });

  it('shows only the group when the expenses do not add up to the balance', async () => {
    expensesApi.getGroupExpenses.mockImplementation((id) =>
      Promise.resolve(ok(id === 5 ? [spent(1, 'Groceries', 1, { 2: '20.00' })] : []))
    );
    await openPage();
    const maya = listItems('Owes you')[0];
    expect(maya).toHaveTextContent('Lake House');
    expect(maya).not.toHaveTextContent('Groceries');
  });

  it('still shows the balances, without expense lines, when the expenses cannot be loaded', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(network);
    await openPage();
    expect(listItems('Owes you')[0]).toHaveTextContent('maya@example.com owes you');
    expect(listItems('Owes you')[0]).not.toHaveTextContent('Groceries');
    expect(listItems('Owes you')).toHaveLength(2);
  });

  it('says so when nobody owes you', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(5, 3, '0.00', '12.50')] }));
    await openPage();
    expect(screen.getByText('Nobody owes you right now.')).toBeInTheDocument();
    expect(listItems('You owe')).toHaveLength(1);
  });

  it('says you are paid up when every balance is zero', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(5, 2, '0.00', '0.00')] }));
    await openPage();
    expect(screen.getByText('You’re all paid up.')).toBeInTheDocument();
    expect(screen.getByText('Nobody owes you right now.')).toBeInTheDocument();
    expect(screen.getByText('You don’t owe anyone right now.')).toBeInTheDocument();
  });

  it('shows an empty state with a link to add an expense when there are no balances', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ group_balances: [], overall_balances: [], total_net: '0.00' }));
    renderApp('/balances');
    expect(await screen.findByRole('heading', { name: 'No balances yet' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/expenses/new');
    expect(groupsApi.getMembers).not.toHaveBeenCalled();
  });

  it('shows a loading message while it waits', async () => {
    expensesApi.getBalances.mockReturnValue(new Promise(() => {}));
    renderApp('/balances');
    expect(await screen.findByText('Loading balances…')).toBeInTheDocument();
  });
});

describe('Balances screen: problems', () => {
  it('offers Try again when the balances cannot be loaded', async () => {
    expensesApi.getBalances.mockResolvedValueOnce(network).mockResolvedValue(ok(reply));
    const user = userEvent.setup();
    renderApp('/balances');
    await findAlert('We couldn’t load your balances.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Owes you', level: 2 })).toBeInTheDocument();
  });

  it('shows the same message when a group’s members cannot be loaded', async () => {
    groupsApi.getMembers.mockImplementation((id) => Promise.resolve(id === 6 ? network : ok(membersByGroup[id])));
    renderApp('/balances');
    await findAlert('We couldn’t load your balances.');
    expect(screen.queryByRole('heading', { name: 'Owes you' })).not.toBeInTheDocument();
  });

  it('sends a logged-out user to log in', async () => {
    expensesApi.getBalances.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    renderApp('/balances');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('sends a user whose session ended while the expenses loaded to log in', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    renderApp('/balances');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});
