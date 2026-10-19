// Small helpers shared by the group tests (this file contains no tests itself).
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// Renders the whole app at a path, so links and redirects work like in the browser.
export function renderApp(path = '/home', state) {
  return render(
    <MemoryRouter initialEntries={[state ? { pathname: path, state } : path]}>
      <App />
    </MemoryRouter>
  );
}

export const me = { id: 1, name: 'Cole Hanson', email: 'cole@umkc.edu', pending_email: null };
export const ok = (data, status = 200) => ({ ok: true, status, data });
export const fail = (status, data = {}) => ({ ok: false, status, data });
export const network = { ok: false, status: 0, network: true };

// Waits for an alert message that contains the given text (a string) or matches the given pattern. The forms also
// have empty alert slots that stay silent until an error appears, so a plain "find the alert" would match those.
export function findAlert(expected) {
  const matches = (text) => (expected instanceof RegExp ? expected.test(text) : text.includes(expected));
  return waitFor(() => {
    const hit = screen.queryAllByRole('alert').find((el) => matches(el.textContent));
    if (!hit) throw new Error(`No alert with the text ${expected}`);
    return hit;
  });
}
