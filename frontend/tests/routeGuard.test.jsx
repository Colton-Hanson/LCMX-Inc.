// Tests for the route guard: pages that need a login send guests and expired sessions to the login page.
// The API module is mocked, so no backend is needed. Run with: npm test

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../src/App.jsx';
import * as api from '../src/api/auth.js';

vi.mock('../src/api/auth.js');

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

const profile = { id: 1, name: 'Cole Hanson', email: 'cole@umkc.edu', pending_email: null };
const signedIn = { ok: true, status: 200, data: profile };
const guest = { ok: false, status: 401, data: { detail: 'Authentication required.' } };

beforeEach(() => vi.resetAllMocks());

describe('Route guard', () => {
  it.each(['/home', '/settings'])('sends a guest who opens %s to the login page with a message', async (path) => {
    api.getProfile.mockResolvedValue(guest);
    renderAt(path);
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('Log in to continue.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Home Page' })).toBeNull();
  });

  it('never shows the protected page while the session check is running', () => {
    api.getProfile.mockReturnValue(new Promise(() => {}));
    renderAt('/settings');
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('lets a signed-in user in and keeps one session check while moving between pages', async () => {
    api.getProfile.mockResolvedValue(signedIn);
    const user = userEvent.setup();
    renderAt('/settings');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Home' }));
    expect(await screen.findByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
    expect(api.getProfile).toHaveBeenCalledTimes(1);
  });

  it('sends the user to login when the session has ended by the time they return to the tab', async () => {
    api.getProfile.mockResolvedValueOnce(signedIn).mockResolvedValue(guest);
    renderAt('/home');
    await screen.findByRole('heading', { name: 'Home Page' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('Your session ended. Log in to continue.')).toBeInTheDocument();
  });

  it('keeps the user on the page if the recheck cannot reach the server', async () => {
    api.getProfile.mockResolvedValueOnce(signedIn).mockResolvedValue({ ok: false, status: 0, network: true });
    renderAt('/home');
    await screen.findByRole('heading', { name: 'Home Page' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
  });

  it('sends unknown addresses to the login page', async () => {
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});
