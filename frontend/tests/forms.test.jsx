// forms.test.jsx — automated tests that "use" the Register and Login pages like a person would:
// type into boxes, click buttons, and check what appears. The server is FAKED (mocked), so these
// tests run without any backend. Run with: npm test

import { render, screen, waitFor } from '@testing-library/react'; // render a component; screen finds things on it
import userEvent from '@testing-library/user-event';              // simulates real typing and clicking
import { MemoryRouter, Routes, Route } from 'react-router-dom';   // a fake in-memory router (no real browser URL needed)
import { vi } from 'vitest';                                      // vi = Vitest's toolbox for fakes ("mocks")
import RegisterPage from '../src/pages/RegisterPage.jsx';
import LoginPage from '../src/pages/LoginPage.jsx';
import * as api from '../src/api/auth.js';

// Replace the real auth.js with fakes. Each fake does nothing until a test tells it what to "return".
// This is exactly the spot that stands in for Lukas's backend during testing.
vi.mock('../src/api/auth.js');

// Helper: draw the pages inside a tiny router starting at `path`. "/home" just shows the word HOME,
// so a test can confirm a redirect happened by looking for that text.
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<h1>HOME</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

// Before every test, wipe the fakes so one test can't affect the next.
beforeEach(() => vi.resetAllMocks());

describe('Registration (SCRUM-11)', () => {
  it('masks passwords and shows the rules', () => {
    renderAt('/register');
    // type="password" is what turns typed characters into dots
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument(); // rules are visible before typing
  });

  it('shows an email error on blur', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'nope'); // type an invalid email
    await user.tab();                                         // press Tab to leave the box (this is the "blur")
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it('confirms when passwords match and blocks when they do not', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg?'); // deliberately different
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getAllByText(/don’t match/i).length).toBeGreaterThan(0); // mismatch error is shown
    expect(api.registerUser).not.toHaveBeenCalled();                        // and the server was NOT called

    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg!'); // now make it match
    expect(await screen.findByText(/Passwords match/)).toBeInTheDocument();
  });

  it('submits valid data, logs in automatically, and goes home', async () => {
    api.registerUser.mockResolvedValue({ ok: true, status: 201 }); // fake server says "account created"
    api.loginUser.mockResolvedValue({ ok: true, status: 200 });    // ...and the automatic login after it works
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument()); // redirected home
    // The server received the email and password (and NOT the confirm field):
    expect(api.registerUser).toHaveBeenCalledWith({ email: 'cole@umkc.edu', password: 'Abcdefg!' });
    // Lukas's register endpoint doesn't start a session, so the form logs in right after registering:
    expect(api.loginUser).toHaveBeenCalledWith({ email: 'cole@umkc.edu', password: 'Abcdefg!' });
  });

  it('sends the user to the login page with a note if the automatic login fails', async () => {
    api.registerUser.mockResolvedValue({ ok: true, status: 201 });
    api.loginUser.mockResolvedValue({ ok: false, status: 503 }); // account created, but login hiccuped
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    // We land on the Log in page (not an error screen) and it explains what happened:
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText(/Your account was created/i)).toBeInTheDocument();
  });

  it('does not try to log in when registration itself fails', async () => {
    api.registerUser.mockResolvedValue({ ok: false, status: 409 });
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/may already exist/i)).toBeInTheDocument(); // 409 = duplicate email
    expect(api.loginUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled(); // they can fix it and retry
  });

  it('shows a generic failure when the server rejects the data (422)', async () => {
    api.registerUser.mockResolvedValue({ ok: false, status: 422 });
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/couldn’t create your account/i)).toBeInTheDocument();
  });
});

describe('Login (SCRUM-12)', () => {
  it('shows a generic failure for any rejected login', async () => {
    api.loginUser.mockResolvedValue({ ok: false, status: 401 }); // fake server says "rejected"
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/combination didn’t work/i)).toBeInTheDocument();
    // The message must NOT reveal whether the account exists or which part was wrong:
    expect(screen.queryByText(/no account|not found|incorrect password/i)).toBeNull();
  });

  it('redirects home on success', async () => {
    api.loginUser.mockResolvedValue({ ok: true, status: 200 }); // fake server says "logged in"
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument());
  });

  it('asks for both fields when empty', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('button', { name: /log in/i })); // click with nothing typed
    expect(await screen.findByText(/Enter your email and password/)).toBeInTheDocument();
    expect(api.loginUser).not.toHaveBeenCalled(); // server never contacted
  });

  it('shows a network message separately from bad credentials', async () => {
    api.loginUser.mockResolvedValue({ ok: false, status: 0, network: true }); // fake "couldn't reach server"
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/couldn’t reach the server/i)).toBeInTheDocument();
  });

  it('does not blame the credentials when the server errors (5xx)', async () => {
    api.loginUser.mockResolvedValue({ ok: false, status: 503 });
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/went wrong on our end/i)).toBeInTheDocument();
    expect(screen.queryByText(/combination didn’t work/i)).toBeNull(); // must not say "wrong password"
  });

  it('shows a rate-limit message on 429', async () => {
    api.loginUser.mockResolvedValue({ ok: false, status: 429 }); // 429 = "too many requests"
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/Too many attempts/i)).toBeInTheDocument();
  });
});

describe('Registration server errors', () => {
  it('shows a server-error message on 5xx', async () => {
    api.registerUser.mockResolvedValue({ ok: false, status: 500 });
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'cole@umkc.edu');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg!');
    await user.type(screen.getByLabelText('Confirm password'), 'Abcdefg!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/went wrong on our end/i)).toBeInTheDocument();
  });
});
