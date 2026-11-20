// Tests for editing and deleting an expense (SCRUM-135): who sees the buttons, the details dialog,
// the delete question, the edit form and the event picker. The API modules are mocked.

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import * as proposedApi from '../src/api/proposed.js';
import { canChangeExpense, CHANGE_RULE_TEXT, PAYER_AND_CREATOR_MAY_CHANGE } from '../src/lib/expensePermissions.js';
import { checkA11y } from './a11y.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');
vi.mock('../src/api/expenses.js');
vi.mock('../src/api/proposed.js', async (original) => ({
  ...(await original()),
  getGroupSettlements: vi.fn(),
  recordSettlement: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));

const group = { id: 5, name: 'Lake House', type: 'outing' };
const membersAs = (admin) => [
  { user_id: 1, email: 'sam@example.com', is_admin: admin },
  { user_id: 2, email: 'maya@example.com', is_admin: !admin },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];
const expense = (id, description, paidBy, extra = {}) => ({
  id,
  group_id: 5,
  description,
  amount: '30.00',
  paid_by: paidBy,
  created_at: '2026-10-30T12:00:00Z',
  shares: { 1: '10.00', 2: '10.00', 3: '10.00' },
  ...extra,
});
// You (user 1) paid Pizza. Maya paid Gas. Maya paid Tickets but you added it.
const list = [expense(11, 'Pizza', 1), expense(12, 'Gas', 2), expense(13, 'Tickets', 2, { created_by: 1 })];
const notBuilt = fail(405, { detail: 'Method Not Allowed' });

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem('groups:1', JSON.stringify([group]));
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(membersAs(true))); // the server lets only a group admin change an expense
  groupsApi.getGroupEvents.mockResolvedValue(ok([]));
  expensesApi.getGroupExpenses.mockResolvedValue(ok(list));
  proposedApi.getGroupSettlements.mockResolvedValue(ok([]));
  proposedApi.deleteExpense.mockResolvedValue(ok(null, 204));
  proposedApi.updateExpense.mockResolvedValue(ok({ description: 'Pizza night' }));
});

async function openGroup() {
  const user = userEvent.setup();
  renderApp('/groups/5', { group });
  await screen.findByRole('button', { name: 'Pizza' });
  return user;
}
const actionNames = () => screen.queryAllByRole('button', { name: /^(Edit|Delete) / }).map((b) => b.getAttribute('aria-label'));

// Changed for the real backend: today only a group admin may edit or delete (403 for anyone else).
// The payer and creator rule sits behind PAYER_AND_CREATOR_MAY_CHANGE, which is off.
describe('Who may change an expense', () => {
  const e = { paid_by: 2, created_by: 3 };
  it('follows the server: admin only, with the payer and creator rule switched off', () => {
    expect(PAYER_AND_CREATOR_MAY_CHANGE).toBe(false);
    expect(CHANGE_RULE_TEXT).toBe('Only a group admin can change this expense.');
  });
  it('does not let the person who paid', () => expect(canChangeExpense({ expense: e, myId: 2 })).toBe(false));
  it('does not let the person who added it', () => expect(canChangeExpense({ expense: e, myId: 3 })).toBe(false));
  it('lets the group admin', () => expect(canChangeExpense({ expense: e, myId: 9, isAdmin: true })).toBe(true));
  it('lets someone who is the payer and the admin', () => expect(canChangeExpense({ expense: e, myId: 2, isAdmin: true })).toBe(true));
  it('does not let someone who paid and added it but is not the admin', () => expect(canChangeExpense({ expense: { paid_by: 4, created_by: 4 }, myId: 4 })).toBe(false));
  it('does not let anyone else', () => expect(canChangeExpense({ expense: e, myId: 9 })).toBe(false));
  it('does not treat a missing "added by" as a match', () => {
    expect(canChangeExpense({ expense: { paid_by: 2 }, myId: undefined })).toBe(false);
    expect(canChangeExpense({ expense: { paid_by: 2, created_by: null }, myId: 9 })).toBe(false);
  });
  it('says no when there is no expense', () => expect(canChangeExpense({ expense: null, myId: 1, isAdmin: true })).toBe(false));
});

describe('Group page: Edit and Delete only where allowed', () => {
  it('shows none to a member who is not the admin, even on what they paid or added', async () => {
    groupsApi.getMembers.mockResolvedValue(ok(membersAs(false)));
    await openGroup();
    expect(actionNames()).toEqual([]);
  });

  it('shows them on every expense for the group admin', async () => {
    await openGroup();
    expect(actionNames()).toEqual(['Edit Pizza', 'Delete Pizza', 'Edit Gas', 'Delete Gas', 'Edit Tickets', 'Delete Tickets']);
  });
});

describe('Expense details dialog', () => {
  it('opens from the title with who paid, each share and the mini receipt', async () => {
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    const dialog = screen.getByRole('dialog', { name: 'Pizza' });
    expect(dialog).toHaveAccessibleDescription('You paid $30.00 on Oct 30, 2026 in Lake House.');
    const shares = within(dialog).getByRole('list', { name: 'Each person’s share' });
    expect(within(shares).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['You$10.00', 'maya@example.com$10.00', 'devin@example.com$10.00']);
    expect(within(dialog).getByRole('group', { name: 'Receipt: Lake House, Oct 30, 2026, 1 item, total 30.00' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('has no Edit or Delete, and says who can change it, when you are not allowed', async () => {
    groupsApi.getMembers.mockResolvedValue(ok(membersAs(false)));
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    const dialog = screen.getByRole('dialog', { name: 'Pizza' });
    expect(within(dialog).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Only a group admin can change this expense.')).toBeInTheDocument();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('closes with Close and with Escape, and gives focus back to the title', async () => {
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pizza' })).toHaveFocus();
  });

  it('has no accessibility problems, for someone allowed and someone not', async () => {
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    expect(await checkA11y()).toHaveNoViolations();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Gas' }));
    expect(await checkA11y()).toHaveNoViolations();
  });
});

describe('Deleting an expense', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Delete Pizza' }));
    return screen.getByRole('dialog', { name: 'Delete this expense?' });
  };

  it('asks first and says exactly what is lost and how balances change', async () => {
    const user = await openGroup();
    const dialog = await openDelete(user);
    expect(dialog).toHaveAccessibleDescription(
      'This deletes “Pizza” ($30.00) and each person’s share of it. Balances in Lake House are worked out again without it, so what people owe each other will change. This can’t be undone.'
    );
    expect(within(dialog).getByText('Shares that will be deleted')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
    expect(within(dialog).getByRole('button', { name: 'Keep it' })).toHaveFocus();
    expect(proposedApi.deleteExpense).not.toHaveBeenCalled();
  });

  it('deletes it, says so, and loads the list again', async () => {
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    expect(proposedApi.deleteExpense).toHaveBeenCalledWith(11);
    const note = await screen.findByText('Expense “Pizza” deleted. Balances are updated.');
    expect(note.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(expensesApi.getGroupExpenses).toHaveBeenCalledTimes(2));
  });

  it('can be reached from the details dialog too', async () => {
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete this expense?' })).toBeInTheDocument();
  });

  it('keeps the expense on Keep it and on Escape', async () => {
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openDelete(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Pizza' })).toHaveFocus();
    expect(proposedApi.deleteExpense).not.toHaveBeenCalled();
  });

  it('shows a calm not available note and turns the button off when the server cannot delete yet', async () => {
    proposedApi.deleteExpense.mockResolvedValue(notBuilt);
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    const note = await within(dialog).findByText('Deleting an expense isn’t available yet. Nothing was deleted.');
    expect(note.closest('[role="status"]')).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    const button = within(dialog).getByRole('button', { name: 'Delete expense' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Deleting an expense isn’t available yet. Nothing was deleted.');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('shows the server message when it fails', async () => {
    proposedApi.deleteExpense.mockResolvedValue(fail(403, { detail: 'You can’t delete this expense.' }));
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    expect(await findAlert('You can’t delete this expense.')).toBeInTheDocument();
  });

  // Changed for the real backend: a lost connection shows the calm not available note.
  it('shows the not available note when the server cannot be reached', async () => {
    proposedApi.deleteExpense.mockResolvedValue(network);
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    expect(await within(dialog).findByText('Deleting an expense isn’t available yet. Nothing was deleted.')).toBeInTheDocument();
  });

  it('shows the server’s 409 message for an expense linked to a receipt', async () => {
    proposedApi.deleteExpense.mockResolvedValue(fail(409, { detail: 'Expense has a linked receipt; detach or manage the receipt first.' }));
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    expect(await findAlert('Expense has a linked receipt; detach or manage the receipt first.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete expense' })).toBeEnabled();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('sends a logged-out user to log in', async () => {
    proposedApi.deleteExpense.mockResolvedValue(fail(401));
    const user = await openGroup();
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('Editing an expense', () => {
  const openEdit = async () => {
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Edit Pizza' }));
    await screen.findByRole('heading', { name: 'Edit expense', level: 1 });
    await screen.findByLabelText('Paid by');
    return user;
  };

  it('opens the add expense layout filled in from the expense, with the group locked', async () => {
    await openEdit();
    expect(screen.getByLabelText('Title')).toHaveValue('Pizza');
    expect(screen.getByLabelText('Total ($)')).toHaveValue('30.00');
    expect(screen.getByLabelText('Group')).toBeDisabled();
    expect(screen.getByLabelText('Paid by')).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Amount for maya@example.com')).toHaveValue('10.00');
    expect(screen.queryByRole('group', { name: 'How to add' })).not.toBeInTheDocument();
  });

  it('can be opened from the details dialog', async () => {
    const user = await openGroup();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('heading', { name: 'Edit expense', level: 1 })).toBeInTheDocument();
  });

  it('saves the changes to that expense and goes back to the group with a note', async () => {
    const user = await openEdit();
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Pizza night');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(proposedApi.updateExpense).toHaveBeenCalledWith(11, {
      groupId: 5,
      description: 'Pizza night',
      amount: '30.00',
      paidBy: 1,
      eventId: null,
      participantIds: [1, 2, 3],
      splitMethod: 'custom',
      splitValues: { 1: '10.00', 2: '10.00', 3: '10.00' },
    });
    expect(expensesApi.createExpense).not.toHaveBeenCalled();
    expect(await screen.findByText('Expense “Pizza night” updated: $30.00 shared by 3 people.')).toBeInTheDocument();
  });

  it('shows the server’s 409 message when the expense is linked to a receipt', async () => {
    proposedApi.updateExpense.mockResolvedValue(fail(409, { detail: 'This expense has a linked receipt; edit its items through receipt review.' }));
    const user = await openEdit();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await findAlert('This expense has a linked receipt; edit its items through receipt review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('shows a calm not available note and turns Save changes off when the server cannot edit yet', async () => {
    proposedApi.updateExpense.mockResolvedValue(notBuilt);
    const user = await openEdit();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const note = await screen.findByText('Editing an expense isn’t available yet. Nothing was changed.');
    expect(note.closest('[role="status"]')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Editing an expense isn’t available yet. Nothing was changed.');
    expect(await checkA11y()).toHaveNoViolations();
  });

  it('shows the server message when saving fails', async () => {
    proposedApi.updateExpense.mockResolvedValue(fail(403, { detail: 'You can’t change this expense.' }));
    const user = await openEdit();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await findAlert('You can’t change this expense.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('still blocks a title that is empty', async () => {
    const user = await openEdit();
    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(proposedApi.updateExpense).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  });

  it('Cancel goes back to the group without saving', async () => {
    const user = await openEdit();
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Recent expenses' })).toBeInTheDocument();
    expect(proposedApi.updateExpense).not.toHaveBeenCalled();
  });

  it('ignores an expense from another group and shows the plain add form', async () => {
    renderApp('/groups/5/expenses/new', { group, edit: { ...list[0], group_id: 99 } });
    expect(await screen.findByRole('heading', { name: 'Add expense', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });
});

describe('Event picker on add and edit expense', () => {
  const cabin = { id: 7, group_id: 5, name: 'Lake Cabin', member_ids: [2, 3] };

  it('is left out when the group has no events', async () => {
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByLabelText('Paid by');
    expect(groupsApi.getGroupEvents).toHaveBeenCalledWith(5);
    expect(screen.queryByLabelText(/^Event/)).not.toBeInTheDocument();
  });

  it('lists the group’s events and puts the event’s members in the split', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([cabin]));
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group });
    const picker = await screen.findByLabelText(/^Event/);
    expect(picker).toHaveAccessibleDescription('Picking an event puts its members in the split.');
    await user.selectOptions(picker, 'Lake Cabin');
    const chips = within(screen.getByRole('list', { name: 'Members' }));
    expect(chips.getByRole('button', { name: /sam@example\.com/ })).toHaveAttribute('aria-pressed', 'false');
    expect(chips.getByRole('button', { name: /maya@example\.com/ })).toHaveAttribute('aria-pressed', 'true');
    expect(chips.getByRole('button', { name: /devin@example\.com/ })).toHaveAttribute('aria-pressed', 'true');
    await user.selectOptions(picker, 'No event');
    expect(chips.getByRole('button', { name: /sam@example\.com/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('is on the edit form too', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([cabin]));
    renderApp('/groups/5/expenses/new', { group, edit: list[0] });
    expect(await screen.findByLabelText(/^Event/)).toBeInTheDocument();
  });

  it('sends the chosen event when adding', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([cabin]));
    expensesApi.createExpense.mockResolvedValue(ok({ id: 20, description: 'Firewood' }, 201));
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group });
    await user.selectOptions(await screen.findByLabelText(/^Event/), 'Lake Cabin');
    await user.type(screen.getByLabelText('Title'), 'Firewood');
    await user.type(screen.getByLabelText('Total ($)'), '20');
    await user.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(expensesApi.createExpense).toHaveBeenCalledTimes(1));
    expect(expensesApi.createExpense.mock.calls[0][0]).toMatchObject({ eventId: 7, participantIds: [2, 3] });
  });

  it('starts on the expense’s event when editing and sends it with the update', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([cabin]));
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group, edit: { ...list[0], event_id: 7 } });
    const picker = await screen.findByLabelText(/^Event/);
    expect(picker).toHaveValue('7');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(proposedApi.updateExpense).toHaveBeenCalledTimes(1));
    expect(proposedApi.updateExpense.mock.calls[0][1].eventId).toBe(7);
  });

  it('sends no event when No event is chosen on an edit', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([cabin]));
    const user = userEvent.setup();
    renderApp('/groups/5/expenses/new', { group, edit: { ...list[0], event_id: 7 } });
    await user.selectOptions(await screen.findByLabelText(/^Event/), 'No event');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(proposedApi.updateExpense).toHaveBeenCalledTimes(1));
    expect(proposedApi.updateExpense.mock.calls[0][1].eventId).toBeNull();
  });

  it('is left out when the events cannot be loaded', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(network);
    renderApp('/groups/5/expenses/new', { group });
    await screen.findByLabelText('Paid by');
    expect(screen.queryByLabelText(/^Event/)).not.toBeInTheDocument();
  });
});

describe('Balances page: expenses under each person', () => {
  const line = (user, owed, owe) => ({ group_id: 5, other_user_id: user, net_amount: '0.00', owed_to_you: owed, you_owe: owe });
  // Maya owes you 10.00 for Pizza (you paid). You owe Devin 10.00 for Boat (Devin paid).
  const boat = expense(15, 'Boat', 3, { shares: { 1: '10.00', 3: '20.00' } });
  const pizza = expense(11, 'Pizza', 1, { shares: { 1: '20.00', 2: '10.00' } });

  beforeEach(() => {
    expensesApi.getBalances.mockResolvedValue(ok({ group_balances: [line(2, '10.00', '0.00'), line(3, '0.00', '10.00')], overall_balances: [], total_net: '0.00' }));
    expensesApi.getGroupExpenses.mockResolvedValue(ok([pizza, boat]));
  });

  async function openBalances() {
    const user = userEvent.setup();
    renderApp('/balances');
    await screen.findByRole('heading', { name: 'Who owes you', level: 2 });
    await user.click(screen.getByRole('button', { name: 'Show both' }));
    return user;
  }

  it('shows no Edit or Delete to a member who is not the admin, even on an expense they paid', async () => {
    groupsApi.getMembers.mockResolvedValue(ok(membersAs(false)));
    await openBalances();
    expect(actionNames()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Pizza', hidden: true })).toBeInTheDocument();
  });

  it('shows them on every expense for the group admin', async () => {
    await openBalances();
    expect(actionNames()).toEqual(['Edit Pizza', 'Delete Pizza', 'Edit Boat', 'Delete Boat']);
  });

  it('opens the details from an expense line, and deletes from there', async () => {
    const user = await openBalances();
    await user.click(screen.getByRole('button', { name: 'Pizza' }));
    const dialog = screen.getByRole('dialog', { name: 'Pizza' });
    expect(dialog).toHaveAccessibleDescription('You paid $30.00 on Oct 30, 2026 in Lake House.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete expense' }));
    expect(proposedApi.deleteExpense).toHaveBeenCalledWith(11);
    expect(await screen.findByText('Expense “Pizza” deleted. Balances are updated.')).toBeInTheDocument();
    await waitFor(() => expect(expensesApi.getBalances).toHaveBeenCalledTimes(2));
  });

  it('opens the edit form from an expense line', async () => {
    const user = await openBalances();
    await user.click(screen.getByRole('button', { name: 'Edit Pizza' }));
    expect(await screen.findByRole('heading', { name: 'Edit expense', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Pizza');
  });

  it('has no accessibility problems with the expense lines open', async () => {
    await openBalances();
    expect(await checkA11y()).toHaveNoViolations();
  });
});
