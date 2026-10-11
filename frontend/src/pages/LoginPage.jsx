import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import EmailField from '../components/EmailField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { loginUser } from '../api/auth.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Deliberately generic: the message must not reveal whether the email or the password was wrong.
const GENERIC_FAILURE =
  'That email and password combination didn’t work. Check your details, or register for a new account.';

export default function LoginPage() {
  usePageTitle('Log in');
  const navigate = useNavigate();
  // Other pages can pass a message through router state (e.g. after account creation).
  const notice = useLocation().state?.notice ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Only require that both fields are filled in. The server decides whether the credentials are valid.
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    const result = await loginUser({ email: email.trim(), password });
    setSubmitting(false);

    // 200: signed in (session cookie set). 401: wrong email or password. 422: malformed request.
    if (result.ok) {
      navigate('/home');
    } else if (result.network) {
      setError('We couldn’t reach the server. Check your connection and try again.');
    } else if (result.status === 429) {
      setError('Too many attempts. Please wait a moment and try again.');
    } else if (result.status >= 500) {
      setError('Something went wrong on our end. Please try again in a moment.');
    } else {
      setError(GENERIC_FAILURE);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page-main d-flex align-items-center justify-content-center p-3">
        <section className="card auth-card w-100" aria-labelledby="login-title">
          <div className="card-body p-4">
            <h1 id="login-title" className="h3 mb-1">Log in</h1>
            <p className="subtitle text-body-secondary mb-4">Welcome back.</p>

            {/* Announced politely by screen readers; takes no space while empty. */}
            <p className="notice text-success fw-semibold mb-3" role="status">
              {notice}
            </p>

            {/* noValidate: validation messages are rendered by the app instead of the browser. */}
            <form onSubmit={handleSubmit} noValidate>
              {/* "username" lets password managers match this email with the saved password. */}
              <EmailField value={email} onChange={setEmail} autoComplete="username" />
              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />

              <p className="error form-error text-danger small mt-2" role="alert">
                {error}
              </p>

              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={submitting}>
                {submitting ? 'Logging in…' : 'Log in'}
              </button>
            </form>

            <p className="alt text-center text-body-secondary mt-4 mb-0">
              New here? <Link to="/register">Create an account</Link>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
