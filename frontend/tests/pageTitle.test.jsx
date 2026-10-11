// Tests for the browser tab titles (each page has its own) and the account button's name.
// The API module is mocked, so no backend is needed. Run with: npm test

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../src/App.jsx';
import * as api from '../src/api/auth.js';

vi.mock('../src/api/auth.js');

const profile = { id: 1, name: 'Cole Hanson', email: 'cole@umkc.edu', pending_email: null };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('Page titles', () => {
  it.each([
    ['/login', 'Log in', false],
    ['/register', 'Create your account', false],
    ['/home', 'Home', true],
    ['/settings', 'Settings', true],
  ])('%s sets the tab title', async (path, title, signedIn) => {
    api.getProfile.mockResolvedValue(
      signedIn ? { ok: true, status: 200, data: profile } : { ok: false, status: 401, data: {} }
    );
    renderAt(path);
    await screen.findByRole('heading', { level: 1 });
    expect(document.title).toBe(`${title} – Shared Expense Management Tool`);
  });
});

describe('Account button', () => {
  it('includes the visible initials in its accessible name', async () => {
    api.getProfile.mockResolvedValue({ ok: true, status: 200, data: profile });
    renderAt('/home');
    expect(await screen.findByRole('button', { name: 'CH Account menu' })).toBeInTheDocument();
  });
});
