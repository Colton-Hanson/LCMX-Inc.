import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import EmailField from '../components/EmailField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { validateEmail, validatePassword, validateConfirm } from '../lib/validators.js';
import { registerUser, loginUser } from '../api/auth.js';
import { usePageTitle } from '../lib/usePageTitle.js';

export default function RegisterPage() {
  usePageTitle('Create your account');
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({}); // fields the user has already left, e.g. { email: true }
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const touch = (name) => setTouched((t) => ({ ...t, [name]: true }));

  // Current validation message for each field ('' means valid).
  const errors = {
    email: validateEmail(email),
    password: validatePassword(password),
    confirm: validateConfirm(password, confirm),
  };
  // A field's error is only shown after the user has left that field (or tried to submit).
  const show = (name) => (touched[name] ? errors[name] : '');
  const confirmMatches = confirm && password === confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true, confirm: true });
    setSubmitError('');
    if (errors.email || errors.password || errors.confirm) return;

    setSubmitting(true);
    // The confirm field is a browser-side check only and is not sent.
    const result = await registerUser({ email: email.trim(), password });

    // 201: created. 409: email already registered. 422: the server rejected the data.
    if (!result.ok) {
      setSubmitting(false);
      if (result.network) {
        setSubmitError('We couldn’t reach the server. Check your connection and try again.');
      } else if (result.status === 429) {
        setSubmitError('Too many attempts. Please wait a moment and try again.');
      } else if (result.status >= 500) {
        setSubmitError('Something went wrong on our end. Please try again in a moment.');
      } else if (result.status === 409) {
        setSubmitError('An account with that email may already exist. Try logging in instead.');
      } else {
        setSubmitError('We couldn’t create your account. Please check your details and try again.');
      }
      return;
    }

    // Registering does not start a session, so sign in with the same credentials.
    const session = await loginUser({ email: email.trim(), password });
    setSubmitting(false);
    if (session.ok) {
      navigate('/home');
    } else {
      // The account exists but the automatic sign-in failed: send the user to log in manually.
      navigate('/login', { state: { notice: 'Your account was created. Log in to continue.' } });
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page-main d-flex align-items-center justify-content-center p-3">
        <section className="card auth-card w-100" aria-labelledby="register-title">
          <div className="card-body p-4">
            <h1 id="register-title" className="h3 mb-1">Create your account</h1>
            <p className="subtitle text-body-secondary mb-4">Collaborative finance for people who actually share their lives.</p>

            {/* noValidate: validation messages are rendered by the app instead of the browser. */}
            <form onSubmit={handleSubmit} noValidate>
              <EmailField
                value={email}
                onChange={setEmail}
                onBlur={() => touch('email')}
                error={show('email')}
              />

              {/* The rules checklist renders inside the field, directly under the input. */}
              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                onBlur={() => touch('password')}
                error={show('password')}
                autoComplete="new-password"
                describedBy="password-rules"
              >
                <PasswordRules id="password-rules" password={password} />
              </PasswordField>

              <PasswordField
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                onBlur={() => touch('confirm')}
                error={show('confirm')}
                autoComplete="new-password"
              />
              <p className="success text-success small mb-2" role="status">
                {confirmMatches ? '✓ Passwords match.' : ''}
              </p>

              <p className="error form-error text-danger small mt-2" role="alert">
                {submitError}
              </p>

              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="alt text-center text-body-secondary mt-4 mb-0">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
