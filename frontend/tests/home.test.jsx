// home.test.jsx — tests for the temporary landing page (/home): its login check, message and LOG OUT button.
// Like forms.test.jsx, the backend is FAKED (mocked) so no server is needed. Run with: npm test

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import HomePage from '../src/pages/HomePage.jsx';
import * as api from '../src/api/auth.js';

vi.mock('../src/api/auth.js'); // replace the real auth.js with do-nothing fakes

const MESSAGE = 'YOU HAVE SUCCESSFULLY LOGGED IN!';

// Draw Home inside a tiny router. "/login" just shows the words LOGIN PAGE so a test can confirm a redirect happened.
function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<h1>LOGIN PAGE</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

// A fake "logged in" answer from GET /auth/me.
const loggedIn = { ok: true, status: 200, data: { id: 1, email: 'cole@umkc.edu' } };

beforeEach(() => vi.resetAllMocks()); // wipe the fakes so one test can't affect the next

describe('Temporary landing page', () => {
  it('shows the success message and a LOG OUT button once the backend confirms a valid login', async () => {
    api.getCurrentUser.mockResolvedValue(loggedIn);
    renderHome();
    expect(await screen.findByRole('heading', { name: MESSAGE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOG OUT' })).toBeInTheDocument();
  });

  it('is otherwise blank: the only control is the LOG OUT button', async () => {
    api.getCurrentUser.mockResolvedValue(loggedIn);
    renderHome();
    await screen.findByText(MESSAGE);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('puts the message and the button in the centered landing block', async () => {
    api.getCurrentUser.mockResolvedValue(loggedIn);
    renderHome();
    const heading = await screen.findByRole('heading', { name: MESSAGE });
    const button = screen.getByRole('button', { name: 'LOG OUT' });
    expect(heading.parentElement).toHaveClass('landing'); // .landing is centered in styles.css
    expect(button.parentElement).toBe(heading.parentElement); // same block: message above, button below
  });

  it('logs out and returns to the login page', async () => {
    api.getCurrentUser.mockResolvedValue(loggedIn);
    api.logoutUser.mockResolvedValue({ ok: true, status: 200 });
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'LOG OUT' }));
    await waitFor(() => expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument());
    expect(api.logoutUser).toHaveBeenCalledTimes(1);
  });

  it('stays put and says so if the log out request fails', async () => {
    api.getCurrentUser.mockResolvedValue(loggedIn);
    api.logoutUser.mockResolvedValue({ ok: false, status: 0, network: true });
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'LOG OUT' }));
    expect(await screen.findByText(/couldn’t log you out/i)).toBeInTheDocument();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull(); // must NOT pretend they're logged out
    expect(screen.getByText(MESSAGE)).toBeInTheDocument(); // still on the landing page
  });

  it('never shows the success message to guests: 401 goes to the login page', async () => {
    api.getCurrentUser.mockResolvedValue({ ok: false, status: 401, data: { detail: 'Authentication required.' } });
    renderHome();
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('does not claim success when the backend cannot be reached', async () => {
    api.getCurrentUser.mockResolvedValue({ ok: false, status: 0, network: true });
    renderHome();
    expect(await screen.findByText(/couldn’t reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).toBeNull();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
  });
});
