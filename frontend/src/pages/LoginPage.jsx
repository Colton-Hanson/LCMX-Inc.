// LoginPage.jsx — SCRUM-12: the "Log in" page.
// Flow (from the requirements doc): enter email + password -> server checks them -> success goes to the home page;
// failure shows a generic error that points the user to register.

import { useState } from 'react'; // lets the component remember typed values and messages
import { Link, useNavigate, useLocation } from 'react-router-dom'; // Link = page link; useNavigate = change page from code; useLocation = read what the previous page passed along
import EmailField from '../components/EmailField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { loginUser } from '../api/auth.js'; // the ONLY thing here that talks to the backend

// SECURITY: this message is deliberately vague. It must NOT say "no account with that email" or
// "wrong password" separately, because that would let an attacker discover which emails have accounts.
// (The requirements doc asks for a generic error that leaks nothing about accounts.)
const GENERIC_FAILURE =
  'That email and password combination didn’t work. Check your details, or register for a new account.';

export default function LoginPage() {
  const navigate = useNavigate(); // call navigate('/home') to change pages from code
  // Other pages can send a friendly note along with the redirect, e.g. RegisterPage sends
  // "Your account was created. Log in to continue." if its automatic login didn't work.
  const notice = useLocation().state?.notice ?? ''; // '' when we arrived without a note

  // ---- State (values React remembers) ----
  const [email, setEmail] = useState(''); // email box contents
  const [password, setPassword] = useState(''); // password box contents
  const [error, setError] = useState(''); // message shown above the button ('' = none)
  const [submitting, setSubmitting] = useState(false); // true while waiting on the server (disables the button)

  // Runs when the user clicks "Log in" or presses Enter.
  async function handleSubmit(e) {
    e.preventDefault(); // stop the browser's default form submit (full reload, data in the URL)
    setError(''); // clear any old message

    // Only check that both boxes have something in them. We deliberately do NOT check the email's format or
    // the password's strength here: the server decides whether the login is valid, and giving format
    // hints on a login form isn't needed.
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return; // stop: don't bother the server with an empty request
    }

    setSubmitting(true); // show "Logging in…" and disable the button
    // BACKEND HOOK (SCRUM-15): this call goes to the server. See src/api/auth.js for the expected
    // request/response shape. To change where it sends or what it sends, edit auth.js, not this file.
    const result = await loginUser({ email: email.trim(), password }); // `await` pauses until the server answers
    setSubmitting(false); // server answered: re-enable the button

    // BACKEND HOOK: how the server's answer maps to what the user sees. Confirmed against Lukas's backend:
    // 200 = logged in (cookie set), 401 = wrong email or password (same reply for both), 422 = malformed data.
    // '/home' is a placeholder until the real dashboard exists.
    if (result.ok) {
      navigate('/home'); // success -> home page
    } else if (result.network) {
      setError('We couldn’t reach the server. Check your connection and try again.'); // request never arrived
    } else if (result.status === 429) {
      setError('Too many attempts. Please wait a moment and try again.'); // rate limiting kicked in
    } else if (result.status >= 500) {
      setError('Something went wrong on our end. Please try again in a moment.'); // server problem, NOT a bad password
    } else {
      setError(GENERIC_FAILURE); // wrong email, wrong password, or any other rejection: same message for all
    }
  }

  return (
    // auth-page + Bootstrap utilities: a full-height page that centers the card both ways.
    <main className="auth-page d-flex align-items-center justify-content-center min-vh-100 p-3">
      {/* aria-labelledby names the section by pointing at the heading (helps screen readers).
          Bootstrap "card" = the white rounded box; "card-body" = its padded inside. */}
      <section className="card shadow-sm auth-card w-100" aria-labelledby="login-title">
        <div className="card-body p-4">
        <h1 id="login-title" className="h3 mb-1">Log in</h1>
        <p className="subtitle text-body-secondary mb-4">Welcome back.</p>

        {/* A friendly note passed from another page (empty most of the time, then it takes no space).
            role="status" = screen readers announce it politely. */}
        <p className="notice text-success fw-semibold mb-3" role="status">
          {notice}
        </p>

        {/* noValidate disables the browser's own pop-up errors so we control the wording. */}
        <form onSubmit={handleSubmit} noValidate>
          {/* autoComplete="username" lets password managers recognise this as the account name field. */}
          <EmailField value={email} onChange={setEmail} autoComplete="username" />
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password" // tells password managers to fill in the saved password
          />

          {/* Shows whichever message `error` currently holds. role="alert" makes screen readers announce it. */}
          <p className="error form-error text-danger small mt-2" role="alert">
            {error}
          </p>

          {/* btn btn-primary btn-lg w-100 = big, full-width blue Bootstrap button (about 48px tall). */}
          <button type="submit" className="btn btn-primary btn-lg w-100 mt-2" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="alt text-center text-body-secondary mt-4 mb-0">
          New here? <Link to="/register">Create an account</Link>
        </p>
        </div>
      </section>
    </main>
  );
}
