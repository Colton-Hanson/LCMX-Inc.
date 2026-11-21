// Tests for the Add expense screen (SCRUM-83) and its split picker (SCRUM-84).
// The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import { renderApp, findAlert, me, ok, fail, network, mockGroups } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');

const members = [
  { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];
const group = { id: 5, name: 'Lake House', type: 'outing' };
const other = { id: 6, name: 'Apartment 4B', type: 'roommate' };

// Makes the server's group list (and each group's detail) answer with these groups.
const saveGroups = (...list) => mockGroups(groupsApi, list);

beforeEach(() => {
  vi.resetAllMocks();
  saveGroups(group);
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
  expensesApi.getGroupExpenses.mockResolvedValue(ok([])); // the group page the user returns to lists the expenses
  groupsApi.getGroupEvents.mockResolvedValue(ok([])); // and its Events card
});

const saveButton = () => screen.getByRole('button', { name: 'Save expense' });

async function openPage(path = '/groups/5/expenses/new') {
  renderApp(path, { group });
  await screen.findByRole('heading', { name: 'Add expense', level: 1 });
  await screen.findByRole('button', { name: /Maya/ }); // members have loaded
}

async function fillBasics(user, title = 'Groceries', total = '10') {
  await user.type(screen.getByLabelText('Title'), title);
  await user.type(screen.getByLabelText('Total ($)'), total);
}

const sentExpense = () => expensesApi.createExpense.mock.calls[0][0];

describe('Add expense screen', () => {
  it('opens with the group chosen, you as the payer and everyone in the split', async () => {
    await openPage();
    expect(screen.getByLabelText('Group')).toHaveValue('5');
    expect(screen.getByLabelText('Paid by')).toHaveValue('1');
    ['Sam (you)', 'Maya', 'Devin'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: '← Lake House' })).toHaveAttribute('href', '/groups/5');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/groups/5');
  });

  it('shows what is wrong next to the title and total, and saves nothing', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(saveButton());
    await findAlert('Enter a title for this expense.');
    await findAlert('Enter the total amount.');
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Total ($)')).toHaveAttribute('aria-invalid', 'true');
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
  });

  it('rejects a total that is not dollars and cents', async () => {
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, 'Groceries', '12.345');
    await user.click(saveButton());
    await findAlert('Enter the total as dollars and cents, like 24.50.');
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
  });
});

describe('Even split', () => {
  it('shows each share live and flags the leftover cent', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Total ($)'), '10');
    const list = screen.getByRole('list', { name: 'Each person’s share' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('$3.34');
    expect(rows[0]).toHaveTextContent('includes an extra cent');
    expect(rows[1]).toHaveTextContent('$3.33');
    expect(rows[2]).toHaveTextContent('$3.33');
    expect(screen.getByText(/1 leftover cent added to Sam/)).toBeInTheDocument();
  });

  it('shows dashes until there is a total', async () => {
    await openPage();
    const rows = within(screen.getByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('—');
  });

  it('saves with the group, payer, people and an even split, then returns to the group page', async () => {
    expensesApi.createExpense.mockResolvedValue(ok({ id: 9, description: 'Groceries' }, 201));
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, '  Groceries  ', '10');
    await user.click(saveButton());
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalledTimes(1));
    expect(sentExpense()).toEqual({
      groupId: 5,
      description: '  Groceries  ',
      amount: '10.00',
      paidBy: 1,
      eventId: null,
      participantIds: [1, 2, 3],
      splitMethod: 'even',
      splitValues: undefined,
    });
    expect(await screen.findByRole('heading', { name: 'Lake House', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Expense “Groceries” saved: $10.00 shared by 3 people.')).toBeInTheDocument();
  });

  it('sends the chosen payer', async () => {
    expensesApi.createExpense.mockResolvedValue(ok({ id: 9, description: 'Pizza' }, 201));
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, 'Pizza', '30');
    await user.selectOptions(screen.getByLabelText('Paid by'), 'Maya');
    await user.click(saveButton());
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalled());
    expect(sentExpense().paidBy).toBe(2);
  });
});

describe('Who is in the split', () => {
  it('recalculates when someone is taken out and sends only the people left', async () => {
    expensesApi.createExpense.mockResolvedValue(ok({ id: 9, description: 'Taxi' }, 201));
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, 'Taxi', '10');
    await user.click(screen.getByRole('button', { name: /Devin/ }));
    const rows = within(screen.getByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('$5.00');
    expect(rows[1]).toHaveTextContent('$5.00');
    await user.click(saveButton());
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalled());
    expect(sentExpense().participantIds).toEqual([1, 2]);
    expect(await screen.findByText(/shared by 2 people/)).toBeInTheDocument();
  });

  it('explains and blocks saving when nobody is in', async () => {
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user);
    for (const name of ['Sam (you)', 'Maya', 'Devin']) {
      await user.click(screen.getByRole('button', { name }));
    }
    await findAlert('Pick at least one person to split with.');
    await user.click(saveButton());
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
  });
});

describe('Custom amounts', () => {
  async function openCustom(user) {
    await openPage();
    await fillBasics(user, 'Dinner', '10');
    await user.click(screen.getByRole('button', { name: 'Custom' }));
  }

  it('starts from the even split so the amounts already add up', async () => {
    const user = userEvent.setup();
    await openCustom(user);
    expect(screen.getByLabelText('Amount for Sam')).toHaveValue('3.34');
    expect(screen.getByLabelText('Amount for Maya')).toHaveValue('3.33');
    expect(screen.getByLabelText('Amount for Devin')).toHaveValue('3.33');
    expect(screen.getByRole('progressbar', { name: 'Amount assigned' })).toHaveAttribute('aria-valuetext', '$10.00 of $10.00');
  });

  it('says how much is left, and blocks saving until the amounts add up', async () => {
    expensesApi.createExpense.mockResolvedValue(ok({ id: 9, description: 'Dinner' }, 201));
    const user = userEvent.setup();
    await openCustom(user);
    const maya = screen.getByLabelText('Amount for Maya');
    await user.clear(maya);
    await user.type(maya, '1');
    expect(screen.getByText('$2.33 left to assign.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Amount assigned' })).toHaveAttribute('aria-valuetext', '$7.67 of $10.00');

    await user.click(saveButton());
    await findAlert('Can’t save yet. $2.33 left to assign.');
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
    expect(maya).toHaveAttribute('aria-invalid', 'true');

    await user.clear(maya);
    await user.type(maya, '3.33');
    expect(screen.queryByText(/left to assign/)).toBeNull();
    await user.click(saveButton());
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalledTimes(1));
    expect(sentExpense().splitMethod).toBe('custom');
    expect(sentExpense().splitValues).toEqual({ 1: '3.34', 2: '3.33', 3: '3.33' });
  });

  it('says how much is over the total', async () => {
    const user = userEvent.setup();
    await openCustom(user);
    const sam = screen.getByLabelText('Amount for Sam');
    await user.clear(sam);
    await user.type(sam, '5');
    expect(screen.getByText('$1.66 over the total.')).toBeInTheDocument();
  });

  it('shows an error under an amount that is not a number', async () => {
    const user = userEvent.setup();
    await openCustom(user);
    const sam = screen.getByLabelText('Amount for Sam');
    await user.clear(sam);
    await user.type(sam, 'abc');
    await findAlert('Enter dollars and cents, like 12.50.');
    expect(sam).toHaveAttribute('aria-invalid', 'true');
    expect(sam).toHaveAccessibleDescription('Enter dollars and cents, like 12.50.');
  });

  it('goes back to an even split when Even is chosen again', async () => {
    const user = userEvent.setup();
    await openCustom(user);
    await user.click(screen.getByRole('button', { name: 'Even' }));
    expect(screen.queryByLabelText('Amount for Sam')).toBeNull();
    const rows = within(screen.getByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('$3.34');
  });
});

describe('Percentage', () => {
  async function openPercentage(user) {
    await openPage();
    await fillBasics(user, 'Rent', '10');
    await user.click(screen.getByRole('button', { name: 'Percentage' }));
  }

  it('starts from equal percentages that add up to 100 and shows each dollar share', async () => {
    const user = userEvent.setup();
    await openPercentage(user);
    expect(screen.getByLabelText('Percentage for Sam')).toHaveValue('33.34');
    expect(screen.getByLabelText('Percentage for Maya')).toHaveValue('33.33');
    expect(screen.getByLabelText('Percentage for Devin')).toHaveValue('33.33');
    const rows = within(screen.getByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('$3.34');
    expect(rows[1]).toHaveTextContent('$3.33');
    expect(rows[2]).toHaveTextContent('$3.33');
  });

  it('says how much is left under 100% and blocks saving', async () => {
    const user = userEvent.setup();
    await openPercentage(user);
    const devin = screen.getByLabelText('Percentage for Devin');
    await user.clear(devin);
    await user.type(devin, '20');
    expect(screen.getByText('13.33% left to assign.')).toBeInTheDocument();
    await user.click(saveButton());
    await findAlert('Can’t save yet. 13.33% left to assign.');
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
  });

  it('saves the percentages as text', async () => {
    expensesApi.createExpense.mockResolvedValue(ok({ id: 9, description: 'Rent' }, 201));
    const user = userEvent.setup();
    await openPercentage(user);
    const sam = screen.getByLabelText('Percentage for Sam');
    const maya = screen.getByLabelText('Percentage for Maya');
    const devin = screen.getByLabelText('Percentage for Devin');
    await user.clear(sam);
    await user.type(sam, '50');
    await user.clear(maya);
    await user.type(maya, '30');
    await user.clear(devin);
    await user.type(devin, '20');
    await user.click(saveButton());
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalledTimes(1));
    expect(sentExpense().splitMethod).toBe('percentage');
    expect(sentExpense().splitValues).toEqual({ 1: '50.00', 2: '30.00', 3: '20.00' });
  });
});

describe('Errors from the server', () => {
  it('shows the sentence the backend sends back', async () => {
    expensesApi.createExpense.mockResolvedValue(fail(422, { detail: 'Payer and participants must be accepted group members.' }));
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user);
    await user.click(saveButton());
    await findAlert('Payer and participants must be accepted group members.');
    expect(saveButton()).toBeEnabled();
  });

  it('says when the server cannot be reached', async () => {
    expensesApi.createExpense.mockResolvedValue(network);
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user);
    await user.click(saveButton());
    await findAlert('We couldn’t reach the server. Check your connection and try again.');
  });

  it('offers Try again when the members cannot be loaded', async () => {
    groupsApi.getMembers.mockResolvedValueOnce(network).mockResolvedValue(ok(members));
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group });
    await findAlert('We couldn’t load the members. Check your connection and try again.');
    expect(saveButton()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Maya/ })).toBeInTheDocument();
  });

  it('says so when the user is not a member of the group', async () => {
    groupsApi.getMembers.mockResolvedValue(fail(403, { detail: 'You are not an accepted member of this group.' }));
    renderApp('/groups/5/expenses/new', { group });
    await findAlert('You can’t add an expense to this group.');
  });
});

describe('Choosing a group', () => {
  it('asks the user to create a group when there are none', async () => {
    saveGroups(); // the server list is empty
    renderApp('/expenses/new');
    expect(await screen.findByRole('heading', { name: 'You’re not in a group yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create group' })).toHaveAttribute('href', '/groups/new');
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('opens straight into the form when there is one group', async () => {
    renderApp('/expenses/new');
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toHaveValue('5');
  });

  it('opens on the first group with the form showing, then loads another group’s members when it is chosen', async () => {
    saveGroups(group, other);
    const user = userEvent.setup();
    renderApp('/expenses/new');
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toHaveValue('5');
    expect(groupsApi.getMembers).toHaveBeenCalledWith(5);

    await user.selectOptions(screen.getByLabelText('Group'), 'Apartment 4B');
    await waitFor(() => expect(groupsApi.getMembers).toHaveBeenCalledWith(6));
    expect(screen.getByLabelText('Group')).toHaveValue('6');
  });

  it('keeps the title and total when the group is changed', async () => {
    saveGroups(group, other);
    const user = userEvent.setup();
    renderApp('/expenses/new');
    await user.type(await screen.findByLabelText('Title'), 'Rent');
    await user.type(screen.getByLabelText('Total ($)'), '900');
    await user.selectOptions(screen.getByLabelText('Group'), 'Apartment 4B');
    await screen.findByRole('button', { name: /Maya/ });
    expect(screen.getByLabelText('Title')).toHaveValue('Rent');
    expect(screen.getByLabelText('Total ($)')).toHaveValue('900');
  });

  it('rejects an address that is not a group number', async () => {
    renderApp('/groups/abc/expenses/new');
    await findAlert('That group address isn’t valid.');
  });
});

describe('Group default split', () => {
  // Makes GET /groups/{id}/split-default answer with this default for one group (percentages in basis points).
  // Other groups answer even.
  const defaults = {};
  const saveDefault = (id, value) => {
    defaults[id] = value;
    groupsApi.getSplitDefault.mockImplementation((gid) =>
      Promise.resolve(ok(defaults[gid] ?? { method: 'even', percents: {} }))
    );
  };
  beforeEach(() => {
    Object.keys(defaults).forEach((k) => delete defaults[k]);
  });
  const split532 = { method: 'percentage', percents: { 1: 5000, 2: 3000, 3: 2000 } };

  it('starts even when the group has no saved default', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Group default: even\./)).toBeInTheDocument();
  });

  it('starts on the saved percentages and shows each dollar share', async () => {
    saveDefault(5, split532);
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, 'Rent', '10');
    expect(screen.getByRole('button', { name: 'Percentage' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Group default: percentage\./)).toBeInTheDocument();
    expect(screen.getByLabelText('Percentage for Sam')).toHaveValue('50.00');
    expect(screen.getByLabelText('Percentage for Maya')).toHaveValue('30.00');
    expect(screen.getByLabelText('Percentage for Devin')).toHaveValue('20.00');
    const rows = within(screen.getByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('$5.00');
    expect(rows[1]).toHaveTextContent('$3.00');
    expect(rows[2]).toHaveTextContent('$2.00');
  });

  it('saves the default percentages without the person typing anything', async () => {
    saveDefault(5, split532);
    expensesApi.createExpense.mockResolvedValue(ok({ id: 9, description: 'Rent' }, 201));
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, 'Rent', '10');
    await user.click(saveButton());
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalledTimes(1));
    expect(sentExpense().splitMethod).toBe('percentage');
    expect(sentExpense().splitValues).toEqual({ 1: '50.00', 2: '30.00', 3: '20.00' });
  });

  it('can be switched to even for one expense, and the group keeps its default', async () => {
    saveDefault(5, split532);
    const user = userEvent.setup();
    await openPage();
    await fillBasics(user, 'Rent', '10');
    await user.click(screen.getByRole('button', { name: 'Even' }));
    expect(screen.getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Percentage for Sam')).toBeNull();
    expect(groupsApi.saveSplitDefault).not.toHaveBeenCalled(); // changing one expense never changes the group default
  });

  it('scales the saved percentages to the people left when someone is taken out', async () => {
    saveDefault(5, split532);
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: /Devin/ }));
    expect(screen.getByLabelText('Percentage for Sam')).toHaveValue('62.50');
    expect(screen.getByLabelText('Percentage for Maya')).toHaveValue('37.50');
  });

  it('uses equal percentages when a member has no saved percentage', async () => {
    saveDefault(5, { method: 'percentage', percents: { 1: 6000, 2: 4000 } });
    await openPage();
    expect(screen.getByLabelText('Percentage for Sam')).toHaveValue('33.34');
    expect(screen.getByLabelText('Percentage for Devin')).toHaveValue('33.33');
  });

  it('switches to the other group’s default when the group is changed', async () => {
    saveGroups(group, other);
    saveDefault(6, split532);
    const user = userEvent.setup();
    renderApp('/expenses/new');
    await screen.findByRole('button', { name: /Maya/ });
    expect(screen.getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(screen.getByLabelText('Group'), 'Apartment 4B');
    expect(await screen.findByLabelText('Percentage for Sam')).toHaveValue('50.00');
    expect(screen.getByRole('button', { name: 'Percentage' })).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(screen.getByLabelText('Group'), 'Lake House');
    await waitFor(() => expect(screen.queryByLabelText('Percentage for Sam')).toBeNull());
    expect(screen.getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts even when the server cannot give the default', async () => {
    groupsApi.getSplitDefault.mockResolvedValue(fail(409, { detail: 'Saved split default is inconsistent.' }));
    await openPage();
    expect(screen.getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks the server for the default of the group that is open', async () => {
    saveDefault(5, split532);
    await openPage();
    expect(groupsApi.getSplitDefault).toHaveBeenCalledWith(5);
  });
});

describe('Long names in the split list', () => {
  const longMembers = [
    { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
    { user_id: 2, name: 'Maximiliano-Alexander Fernandez', email: 'max@example.com', is_admin: false },
  ];

  it('gives an arrow only to a name over 22 characters, and opens and closes the full name', async () => {
    groupsApi.getMembers.mockResolvedValue(ok(longMembers));
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByRole('heading', { name: 'Add expense', level: 1 });
    const rows = within(await screen.findByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(within(rows[0]).queryByRole('button')).toBeNull(); // short name: no arrow
    const arrow = within(rows[1]).getByRole('button', { name: 'Show the full name for Maximiliano-Alexander F.' });
    expect(arrow).toHaveAttribute('aria-expanded', 'false');
    expect(rows[1].querySelector('.split-who')).not.toHaveClass('is-open');

    await user.click(arrow);
    expect(within(rows[1]).getByRole('button', { name: 'Hide the full name for Maximiliano-Alexander F.' })).toHaveAttribute('aria-expanded', 'true');
    expect(rows[1].querySelector('.split-who')).toHaveClass('is-open');
    await user.click(within(rows[1]).getByRole('button', { name: /Hide the full name/ }));
    expect(rows[1].querySelector('.split-who')).not.toHaveClass('is-open');
  });

  it('keeps the whole name in the page text either way', async () => {
    groupsApi.getMembers.mockResolvedValue(ok(longMembers));
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByRole('heading', { name: 'Add expense', level: 1 });
    const rows = within(await screen.findByRole('list', { name: 'Each person’s share' })).getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('Maximiliano-Alexander F.');
  });
});

describe('Who is in this expense: the summary box', () => {
  it('shows Everyone (n), then "x of n" when someone is taken out', async () => {
    const user = userEvent.setup();
    groupsApi.getMembers.mockResolvedValue(ok([
      { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
      { user_id: 2, email: 'maya@example.com', is_admin: false },
      { user_id: 3, email: 'devin@example.com', is_admin: false },
    ]));
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByRole('heading', { name: 'Add expense', level: 1 });
    expect(await screen.findByText('Everyone (3)')).toBeInTheDocument();
    const maya = screen.getByRole('button', { name: 'Maya' });
    expect(maya).toHaveAttribute('aria-pressed', 'true');
    await user.click(maya);
    expect(maya).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('is a button: tap it to take everyone out, tap again to put everyone back in', async () => {
    const user = userEvent.setup();
    groupsApi.getMembers.mockResolvedValue(ok([
      { user_id: 1, email: 'sam@umkc.edu', is_admin: true },
      { user_id: 2, email: 'maya@example.com', is_admin: false },
      { user_id: 3, email: 'devin@example.com', is_admin: false },
    ]));
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByRole('heading', { name: 'Add expense', level: 1 });
    const members = () => within(screen.getByRole('list', { name: 'Members' }));
    await user.click(await screen.findByRole('button', { name: /^Everyone \(3\).*Tap to take everyone out/ }));
    expect(members().queryAllByRole('button', { pressed: true })).toHaveLength(0);
    // someone in, not everyone: the tap puts everyone in
    await user.click(screen.getByRole('button', { name: /^0 of 3.*Tap to put everyone in/ }));
    expect(members().getAllByRole('button', { pressed: true })).toHaveLength(3);
    await user.click(members().getByRole('button', { name: 'Maya' }));
    await user.click(screen.getByRole('button', { name: /^2 of 3.*Tap to put everyone in/ }));
    expect(members().getAllByRole('button', { pressed: true })).toHaveLength(3);
  });
});

describe('Who is in this expense: a big group', () => {
  it('shows at most 4 avatars in the box and then +N, with the count in words', async () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({ user_id: i + 1, email: `person${String.fromCharCode(97 + i)}@example.com`, is_admin: i === 0 }));
    groupsApi.getMembers.mockResolvedValue(ok(eight));
    renderApp('/groups/5/expenses/new', { group });
    expect(await screen.findByText('Everyone (8)')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    expect(document.querySelectorAll('.who-summary .stk .av:not(.stk-more)')).toHaveLength(4);
    expect(within(screen.getByRole('list', { name: 'Members' })).getAllByRole('button', { pressed: true })).toHaveLength(8); // every person still has their own pill
  });
});

describe('Guided flow: the expense card and the line to the next card', () => {
  it('turns the card green and shows the guide line only once there is a title and a valid total', async () => {
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByRole('heading', { name: 'Add expense', level: 1 });
    const card = (await screen.findByLabelText('Title')).closest('.add-expense');
    expect(card).not.toHaveClass('is-done');
    expect(document.querySelector('.flow-trace')).toBeNull();

    await user.type(screen.getByLabelText('Title'), 'Tacos');
    expect(card).not.toHaveClass('is-done'); // a title alone is not enough
    await user.type(screen.getByLabelText('Total ($)'), '24.50');
    expect(card).toHaveClass('is-done');
    const trace = document.querySelector('.flow-trace');
    expect(trace).not.toBeNull();
    expect(trace).toHaveAttribute('aria-hidden', 'true'); // decoration only

    await user.clear(screen.getByLabelText('Total ($)'));
    expect(card).not.toHaveClass('is-done');
    expect(document.querySelector('.flow-trace')).toBeNull();
  });

  it('keeps the group picker, now beside the heading, usable by its label', async () => {
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByRole('heading', { name: 'Add expense', level: 1 });
    expect(await screen.findByLabelText('Group')).toHaveValue('5');
  });
});
