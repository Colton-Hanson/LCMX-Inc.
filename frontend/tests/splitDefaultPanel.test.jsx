// Tests for the Default split card on Group settings. The API modules are mocked, so no backend is needed. Run with: npm test

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';
import { renderApp, me, ok } from './helpers.jsx';

vi.mock('../src/api/auth.js');
vi.mock('../src/api/groups.js');

const group = { id: 5, name: 'Lake House', type: 'outing' };
const members = [
  { user_id: 1, email: 'cole@umkc.edu', is_admin: false },
  { user_id: 2, email: 'maya@example.com', is_admin: true },
  { user_id: 3, email: 'devin@example.com', is_admin: false },
];

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.getProfile.mockResolvedValue(ok(me));
  groupsApi.getPendingInvitations.mockResolvedValue(ok([]));
  groupsApi.getMembers.mockResolvedValue(ok(members));
});

async function openPanel() {
  renderApp('/groups/5/settings', { group });
  const heading = await screen.findByRole('heading', { name: 'Default split' });
  return heading.closest('section');
}
const saved = () => JSON.parse(localStorage.getItem('splitDefault:5'));

describe('Default split card', () => {
  it('starts on even and lets any member save it', async () => {
    const panel = await openPanel(); // cole is a plain member here, not the admin
    expect(within(panel).getByRole('button', { name: 'Even' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).queryByRole('list')).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Save default split' })).toBeEnabled();
  });

  it('saves percentages that add up to 100 and stores them in basis points', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Percentage' }));
    expect(within(panel).getByLabelText('Default percentage for cole@umkc.edu')).toHaveValue('33.34');
    for (const [email, value] of [['cole@umkc.edu', '50'], ['maya@example.com', '30'], ['devin@example.com', '20']]) {
      const box = within(panel).getByLabelText(`Default percentage for ${email}`);
      await user.clear(box);
      await user.type(box, value);
    }
    expect(within(panel).getByText('100.00% of 100%')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByText('Default split saved: percentages.')).toBeInTheDocument();
    expect(saved()).toEqual({ method: 'percentage', percents: { 1: 5000, 2: 3000, 3: 2000 } });
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
    expect(localStorage.getItem('splitDefault:5')).toBeNull();
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

  it('shows the saved percentages next time and goes back to even when saved as even', async () => {
    localStorage.setItem('splitDefault:5', JSON.stringify({ method: 'percentage', percents: { 1: 7000, 2: 2000, 3: 1000 } }));
    const user = userEvent.setup();
    const panel = await openPanel();
    expect(within(panel).getByRole('button', { name: 'Percentage' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByLabelText('Default percentage for cole@umkc.edu')).toHaveValue('70.00');

    await user.click(within(panel).getByRole('button', { name: 'Even' }));
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByText('Default split saved: even.')).toBeInTheDocument();
    expect(saved()).toEqual({ method: 'even', percents: {} });
  });

  it('says so when the browser will not store the default', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await user.click(within(panel).getByRole('button', { name: 'Save default split' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('We couldn’t save the default split in this browser.');
    spy.mockRestore();
  });
});
