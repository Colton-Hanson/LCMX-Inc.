// Tests for the home page: session check, top bar, account menu and log out.
// The API module is mocked, so no backend is needed. Run with: npm test

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import HomePage from '../src/pages/HomePage.jsx';
import RequireAuth from '../src/components/RequireAuth.jsx';
import * as api from '../src/api/auth.js';

vi.mock('../src/api/auth.js');

// Renders Home inside a small router. "/login" shows plain text so a test can confirm a redirect.
function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route path="/login" element={<h1>LOGIN PAGE</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

const loggedIn = { ok: true, status: 200, data: { id: 1, name: 'Cole Hanson', email: 'cole@umkc.edu' } };

beforeEach(() => vi.resetAllMocks());

describe('Home page', () => {
  it('shows the page heading and the signed-in top bar once the session is confirmed', async () => {
    api.getProfile.mockResolvedValue(loggedIn);
    renderHome();
    expect(await screen.findByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Account menu/ })).toBeInTheDocument();
  });

  it('keeps the signed-in top bar layout while the page is still loading', () => {
    api.getProfile.mockReturnValue(new Promise(() => {})); // never answers, so the page stays in its loading state
    const { container } = renderHome();
    expect(container.querySelector('.app-header--signed-in')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
  });

  it('shows the app name and logo link in the top bar', async () => {
    api.getProfile.mockResolvedValue(loggedIn);
    renderHome();
    await screen.findByRole('heading', { name: 'Home Page' });
    expect(screen.getByRole('link', { name: /Shared Expense Management Tool/ })).toHaveAttribute('href', '/home');
  });

  it('opens the account menu with the signed-in email and closes it with Escape', async () => {
    api.getProfile.mockResolvedValue(loggedIn);
    const user = userEvent.setup();
    renderHome();
    const button = await screen.findByRole('button', { name: /Account menu/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('cole@umkc.edu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    expect(button).toHaveFocus();
  });

  it('closes the account menu when the user presses outside it', async () => {
    api.getProfile.mockResolvedValue(loggedIn);
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    await user.click(screen.getByRole('heading', { name: 'Home Page' }));
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('logs out and returns to the login page', async () => {
    api.getProfile.mockResolvedValue(loggedIn);
    api.logoutUser.mockResolvedValue({ ok: true, status: 200 });
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument());
    expect(api.logoutUser).toHaveBeenCalledTimes(1);
  });

  it('stays on the page and shows an error if the log out request fails', async () => {
    api.getProfile.mockResolvedValue(loggedIn);
    api.logoutUser.mockResolvedValue({ ok: false, status: 0, network: true });
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText(/couldn’t log you out/i)).toBeInTheDocument();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Home Page' })).toBeInTheDocument();
  });

  it('redirects guests to the login page (401)', async () => {
    api.getProfile.mockResolvedValue({ ok: false, status: 401, data: { detail: 'Authentication required.' } });
    renderHome();
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Home Page' })).toBeNull();
  });

  it('shows an error instead of the page when the backend cannot be reached', async () => {
    api.getProfile.mockResolvedValue({ ok: false, status: 0, network: true });
    renderHome();
    expect(await screen.findByText(/couldn’t reach the server/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Home Page' })).toBeNull();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
  });
});
