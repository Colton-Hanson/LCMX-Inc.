// Tests for the browser tab titles (each page has its own) and the account button's name.
// The API module is mocked, so no backend is needed. Run with: npm test

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../src/App.jsx';
import * as api from '../src/api/auth.js';
import * as groupsApi from '../src/api/groups.js';

vi.mock('../src/api/auth.js');
import { mockGroups } from './helpers.jsx';
vi.mock('../src/api/groups.js');

const profile = { id: 1, name: 'Sam Rivera', email: 'sam@umkc.edu', pending_email: null };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGroups(groupsApi, []);
  localStorage.clear();
  groupsApi.getPendingInvitations.mockResolvedValue({ ok: true, status: 200, data: [] });
  groupsApi.getMembers.mockResolvedValue({ ok: true, status: 200, data: [{ user_id: 1, email: 'sam@umkc.edu', is_admin: true }] });
  groupsApi.getMyGroups.mockResolvedValue({ ok: true, status: 200, data: [] });
  groupsApi.getGroupEvents.mockResolvedValue({ ok: true, status: 200, data: [] });
});

describe('Page titles', () => {
  it.each([
    ['/login', 'Log in', false],
    ['/register', 'Create your account', false],
    ['/home', 'Home', true],
    ['/settings', 'Settings', true],
    ['/groups', 'Groups', true],
    ['/groups/new', 'Create group', true],
    ['/groups/3', 'Group', true],
    ['/groups/3/settings', 'Group settings', true],
    ['/groups/3/events/new', 'New event', true],
  ])('%s sets the tab title', async (path, title, signedIn) => {
    api.getProfile.mockResolvedValue(
      signedIn ? { ok: true, status: 200, data: profile } : { ok: false, status: 401, data: {} }
    );
    renderAt(path);
    await screen.findByRole('heading', { level: 1 });
    // Wait for the title itself: a heading can show up a moment before the page sets its title (this made the test flaky).
    await waitFor(() => expect(document.title).toBe(`${title} - Shared Expense Management Tool`));
  });
});

describe('Account button', () => {
  it('includes the visible initials in its accessible name', async () => {
    api.getProfile.mockResolvedValue({ ok: true, status: 200, data: profile });
    renderAt('/home');
    expect(await screen.findByRole('button', { name: 'SR Account menu' })).toBeInTheDocument();
  });
});
