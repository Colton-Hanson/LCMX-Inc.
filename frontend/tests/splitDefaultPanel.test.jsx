// Tests for the Default split card on Group settings. The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import { renderApp, me, ok, fail, network, mockGroups } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');

const group = { id: 5, name: 'Lake House', type: 'outing' };
const members = [
  { user_id: 1, email: 'sam@umkc.edu', is_admin: false },
  { user_id: 2, email: 'maya@example.com', is_admin: true },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockGroups(groupsApi, [group]); // the server's default split starts as even
  groupsApi.saveSplitDefault.mockImplementation((id, value) => Promise.resolve(ok(value)));
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
});

async function openPanel() {
  renderApp('/groups/5/settings', { group });
  await screen.findByRole('button', { name: 'Save default split' }); // the default has loaded from the server
  return screen.getByRole('heading', { name: 'Default split' }).closest('section');
}
// What the server says the group's default is.
const serverDefault = (value) => groupsApi.getSplitDefault.mockResolvedValue(ok(value));

describe('Default split card', () => {
  it('starts on even and lets any member save it', async () => {
    const panel = await openPanel(); // sam is a plain member here, not the admin
    expect(within(panel).getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).queryByRole('list')).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Save default split' })).toBeEnabled();
    expect(groupsApi.getSplitDefault).toHaveBeenCalledWith(5);
  });

  it('saves percentages that add up to 100 as a PUT in basis points', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Percentage' }));
    expect(within(panel).getByLabelText('Default percentage for sam@umkc.edu')).toHaveValue('33.34');
    for (const [email, value] of [['sam@umkc.edu', '50'], ['maya@example.com', '30'], ['devin@example.com', '20']]) {
      const box = within(panel).getByLabelText(`Default percentage for ${email}`);
      await user.clear(box);
      await user.type(box, value);
    }
    expect(within(panel).getByText('100.00% of 100%')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByText('Default split saved: percentages.')).toBeInTheDocument();
    expect(groupsApi.saveSplitDefault).toHaveBeenCalledTimes(1);
    expect(groupsApi.saveSplitDefault).toHaveBeenCalledWith(5, { method: 'percentage', percents: { 1: 5000, 2: 3000, 3: 2000 } });
  });

  it('blocks saving when the percentages do not add up and says how much is left', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Percentage' }));
    const devin = within(panel).getByLabelText('Default percentage for devin@example.com');
    await user.clear(devin);
    await user.type(devin, '20');
    expect(within(panel).getByText('13.33% left to assign.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Can’t save yet. 13.33% left to assign.');
    expect(groupsApi.saveSplitDefault).not.toHaveBeenCalled();
  });

  it('shows an error under a percentage that is not a number', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Percentage' }));
    const maya = within(panel).getByLabelText('Default percentage for maya@example.com');
    await user.clear(maya);
    await user.type(maya, 'abc');
    expect(maya).toHaveAttribute('aria-invalid', 'true');
    expect(within(panel).getByText('Enter a number from 0 to 100.')).toBeInTheDocument();
  });

  it('shows the percentages the server has and goes back to even when saved as even', async () => {
    serverDefault({ method: 'percentage', percents: { 1: 7000, 2: 2000, 3: 1000 } });
    const user = userEvent.setup();
    const panel = await openPanel();
    expect(within(panel).getByRole('button', { name: 'Percentage' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByLabelText('Default percentage for sam@umkc.edu')).toHaveValue('70.00');

    await user.click(within(panel).getByRole('button', { name: 'Even' }));
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByText('Default split saved: even.')).toBeInTheDocument();
    expect(groupsApi.saveSplitDefault).toHaveBeenCalledWith(5, { method: 'even', percents: {} });
  });

  it('shows the sentence the server sends when it says no to the save', async () => {
    groupsApi.saveSplitDefault.mockResolvedValue(fail(422, { detail: 'Split percentages must total 100%.' }));
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Split percentages must total 100%.');
    expect(within(panel).queryByText(/Default split saved/)).toBeNull();
  });

  it('says it could not reach the server when the save has no connection', async () => {
    groupsApi.saveSplitDefault.mockResolvedValue(network);
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('We couldn’t reach the server.');
  });

  it('sends the user to log in when the session ended during the save', async () => {
    groupsApi.saveSplitDefault.mockResolvedValue(fail(401));
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('offers Try again when the default cannot be loaded', async () => {
    groupsApi.getSplitDefault
      .mockResolvedValueOnce(fail(409, { detail: 'Saved split default is inconsistent.' }))
      .mockResolvedValue(ok({ method: 'percentage', percents: { 1: 5000, 2: 3000, 3: 2000 } }));
    const user = userEvent.setup();
    renderApp('/groups/5/settings', { group });
    const heading = await screen.findByRole('heading', { name: 'Default split' });
    const panel = heading.closest('section');
    expect(await within(panel).findByRole('alert')).toHaveTextContent('We couldn’t load the default split.');
    expect(within(panel).queryByRole('button', { name: 'Save default split' })).toBeNull(); // nothing to save over a default that did not load
    await user.click(within(panel).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Default percentage for sam@umkc.edu')).toHaveValue('50.00'); // the panel was replaced, so look on the whole screen
  });
});
