// Tests for the Balances screen (SCRUM-85). The API modules are mocked, so no backend is needed. Run with: npm test

import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import * as proposedApi from '../src/api/proposed.js';
import { renderApp, findAlert, me, ok, fail, network, mockGroups } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');
vi.mock('../src/api/proposed.js', async (original) => ({ ...(await original()), getGroupSettlements: vi.fn(), recordSettlement: vi.fn() }));

const membersByGroup = {
  5: [
    { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
    { user_id: 2, email: 'maya@example.com', is_admin: false },
    { user_id: 3, email: 'devin@example.com', is_admin: false },
  ],
  6: [
    { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
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
  mockGroups(groupsApi, [{ id: 5, name: 'Lake House', type: 'outing' }]);
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockImplementation((id) => Promise.resolve(ok(membersByGroup[id] ?? [])));
  expensesApi.getBalances.mockResolvedValue(ok(reply));
  proposedApi.getGroupSettlements.mockResolvedValue(fail(405, { detail: 'Method Not Allowed' }));
  expensesApi.getGroupExpenses.mockImplementation((id) => Promise.resolve(ok(expensesByGroup[id] ?? [])));
});

async function openPage() {
  renderApp('/balances');
  await screen.findByRole('heading', { name: 'Balances', level: 1 });
  await screen.findByRole('heading', { name: 'Who owes you', level: 2 });
}

// The two total cards switch the list. 'Owes you' and 'You owe' pick the card, then the people rows are read.
const VIEWS = { 'Owes you': [/^Show who owes you/, 'Who owes you'], 'You owe': [/^Show who you owe/, 'Who you owe'] };
const listItems = (view) => {
  const [button, heading] = VIEWS[view];
  fireEvent.click(screen.getByRole('button', { name: button }));
  return within(screen.getByRole('region', { name: heading }))
    .getAllByRole('listitem')
    .filter((li) => li.classList.contains('row-item'));
};

describe('Balances screen', () => {
  it('shows the two totals first', async () => {
    await openPage();
    const totals = screen.getByRole('region', { name: 'Totals' });
    expect(within(totals).getByText('Owed to you')).toBeInTheDocument();
    expect(within(totals).getByText('+$34.00')).toBeInTheDocument();
    expect(within(totals).getByText('You owe')).toBeInTheDocument();
    expect(within(totals).getByText('−$17.50')).toBeInTheDocument();
  });

  it('shows who owes you and who you owe as separate lists, biggest first', async () => {
    await openPage();
    const owes = listItems('Owes you');
    expect(owes).toHaveLength(2);
    expect(owes[0]).toHaveTextContent('Maya owes you');
    expect(owes[0]).toHaveTextContent('Lake House');
    expect(owes[0]).toHaveTextContent('+$30.00');
    const owe = listItems('You owe');
    expect(owe).toHaveLength(2);
    expect(owe[0]).toHaveTextContent('You owe Devin');
    expect(owe[0]).toHaveTextContent('−$12.50');
    expect(owe[1]).toHaveTextContent('You owe Maya');
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
    expect(maya.queryAllByRole('listitem')).toHaveLength(0); // closed until the caret is pressed
    fireEvent.click(maya.getByRole('button', { name: 'Show the expenses for Maya' }));
    const lines = maya.getAllByRole('listitem').map((li) => li.textContent);
    // Sam is the admin here, so each line also has its Edit link.
    expect(lines).toEqual(['Groceries$20.00Edit', 'Gas$15.00Edit', 'Pizza$5.00Edit', 'Movies$3.00Edit', 'Takeout−$13.00Edit']);
    expect(maya.getByText('Amounts with a minus take away from the total.')).toBeInTheDocument();
  });

  // Changed for the real backend: after a settlement the lines stay, with a short note.
  it('keeps the expense lines and says settlements are included when they do not add up to the balance', async () => {
    expensesApi.getGroupExpenses.mockImplementation((id) =>
      Promise.resolve(ok(id === 5 ? [spent(1, 'Groceries', 1, { 2: '20.00' })] : []))
    );
    await openPage();
    const maya = listItems('Owes you')[0];
    expect(maya).toHaveTextContent('Lake House');
    expect(maya).toHaveTextContent('Groceries');
    fireEvent.click(within(maya).getByRole('button', { name: 'Show the expenses for Maya' }));
    expect(maya).toHaveTextContent('Settlements are included in the balance.');
  });

  it('starts every row closed, with one summary line and a caret that is not expanded', async () => {
    await openPage();
    const maya = within(listItems('Owes you')[0]);
    const caret = maya.getByRole('button', { name: 'Show the expenses for Maya' });
    expect(caret).toHaveAttribute('aria-expanded', 'false');
    expect(maya.queryAllByRole('listitem')).toHaveLength(0);
    expect(maya.getByText(/Lake House · Groceries/)).toBeInTheDocument();
  });

  it('opens and closes one row with its caret, and the label follows', async () => {
    await openPage();
    const maya = within(listItems('Owes you')[0]);
    fireEvent.click(maya.getByRole('button', { name: 'Show the expenses for Maya' }));
    const caret = maya.getByRole('button', { name: 'Hide the expenses for Maya' });
    expect(caret).toHaveAttribute('aria-expanded', 'true');
    expect(maya.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(caret);
    expect(maya.queryAllByRole('listitem')).toHaveLength(0);
    expect(maya.getByRole('button', { name: 'Show the expenses for Maya' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('has one button that opens every row and then closes them all', async () => {
    await openPage();
    listItems('Owes you');
    const region = within(screen.getByRole('region', { name: 'Who owes you' }));
    fireEvent.click(region.getByRole('button', { name: 'Expand all' }));
    const opened = region.getAllByRole('button', { name: /^Hide the expenses for / });
    expect(opened.length).toBeGreaterThan(1);
    opened.forEach((b) => expect(b).toHaveAttribute('aria-expanded', 'true'));
    expect(region.queryByRole('button', { name: 'Expand all' })).toBeNull(); // the same button now says Collapse all
    fireEvent.click(region.getByRole('button', { name: 'Collapse all' }));
    expect(region.queryAllByRole('button', { name: /^Hide the expenses for / })).toHaveLength(0);
    expect(region.getByRole('button', { name: 'Expand all' })).toBeInTheDocument();
  });

  it('has no pencil or trash buttons on the expense lines', async () => {
    await openPage();
    const maya = within(listItems('Owes you')[0]);
    fireEvent.click(maya.getByRole('button', { name: 'Show the expenses for Maya' }));
    expect(maya.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(document.querySelector('.icon-btn')).toBeNull();
  });

  it('has no Expand all button when no row has expenses to show', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(network);
    await openPage();
    listItems('Owes you');
    expect(screen.queryByRole('button', { name: /^(Expand|Collapse) all$/ })).toBeNull();
  });

  it('still shows the balances, without expense lines, when the expenses cannot be loaded', async () => {
    expensesApi.getGroupExpenses.mockResolvedValue(network);
    await openPage();
    expect(listItems('Owes you')[0]).toHaveTextContent('Maya owes you');
    expect(listItems('Owes you')[0]).not.toHaveTextContent('Groceries');
    expect(listItems('Owes you')).toHaveLength(2);
  });

  it('says so when nobody owes you', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(5, 3, '0.00', '12.50')] }));
    renderApp('/balances');
    await screen.findByRole('heading', { name: 'Who you owe', level: 2 });
    expect(listItems('You owe')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^Show who owes you/ }));
    expect(screen.getByText('Nobody owes you right now.')).toBeInTheDocument();
  });

  it('says you are paid up when every balance is zero', async () => {
    expensesApi.getBalances.mockResolvedValue(ok({ ...reply, group_balances: [line(5, 2, '0.00', '0.00')] }));
    await openPage();
    expect(screen.getByText('You’re all paid up.')).toBeInTheDocument();
    expect(screen.getByText('Nobody owes you right now.')).toBeInTheDocument();
    const paid = listItems('You owe');
    expect(paid[0]).toHaveTextContent('You and Maya are paid up');
    expect(paid[0]).toHaveTextContent('Paid');
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
    expect(await screen.findByRole('heading', { name: 'Who owes you', level: 2 })).toBeInTheDocument();
  });

  it('shows the same message when a group’s members cannot be loaded', async () => {
    groupsApi.getMembers.mockImplementation((id) => Promise.resolve(id === 6 ? network : ok(membersByGroup[id])));
    renderApp('/balances');
    await findAlert('We couldn’t load your balances.');
    expect(screen.queryByRole('heading', { name: 'Who owes you' })).not.toBeInTheDocument();
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
