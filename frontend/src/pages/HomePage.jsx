// HomePage.jsx — TEMPORARY landing page. Registering or logging in sends the user here (route: /home).
// It's intentionally blank apart from a centered message proving the login worked, plus a LOG OUT button.
// The real dashboard replaces this in the next sprint: swap out the contents of <div className="landing"> below
// for it and keep the login check above it.
//
// The message only appears when the BACKEND confirms there's a valid login (GET /auth/me). Anyone who isn't
// logged in is sent back to /login instead, so the message can never show up for someone who skipped logging in.
// NOTE: full route guards for EVERY page are SCRUM-39 (Sprint 2); this page only protects itself.

import { useEffect, useState } from 'react'; // useState = remember a value; useEffect = run code when the page appears
import { useNavigate, Link } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../api/auth.js'; // the ONLY things here that talk to the backend

export default function HomePage() {
  const navigate = useNavigate();
  // 'loading' while we wait for the server, 'ready' once we know the user is logged in,
  // 'error' if the server couldn't be reached (so we can't tell either way).
  const [status, setStatus] = useState('loading');
  const [logoutError, setLogoutError] = useState(''); // message if the log-out request fails ('' = none)

  // Runs once when the page first appears: ask the backend whether anyone is logged in.
  useEffect(() => {
    let cancelled = false; // becomes true if the page goes away before the server answers
    getCurrentUser().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setStatus('ready'); // valid login cookie -> show the landing message
      } else if (res.status === 401) {
        // BACKEND HOOK: 401 = no valid session cookie (never logged in, expired, or logged out).
        // `replace` swaps the history entry so the Back button doesn't bounce them back here.
        navigate('/login', { replace: true });
      } else {
        setStatus('error'); // server down or misbehaving
      }
    });
    return () => {
      cancelled = true; // cleanup when the page is closed
    };
  }, [navigate]);

  // Runs when LOG OUT is clicked: ask the backend to delete the session cookie, then go back to the login page.
  async function handleLogout() {
    setLogoutError('');
    const res = await logoutUser();
    if (res.ok) {
      navigate('/login', { replace: true }); // `replace` so Back doesn't return to a page they're no longer allowed on
    } else {
      // Don't pretend they're logged out if the server never confirmed it.
      setLogoutError('We couldn’t log you out. Check your connection and try again.');
    }
  }

  // While waiting, the page stays blank (screen readers are told it's loading).
  if (status === 'loading') {
    return (
      <main className="auth-page d-flex align-items-center justify-content-center min-vh-100 p-3">
        <p className="visually-hidden" role="status">Loading…</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="auth-page d-flex align-items-center justify-content-center min-vh-100 p-3">
        <section className="card shadow-sm auth-card w-100">
          <div className="card-body p-4">
            <p className="error form-error text-danger small mt-0" role="alert">
              We couldn’t reach the server to check your login. Make sure the backend is running, then refresh.
            </p>
            <p className="alt text-center text-body-secondary mt-4 mb-0">
              <Link to="/login">Go to log in</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    // <main> is a landmark element: screen readers can jump straight to the main content.
    // .auth-page centers its contents on the screen; .landing stacks the message and the button in the middle.
    <main className="auth-page d-flex align-items-center justify-content-center min-vh-100 p-3">
      <div className="landing">
        <h1 className="h2 fw-bold mb-0">YOU HAVE SUCCESSFULLY LOGGED IN!</h1>
        {/* btn btn-primary btn-lg = big blue Bootstrap button; px-5 makes it wider than its text. */}
        <button type="button" className="logout-btn btn btn-primary btn-lg px-5" onClick={handleLogout}>
          LOG OUT
        </button>
        {/* Only visible if logging out failed (an empty error paragraph takes no space). */}
        <p className="error form-error text-danger small mb-0" role="alert">
          {logoutError}
        </p>
      </div>
    </main>
  );
}
