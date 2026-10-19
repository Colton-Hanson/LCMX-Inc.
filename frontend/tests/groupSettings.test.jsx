// Tests for the Group settings screen (SCRUM-69): member list, add, remove with a balance warning, reassign admin.
// The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');

const group = { id: 5, name: 'Lake House', type: 'outing' };
const adminList = [
  { user_id: 1, email: 'cole@umkc.edu', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];
const memberView = [
  { user_id: 1, email: 'cole@umkc.edu', is_admin: false },
  { user_id: 2, email: 'maya@example.com', is_admin: true },
];

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(adminList));
});

async function openPage() {
  renderApp('/groups/5/settings', { group });
  await screen.findByRole('heading', { name: 'Group settings', level: 1 });
  await screen.findByText('maya@example.com');
}

describe('Group settings: member list', () => {
  it('lists every member with Admin or Member status and marks you', async () => {
    await openPage();
    const list = screen.getByRole('heading', { name: 'Members' }).closest('section');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('cole@umkc.edu')).toBeInTheDocument();
    expect(within(rows[0]).getByText('You')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Admin')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Member')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Lake House' })).toHaveAttribute('href', '/groups/5');
  });

  it('gives admins a Remove button for other people only', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove devin@example.com from Lake House' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove cole@umkc.edu/ })).toBeNull();
  });

  it('hides Remove from people who are not the admin', async () => {
    groupsApi.getMembers.mockResolvedValue(ok(memberView));
    renderApp('/groups/5/settings', { group });
    await screen.findByText('maya@example.com');
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole('button', { name: /Make .* the admin/ })).toBeNull();
    expect(screen.getByText('Only the group’s admin can remove members.')).toBeInTheDocument();
  });

  it('shows Make admin as a turned-off button that explains itself', async () => {
    await openPage();
    const button = screen.getByRole('button', { name: 'Make maya@example.com the admin' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/isn’t available yet/);
    expect(screen.queryByRole('button', { name: 'Make cole@umkc.edu the admin' })).toBeNull();
  });
});

describe('Group settings: add a member', () => {
  it('invites by email and shows the person as Pending', async () => {
    groupsApi.inviteMember.mockResolvedValue(ok({ status: 'pending' }, 201));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Add a member by email'), 'Priya@Example.com');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(groupsApi.inviteMember).toHaveBeenCalledWith(5, 'priya@example.com');
    expect(await screen.findByText('Invite sent to priya@example.com. They show as pending until they accept.')).toBeInTheDocument();
    const row = screen.getByText('Waiting for them to accept').closest('li');
    expect(within(row).getByText('priya@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Pending')).toBeInTheDocument();
    expect(screen.getByLabelText('Add a member by email')).toHaveValue('');
  });

  it('checks the email before sending', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Enter an email address to invite.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add a member by email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Add a member by email'));
    await user.type(screen.getByLabelText('Add a member by email'), 'MAYA@example.com');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('That person is already in the group or has been invited.')).toBeInTheDocument();
    expect(groupsApi.inviteMember).not.toHaveBeenCalled();
  });

  it('says when the email has no account yet and adds no Pending row', async () => {
    groupsApi.inviteMember.mockResolvedValue(ok({ status: 'registration_required' }, 201));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Add a member by email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('new@example.com doesn’t have an account yet, so no invite was sent.')).toBeInTheDocument();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('shows the server message when the invite is refused (409)', async () => {
    groupsApi.inviteMember.mockResolvedValue(fail(409, { detail: 'This user has already been invited or is a member.' }));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Add a member by email'), 'sam@example.com');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    await findAlert('This user has already been invited or is a member.');
  });
});

describe('Group settings: remove a member', () => {
  it('removes a member with no balance right away', async () => {
    groupsApi.removeMember.mockResolvedValue(ok({ message: 'Member removed successfully.', group_id: 5, user_id: 2 }));
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' }));
    expect(groupsApi.removeMember).toHaveBeenCalledWith(5, 2, false);
    expect(await screen.findByText('maya@example.com was removed from Lake House.')).toBeInTheDocument();
    expect(screen.queryByText('Member', { selector: '.pill' })).toBeInTheDocument(); // Devin is still listed
    const list = screen.getByRole('heading', { name: 'Members' }).closest('section');
    expect(within(list).queryByText('maya@example.com')).toBeNull();
  });

  it('warns about an unsettled balance, and only removes after "Remove anyway"', async () => {
    groupsApi.removeMember
      .mockResolvedValueOnce(fail(409, { detail: { message: 'Member has an outstanding balance.', balance: 12.5, confirmation_required: true } }))
      .mockResolvedValueOnce(ok({ message: 'Member removed successfully.', group_id: 5, user_id: 2 }));
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove maya@example.com?' });
    expect(within(dialog).getByText(/has an unsettled balance of \$12\.50 in this group/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus(); // the safe choice is focused first
    expect(groupsApi.removeMember).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole('button', { name: 'Remove anyway' }));
    expect(groupsApi.removeMember).toHaveBeenLastCalledWith(5, 2, true);
    expect(await screen.findByText('maya@example.com was removed from Lake House.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancel on the balance warning keeps the member and closes the dialog', async () => {
    groupsApi.removeMember.mockResolvedValue(fail(409, { detail: { message: 'x', balance: -4, confirmation_required: true } }));
    const user = userEvent.setup();
    await openPage();
    const opener = screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/\$4\.00/)).toBeInTheDocument(); // shown without the minus sign
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(groupsApi.removeMember).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
    expect(screen.getByText('maya@example.com')).toBeInTheDocument();
  });

  it('Escape closes the balance warning', async () => {
    groupsApi.removeMember.mockResolvedValue(fail(409, { detail: { message: 'x', balance: 3, confirmation_required: true } }));
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Tab inside the balance warning', async () => {
    groupsApi.removeMember.mockResolvedValue(fail(409, { detail: { message: 'x', balance: 3, confirmation_required: true } }));
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' }));
    const dialog = await screen.findByRole('dialog');
    const anyway = within(dialog).getByRole('button', { name: 'Remove anyway' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveFocus();
    await user.tab(); // from the last control, back to the first
    expect(anyway).toHaveFocus();
    await user.tab({ shift: true }); // from the first control, back to the last
    expect(cancel).toHaveFocus();
  });

  it('explains why the only admin cannot be removed (409)', async () => {
    groupsApi.removeMember.mockResolvedValue(fail(409, { detail: 'Cannot remove the group’s sole administrator.' }));
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove devin@example.com from Lake House' }));
    await findAlert('Cannot remove the group’s sole administrator.');
    expect(screen.getByText('devin@example.com')).toBeInTheDocument();
  });

  it('shows a connection error and keeps the member', async () => {
    groupsApi.removeMember.mockResolvedValue(network);
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' }));
    await findAlert(/couldn’t reach the server/i);
    expect(screen.getByText('maya@example.com')).toBeInTheDocument();
  });

  it('sends a logged-out user to log in', async () => {
    groupsApi.removeMember.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from Lake House' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('Group settings: loading problems', () => {
  it('offers Try again when the members cannot be loaded', async () => {
    groupsApi.getMembers.mockResolvedValueOnce(network).mockResolvedValue(ok(adminList));
    const user = userEvent.setup();
    renderApp('/groups/5/settings', { group });
    expect(await screen.findByText(/couldn’t load the members/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('maya@example.com')).toBeInTheDocument();
  });

  it('says so when the user is not a member of the group', async () => {
    groupsApi.getMembers.mockResolvedValue(fail(403, { detail: 'You are not an accepted member of this group.' }));
    renderApp('/groups/5/settings', { group });
    await findAlert(/can’t open this group’s settings/i);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Members' })).toBeNull());
  });
});
