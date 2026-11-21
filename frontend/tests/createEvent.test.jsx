// Tests for the Create event screen (SCRUM-70).
// The API modules are mocked, so no backend is needed. Run with: npm test

import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import * as expensesApi from '../src/api/expenses.js';
import App from '../src/App.jsx';
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

beforeEach(() => {
  vi.resetAllMocks();
  mockGroups(groupsApi, []);
  localStorage.clear();
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
  groupsApi.getGroupEvents.mockResolvedValue(ok([]));
  expensesApi.getGroupExpenses.mockResolvedValue(ok([]));
});

const createButton = () => screen.getByRole('button', { name: 'Create event' });

async function openPage() {
  renderApp('/groups/5/events/new', { group });
  await screen.findByRole('heading', { name: 'New event', level: 1 });
  await screen.findByText(/Everyone in the group is in this event \(3 members\)/);
}

describe('Create event screen', () => {
  it('starts with All members selected and the button on', async () => {
    await openPage();
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pick members' })).toHaveAttribute('aria-pressed', 'false');
    expect(createButton()).toBeEnabled();
    expect(screen.getByRole('link', { name: '← Lake House' })).toHaveAttribute('href', '/groups/5');
  });

  it('sends everyone in the group when All members is chosen', async () => {
    groupsApi.createEvent.mockResolvedValue(ok({ id: 1, group_id: 5, name: 'Housewarming', member_ids: [1, 2, 3] }, 201));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Housewarming');
    await user.click(createButton());
    expect(groupsApi.createEvent).toHaveBeenCalledWith({ name: 'Housewarming', groupId: 5, memberIds: [1, 2, 3] });
    // Lands back on the group page with a confirmation.
    expect(await screen.findByRole('heading', { name: 'Lake House', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Event “Housewarming” created for 3 members.')).toBeInTheDocument();
  });

  it('turns the button off and explains why when Pick members has nobody selected', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole('button', { name: 'Pick members' }));
    expect(createButton()).toBeDisabled();
    await findAlert('Pick at least one member to create this event.');

    await user.click(screen.getByRole('button', { name: /Maya/ }));
    expect(createButton()).toBeEnabled();
    expect(screen.queryByText('Pick at least one member to create this event.')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Maya/ })); // unselect again
    expect(createButton()).toBeDisabled();
  });

  it('sends only the picked members', async () => {
    groupsApi.createEvent.mockResolvedValue(ok({ id: 2, group_id: 5, name: 'Camping', member_ids: [1, 3] }, 201));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Camping');
    await user.click(screen.getByRole('button', { name: 'Pick members' }));
    const list = screen.getByRole('list', { name: 'Members' });
    await user.click(within(list).getByRole('button', { name: /Sam/ }));
    await user.click(within(list).getByRole('button', { name: /Devin/ }));
    expect(within(list).getByRole('button', { name: /Sam/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(createButton());
    expect(groupsApi.createEvent).toHaveBeenCalledWith({ name: 'Camping', groupId: 5, memberIds: [1, 3] });
  });

  it('lists the new event on the group page from the server, with who is in it', async () => {
    groupsApi.createEvent.mockResolvedValue(ok({ id: 2, group_id: 5, name: 'Camping', member_ids: [1, 3] }, 201));
    groupsApi.getGroupEvents.mockResolvedValue(ok([{ id: 2, group_id: 5, name: 'Camping', member_ids: [1, 3] }]));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Camping');
    await user.click(screen.getByRole('button', { name: 'Pick members' }));
    await user.click(screen.getByRole('button', { name: /Sam/ }));
    await user.click(screen.getByRole('button', { name: /Devin/ }));
    await user.click(createButton());
    expect(await screen.findByText('Event “Camping” created for 2 members.')).toBeInTheDocument();
    const events = screen.getByRole('region', { name: 'Events' });
    expect(await within(events).findByText('Camping')).toBeInTheDocument();
    expect(within(events).getByText('Split between 2 people')).toBeInTheDocument(); // the caret line, like the expenses
    expect(groupsApi.getGroupEvents).toHaveBeenCalledWith(5);
  });

  it('lists an all-members event as "All members" and still shows it after a reload', async () => {
    groupsApi.createEvent.mockResolvedValue(ok({ id: 3, group_id: 5, name: 'Housewarming', member_ids: [1, 2, 3] }, 201));
    groupsApi.getGroupEvents.mockResolvedValue(ok([{ id: 3, group_id: 5, name: 'Housewarming', member_ids: [1, 2, 3] }]));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Housewarming');
    await user.click(createButton());
    await screen.findByText('Event “Housewarming” created for 3 members.');
    expect(await within(screen.getByRole('region', { name: 'Events' })).findByText('Split between 3 people')).toBeInTheDocument(); // everyone in the group

    document.body.innerHTML = '';
    renderApp('/groups/5');
    const events = await screen.findByRole('region', { name: 'Events' });
    expect(within(events).getByText('Housewarming')).toBeInTheDocument();
  });

  it('shows who is in each event and the expenses that belong to it', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([{ id: 7, group_id: 5, name: 'Lake Cabin', member_ids: [2, 3] }]));
    expensesApi.getGroupExpenses.mockResolvedValue(ok([
      { id: 1, group_id: 5, description: 'Firewood', amount: '20.00', paid_by: 2, event_id: 7, created_at: '2026-11-19T12:00:00', shares: { 2: '10.00', 3: '10.00' } },
      { id: 2, group_id: 5, description: 'Rent', amount: '900.00', paid_by: 1, event_id: null, created_at: '2026-11-18T12:00:00', shares: { 1: '450.00', 2: '450.00' } },
    ]));
    renderApp('/groups/5');
    const events = await screen.findByRole('region', { name: 'Events' });
    const people = within(await within(events).findByRole('list', { name: 'Members in Lake Cabin' })); // the members, by short name
    expect(people.getByText('Maya')).toBeInTheDocument();
    expect(people.getByText('Devin')).toBeInTheDocument();
    expect(people.queryByText('Sam')).not.toBeInTheDocument(); // not in this event
    const list = within(events).getByRole('list', { name: 'Expenses in Lake Cabin' });
    expect(within(list).getByText('Firewood')).toBeInTheDocument();
    expect(within(list).getByText('$20.00')).toBeInTheDocument();
    expect(within(list).queryByText('Rent')).not.toBeInTheDocument(); // an expense with no event stays out
    // each person's share of the event's expenses sits at the right of their name
    const shares = within(await within(events).findByRole('list', { name: 'Members in Lake Cabin' }));
    expect(shares.getAllByText('$10.00')).toHaveLength(2); // Maya and Devin: $10.00 of the $20.00 Firewood each
  });

  it('lists someone on an event expense who is not in the event, and who paid, so the shares add up', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([{ id: 7, group_id: 5, name: 'Lake Cabin', member_ids: [2, 3] }]));
    expensesApi.getGroupExpenses.mockResolvedValue(ok([
      { id: 1, group_id: 5, description: 'Groceries', amount: '17.00', paid_by: 2, event_id: 7, created_at: '2026-11-19T12:00:00', shares: { 1: '4.00', 2: '5.00', 3: '8.00' } },
    ]));
    renderApp('/groups/5');
    const events = within(await screen.findByRole('region', { name: 'Events' }));
    const people = within(await events.findByRole('list', { name: 'Members in Lake Cabin' }));
    expect(events.getByText('Split between 3 people')).toBeInTheDocument(); // counts everyone who has a share
    expect(people.getByText('$4.00')).toBeInTheDocument(); // Sam: not in the event, but has a share
    expect(people.getByText(/not in this event/)).toBeInTheDocument();
    expect(people.getAllByText(/not in this event/)).toHaveLength(1); // only Sam
    expect(events.getByText(/Maya paid/)).toBeInTheDocument();
  });

  it('has Expand all / Collapse all on the Recent expenses card and on the Events card', async () => {
    const user = userEvent.setup();
    groupsApi.getGroupEvents.mockResolvedValue(ok([
      { id: 7, group_id: 5, name: 'Lake Cabin', member_ids: [2, 3] },
      { id: 8, group_id: 5, name: 'Picnic', member_ids: [1, 2] },
    ]));
    expensesApi.getGroupExpenses.mockResolvedValue(ok([
      { id: 1, group_id: 5, description: 'Firewood', amount: '20.00', paid_by: 2, event_id: 7, created_at: '2026-11-19T12:00:00', shares: { 2: '10.00', 3: '10.00' } },
      { id: 2, group_id: 5, description: 'Rent', amount: '900.00', paid_by: 1, event_id: null, created_at: '2026-11-18T12:00:00', shares: { 1: '450.00', 2: '450.00' } },
    ]));
    renderApp('/groups/5');
    const events = within(await screen.findByRole('region', { name: 'Events' }));
    const recent = within(await screen.findByRole('region', { name: 'Recent expenses' }));
    await recent.findByText('Firewood');
    const isOpen = (scope) => [...scope.getAllByText(/^Split between/)].map((s) => s.closest('details').open);

    expect(isOpen(events)).toEqual([false, false]);
    await user.click(events.getByRole('button', { name: 'Expand all' }));
    expect(isOpen(events)).toEqual([true, true]);
    expect(isOpen(recent)).toEqual([false, false]); // the other card is not affected
    await user.click(events.getByRole('button', { name: 'Collapse all' }));
    expect(isOpen(events)).toEqual([false, false]);

    await user.click(recent.getByRole('button', { name: 'Expand all' }));
    expect(isOpen(recent)).toEqual([true, true]);
    await user.click(recent.getByRole('button', { name: 'Collapse all' }));
    expect(isOpen(recent)).toEqual([false, false]);
  });

  it('says so when an event has no expenses yet', async () => {
    groupsApi.getGroupEvents.mockResolvedValue(ok([{ id: 7, group_id: 5, name: 'Lake Cabin', member_ids: [2, 3] }]));
    expensesApi.getGroupExpenses.mockResolvedValue(ok([]));
    renderApp('/groups/5');
    const events = await screen.findByRole('region', { name: 'Events' });
    expect(await within(events).findByText('No expenses yet')).toBeInTheDocument();
  });

  it('shows the confirmation message once: the router state is cleared so a refresh does not repeat it', async () => {
    let seen;
    function Probe() {
      seen = useLocation().state;
      return null;
    }
    render(
      <MemoryRouter initialEntries={[{ pathname: '/groups/5', state: { group, notices: [{ kind: 'ok', text: 'Invite sent to maya@example.com. They show as pending until they accept.' }] } }]}>
        <App />
        <Probe />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Invite sent to maya@example.com/)).toBeInTheDocument();
    await waitFor(() => expect(seen.notices).toBeUndefined());
    expect(seen.group).toEqual(group); // the group still travels with the page
    expect(screen.getByText(/Invite sent to maya@example.com/)).toBeInTheDocument(); // still shown for this visit
  });

  it('asks for a name and sends nothing when it is empty', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(createButton());
    expect(await screen.findByText('Enter an event name.')).toBeInTheDocument();
    expect(screen.getByLabelText('Event name')).toHaveFocus();
    expect(groupsApi.createEvent).not.toHaveBeenCalled();
  });

  it('shows the server message when the event is rejected', async () => {
    groupsApi.createEvent.mockResolvedValue(fail(422, { detail: 'All event participants must be accepted group members.' }));
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Trip');
    await user.click(createButton());
    await findAlert('All event participants must be accepted group members.');
    expect(createButton()).toBeEnabled();
  });

  it('shows a connection error without losing what was typed', async () => {
    groupsApi.createEvent.mockResolvedValue(network);
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Trip');
    await user.click(createButton());
    await findAlert(/couldn’t reach the server/i);
    expect(screen.getByLabelText('Event name')).toHaveValue('Trip');
  });

  it('Cancel discards the form and goes back to the group', async () => {
    const user = userEvent.setup();
    await openPage();
    await user.type(screen.getByLabelText('Event name'), 'Never saved');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Lake House', level: 1 })).toBeInTheDocument();
    expect(groupsApi.createEvent).not.toHaveBeenCalled();
  });

  it('keeps the button off while the members are still loading', async () => {
    groupsApi.getMembers.mockReturnValue(new Promise(() => {}));
    renderApp('/groups/5/events/new', { group });
    await screen.findByRole('heading', { name: 'New event', level: 1 });
    expect(createButton()).toBeDisabled();
    expect(screen.getByText('Loading members…')).toBeInTheDocument();
  });

  it('offers Try again when the members cannot be loaded', async () => {
    groupsApi.getMembers.mockResolvedValueOnce(network).mockResolvedValue(ok(members));
    const user = userEvent.setup();
    renderApp('/groups/5/events/new', { group });
    expect(await screen.findByText(/couldn’t load the members/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Everyone in the group is in this event/)).toBeInTheDocument();
  });

  it('says so when the user is not a member of the group', async () => {
    groupsApi.getMembers.mockResolvedValue(fail(403, { detail: 'You are not an accepted member of this group.' }));
    renderApp('/groups/5/events/new', { group });
    await findAlert(/can’t add an event to this group/i);
  });
});
