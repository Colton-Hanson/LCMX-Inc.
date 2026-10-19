// Tests for the Create group screen (SCRUM-68) and the group page it lands on.
// The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import { renderApp, findAlert, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');

const created = { id: 12, name: 'Beach weekend', group_type: 'outing', created_by: 1 };
const members = [
  { user_id: 1, email: 'cole@umkc.edu', is_admin: true },
  { user_id: 2, email: 'maya@example.com', is_admin: false },
];

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
});

const nameBox = () => screen.getByLabelText('Group name');
const inviteBox = () => screen.getByLabelText('Invite members by email');

describe('Create group screen', () => {
  it('shows the name, the four types (Group outing chosen) and the invite box', async () => {
    renderApp('/groups/new');
    expect(await screen.findByRole('heading', { name: 'Create group', level: 1 })).toBeInTheDocument();
    for (const label of ['Roommate', 'Partner', 'Group outing', 'Family']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Group outing' })).toBeChecked();
    expect(inviteBox()).toBeInTheDocument();
  });

  it('asks for a name and sends nothing when it is empty', async () => {
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.click(await screen.findByRole('button', { name: 'Create group' }));
    expect(await screen.findByText('Enter a group name.')).toBeInTheDocument();
    expect(nameBox()).toHaveAttribute('aria-invalid', 'true');
    expect(nameBox()).toHaveFocus();
    expect(groupsApi.createGroup).not.toHaveBeenCalled();
  });

  it('creates the group with the chosen type and lands on the group page', async () => {
    groupsApi.createGroup.mockResolvedValue(ok(created, 201));
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), '  Beach weekend ');
    await user.click(screen.getByRole('radio', { name: 'Family' }));
    await user.click(screen.getByRole('button', { name: 'Create group' }));

    expect(groupsApi.createGroup).toHaveBeenCalledWith({ name: '  Beach weekend ', groupType: 'family' });
    expect(await screen.findByRole('heading', { name: 'Beach weekend', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('cole@umkc.edu (you)')).toBeInTheDocument();
    expect(groupsApi.inviteMember).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('groups:1'))).toEqual([{ id: 12, name: 'Beach weekend', type: 'outing' }]);
  });

  it('invites everyone on the list after the group exists and says who is pending', async () => {
    groupsApi.createGroup.mockResolvedValue(ok(created, 201));
    groupsApi.inviteMember.mockResolvedValue(ok({ status: 'pending' }, 201));
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), 'Beach weekend');
    await user.type(inviteBox(), 'Maya@Example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(inviteBox(), 'devin@example.com{Enter}'); // Enter adds, it does not submit the form
    expect(groupsApi.createGroup).not.toHaveBeenCalled();
    const list = screen.getByRole('list', { name: 'People you are inviting' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText(/Invite sent to maya@example.com, devin@example.com/)).toBeInTheDocument();
    expect(groupsApi.inviteMember).toHaveBeenNthCalledWith(1, 12, 'maya@example.com');
    expect(groupsApi.inviteMember).toHaveBeenNthCalledWith(2, 12, 'devin@example.com');
    expect(groupsApi.createGroup).toHaveBeenCalledTimes(1);
  });

  it('lets the user take someone off the invite list', async () => {
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Invite members by email'), 'maya@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Remove maya@example.com from the invite list' }));
    expect(screen.queryByRole('list', { name: 'People you are inviting' })).toBeNull();
  });

  it('rejects a bad, repeated or own email in the invite box', async () => {
    const user = userEvent.setup();
    renderApp('/groups/new');
    const box = await screen.findByLabelText('Invite members by email');
    await user.type(box, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'COLE@umkc.edu');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('You are already in this group.')).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'maya@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(box, 'maya@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('That email is already on the list.')).toBeInTheDocument();
  });

  it('explains when an invited email has no account or was already invited', async () => {
    groupsApi.createGroup.mockResolvedValue(ok(created, 201));
    groupsApi.inviteMember
      .mockResolvedValueOnce(ok({ status: 'registration_required' }, 201))
      .mockResolvedValueOnce(fail(409, { detail: 'This user has already been invited or is a member.' }));
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), 'Beach weekend');
    await user.type(inviteBox(), 'new@example.com{Enter}');
    await user.type(inviteBox(), 'maya@example.com{Enter}');
    await user.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText('new@example.com doesn’t have an account yet, so no invite was sent.')).toBeInTheDocument();
    expect(screen.getByText('maya@example.com was already invited or is already a member.')).toBeInTheDocument();
  });

  it('shows the server message and stays put when the group cannot be created', async () => {
    groupsApi.createGroup.mockResolvedValue(fail(422, { detail: 'Group name cannot be blank.' }));
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Create group' }));
    await findAlert('Group name cannot be blank.');
    expect(screen.getByRole('heading', { name: 'Create group', level: 1 })).toBeInTheDocument();
    expect(groupsApi.inviteMember).not.toHaveBeenCalled();
    expect(localStorage.getItem('groups:1')).toBeNull();
  });

  it('shows a connection error when the server cannot be reached', async () => {
    groupsApi.createGroup.mockResolvedValue(network);
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), 'Trip');
    await user.click(screen.getByRole('button', { name: 'Create group' }));
    await findAlert(/couldn’t reach the server/i);
    expect(screen.getByRole('button', { name: 'Create group' })).toBeEnabled();
  });

  it('Cancel saves nothing and goes back to Groups', async () => {
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), 'Never saved');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Groups', level: 1 })).toBeInTheDocument();
    expect(groupsApi.createGroup).not.toHaveBeenCalled();
    expect(localStorage.getItem('groups:1')).toBeNull();
  });

  it('sends a logged-out user to log in', async () => {
    groupsApi.createGroup.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    const user = userEvent.setup();
    renderApp('/groups/new');
    await user.type(await screen.findByLabelText('Group name'), 'Trip');
    await user.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('Group page', () => {
  it('shows the name, type, member count and roles', async () => {
    renderApp('/groups/12', { group: { id: 12, name: 'Beach weekend', type: 'outing' } });
    expect(await screen.findByRole('heading', { name: 'Beach weekend', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('2 members')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('maya@example.com')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New event' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Group settings' })).toHaveAttribute('href', '/groups/12/settings');
  });

  it('finds the name from the groups remembered on this device', async () => {
    localStorage.setItem('groups:1', JSON.stringify([{ id: 12, name: 'Remembered', type: 'family' }]));
    renderApp('/groups/12');
    expect(await screen.findByRole('heading', { name: 'Remembered', level: 1 })).toBeInTheDocument();
  });

  it('says so when the user cannot open the group', async () => {
    groupsApi.getMembers.mockResolvedValue(fail(403, { detail: 'You are not an accepted member of this group.' }));
    localStorage.setItem('groups:1', JSON.stringify([{ id: 12, name: 'Old', type: 'family' }]));
    renderApp('/groups/12');
    await findAlert(/can’t open this group/i);
    await waitFor(() => expect(localStorage.getItem('groups:1')).toBe('[]')); // forgotten
  });

  it('rejects an address that is not a group number', async () => {
    renderApp('/groups/abc');
    await findAlert('That group address isn’t valid.');
    expect(groupsApi.getMembers).not.toHaveBeenCalled();
  });
});

describe('Groups list', () => {
  it('lists remembered groups with a Create group button', async () => {
    localStorage.setItem('groups:1', JSON.stringify([{ id: 3, name: 'Family', type: 'family' }]));
    renderApp('/groups');
    expect(await screen.findByRole('heading', { name: 'Groups', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Family/ })).toHaveAttribute('href', '/groups/3');
    expect(screen.getByRole('link', { name: 'Create group' })).toHaveAttribute('href', '/groups/new');
  });

  it('shows an empty message when there are none', async () => {
    renderApp('/groups');
    expect(await screen.findByText(/No groups on this device yet/)).toBeInTheDocument();
  });
});
