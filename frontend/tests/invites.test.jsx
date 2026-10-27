// Tests for pending invitations on the Home page (SCRUM-71): accept and decline, with no page refresh.
// The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import { renderApp, me, ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');

const invites = [
  { group_id: 7, group_name: 'Lake House', group_type: 'outing' },
  { group_id: 9, group_name: 'Apartment 4B', group_type: 'roommate' },
];

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok(invites));
});

describe('Pending invites on Home', () => {
  it('lists each invitation with the group name', async () => {
    renderApp('/home');
    const section = (await screen.findByRole('heading', { name: 'Pending invites' })).closest('section');
    const rows = within(section).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('You’re invited to join Lake House.');
    expect(rows[1]).toHaveTextContent('You’re invited to join Apartment 4B.');
    expect(screen.getByRole('button', { name: 'Accept invitation to Lake House' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline invitation to Lake House' })).toBeInTheDocument();
  });

  it('shows no invitations section when there are none', async () => {
    groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
    renderApp('/home');
    await screen.findByRole('heading', { name: 'Your groups' });
    expect(screen.queryByRole('heading', { name: 'Pending invites' })).toBeNull();
    expect(screen.getByText(/not in any groups on this device yet/i)).toBeInTheDocument();
  });

  it('accepting adds the group to Your groups without loading the page again', async () => {
    groupsApi.acceptInvitation.mockResolvedValue(ok({ message: 'Invitation accepted.' }));
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Lake House' }));

    expect(groupsApi.acceptInvitation).toHaveBeenCalledWith(7);
    const groups = screen.getByRole('heading', { name: 'Your groups' }).closest('section');
    const link = await within(groups).findByRole('link', { name: /Lake House/ });
    expect(link).toHaveAttribute('href', '/groups/7');
    expect(screen.getByText('You joined Lake House.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation to Lake House' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Accept invitation to Apartment 4B' })).toBeInTheDocument();
    expect(groupsApi.getPendingInvitations).toHaveBeenCalledTimes(1); // no second load = no refresh
    expect(JSON.parse(localStorage.getItem('groups:1'))).toEqual([{ id: 7, name: 'Lake House', type: 'outing' }]);
  });

  it('moves keyboard focus to the confirmation after an answer', async () => {
    groupsApi.acceptInvitation.mockResolvedValue(ok({}));
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Lake House' }));
    const confirmation = await screen.findByText('You joined Lake House.');
    expect(confirmation.closest('.msg')).toHaveFocus();
  });

  it('declining removes the invitation and does not add a group', async () => {
    groupsApi.declineInvitation.mockResolvedValue(ok({ message: 'Invitation declined.' }));
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Decline invitation to Apartment 4B' }));

    expect(groupsApi.declineInvitation).toHaveBeenCalledWith(9);
    expect(screen.getByText('You declined the invitation to Apartment 4B.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline invitation to Apartment 4B' })).toBeNull();
    const groups = screen.getByRole('heading', { name: 'Your groups' }).closest('section');
    expect(within(groups).queryByRole('link', { name: /Apartment 4B/ })).toBeNull();
    expect(localStorage.getItem('groups:1')).toBeNull();
  });

  it('drops an invitation that is already gone (404) and says so', async () => {
    groupsApi.acceptInvitation.mockResolvedValue(fail(404, { detail: 'Pending invitation not found.' }));
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Lake House' }));
    expect(await screen.findByText('The invitation to Lake House is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation to Lake House' })).toBeNull();
  });

  it('keeps the invitation and shows an error when the answer fails', async () => {
    groupsApi.acceptInvitation.mockResolvedValue(network);
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Lake House' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t reach the server/i);
    expect(screen.getByRole('button', { name: 'Accept invitation to Lake House' })).toBeEnabled();
  });

  it('turns the buttons off while an answer is on its way', async () => {
    groupsApi.acceptInvitation.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Lake House' }));
    expect(screen.getByRole('button', { name: 'Accept invitation to Apartment 4B' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline invitation to Lake House' })).toBeDisabled();
  });

  it('sends the user to log in if the session ended while answering (401)', async () => {
    groupsApi.declineInvitation.mockResolvedValue(fail(401, { detail: 'Authentication required.' }));
    const user = userEvent.setup();
    renderApp('/home');
    await user.click(await screen.findByRole('button', { name: 'Decline invitation to Lake House' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('Your session ended. Log in to continue.')).toBeInTheDocument();
  });

  it('offers Try again when the invitations cannot be loaded', async () => {
    groupsApi.getPendingInvitations.mockResolvedValueOnce(network).mockResolvedValue(ok(invites));
    const user = userEvent.setup();
    renderApp('/home');
    expect(await screen.findByText(/couldn’t load your invitations/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Accept invitation to Lake House' })).toBeInTheDocument();
  });

  it('shows groups remembered on this device under Your groups', async () => {
    localStorage.setItem('groups:1', JSON.stringify([{ id: 3, name: 'Family', type: 'family' }]));
    groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
    renderApp('/home');
    const groups = (await screen.findByRole('heading', { name: 'Your groups' })).closest('section');
    expect(within(groups).getByRole('link', { name: /Family/ })).toHaveAttribute('href', '/groups/3');
    expect(within(groups).getByText('Family', { selector: '.pill' })).toBeInTheDocument();
  });
});

describe('Pending invites on Groups', () => {
  it('shows the invitations above the group cards, with the title visible', async () => {
    localStorage.setItem('groups:1', JSON.stringify([{ id: 3, name: 'Family', type: 'family' }]));
    renderApp('/groups');
    const title = await screen.findByRole('heading', { name: 'Pending invites' });
    expect(title).not.toHaveClass('visually-hidden');
    const cards = screen.getByRole('list', { name: 'Your groups' });
    expect(title.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(cards).getByRole('link', { name: /Family/ })).toHaveAttribute('href', '/groups/3');
  });

  it('accepting adds a card for the group without loading the page again', async () => {
    groupsApi.acceptInvitation.mockResolvedValue(ok({ message: 'Invitation accepted.' }));
    const user = userEvent.setup();
    renderApp('/groups');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Lake House' }));
    const cards = await screen.findByRole('list', { name: 'Your groups' });
    expect(within(cards).getByRole('link', { name: /Lake House/ })).toHaveAttribute('href', '/groups/7');
    expect(screen.getByText('You joined Lake House.')).toBeInTheDocument();
    expect(groupsApi.getPendingInvitations).toHaveBeenCalledTimes(1);
  });
});

describe('Pending invites heading on Home', () => {
  it('keeps the heading for screen readers only', async () => {
    renderApp('/home');
    expect(await screen.findByRole('heading', { name: 'Pending invites' })).toHaveClass('visually-hidden');
  });
});
