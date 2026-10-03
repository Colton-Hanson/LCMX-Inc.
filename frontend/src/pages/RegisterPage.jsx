// RegisterPage.jsx — SCRUM-11: the "Create your account" page.
// Flow (from the requirements doc): type email -> email is checked -> create password (rules shown below the box)
// -> re-enter password -> passwords checked to match -> click Create account -> account is created, the user is
// logged in automatically, and lands on the home page.

import { useState } from 'react'; // useState = lets a component remember values (what the user typed, errors...)
import { Link, useNavigate } from 'react-router-dom'; // Link = a link without a full page reload; useNavigate = change page from code
import EmailField from '../components/EmailField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { validateEmail, validatePassword, validateConfirm } from '../lib/validators.js';
import { registerUser, loginUser } from '../api/auth.js'; // the ONLY things here that talk to the backend

export default function RegisterPage() {
  const navigate = useNavigate(); // call navigate('/home') to send the user to another page

  // ---- State: values React remembers between renders. Each is [currentValue, functionToChangeIt]. ----
  const [email, setEmail] = useState(''); // what's typed in the email box
  const [password, setPassword] = useState(''); // what's typed in the password box
  const [confirm, setConfirm] = useState(''); // what's typed in the confirm box
  const [touched, setTouched] = useState({}); // which fields the user has already visited, e.g. { email: true }
  const [submitError, setSubmitError] = useState(''); // an error message from the submit/server step
  const [submitting, setSubmitting] = useState(false); // true while we wait for the server (disables the button)

  // Mark a field as "touched" (the user has left it). We only show a field's error AFTER that,
  // so people aren't yelled at while they're still typing their first character.
  const touch = (name) => setTouched((t) => ({ ...t, [name]: true }));

  // Recomputed on every render from the current values: the current error text for each field ('' = fine).
  const errors = {
    email: validateEmail(email),
    password: validatePassword(password),
    confirm: validateConfirm(password, confirm),
  };
  // Only reveal a field's error once that field has been touched.
  const show = (name) => (touched[name] ? errors[name] : '');
  // True when confirm is filled in and equals the password -> we display "✓ Passwords match."
  const confirmMatches = confirm && password === confirm;

  // Runs when the user clicks "Create account" or presses Enter in a field.
  async function handleSubmit(e) {
    e.preventDefault(); // stop the browser's default form submit (a full page reload that would put data in the URL)
    setTouched({ email: true, password: true, confirm: true }); // reveal ALL errors now that they tried to submit
    setSubmitError(''); // clear any previous server error
    if (errors.email || errors.password || errors.confirm) return; // something is invalid: stop here, don't call the server

    setSubmitting(true); // show "Creating account…" and disable the button so it can't be double-clicked
    // BACKEND HOOK (SCRUM-13): this call goes to the server. See src/api/auth.js for the request/response shape.
    // To change where it sends or what it sends, edit auth.js, not this file.
    // email.trim() removes accidental spaces (auth.js also lowercases it). The confirm field is NOT sent
    // (it's only a browser-side check).
    const result = await registerUser({ email: email.trim(), password }); // `await` pauses until the server answers

    // BACKEND HOOK: how the server's answer maps to what the user sees. Confirmed against Lukas's backend:
    // 201 = created, 409 = email already registered, 422 = the server rejected the data.
    if (!result.ok) {
      setSubmitting(false); // server answered with a problem: re-enable the button so they can fix it
      if (result.network) {
        setSubmitError('We couldn’t reach the server. Check your connection and try again.'); // request never arrived
      } else if (result.status === 429) {
        setSubmitError('Too many attempts. Please wait a moment and try again.'); // rate limiting kicked in
      } else if (result.status >= 500) {
        setSubmitError('Something went wrong on our end. Please try again in a moment.'); // server-side problem (not the user's fault)
      } else if (result.status === 409) {
        setSubmitError('An account with that email may already exist. Try logging in instead.'); // 409 = "conflict": duplicate account
      } else {
        setSubmitError('We couldn’t create your account. Please check your details and try again.'); // any other failure (e.g. 422)
      }
      return; // stop here: the account was NOT created
    }

    // The account exists now. Lukas's register endpoint does NOT log the user in (it sets no cookie), so we log in
    // with the same email + password. That way "brought to home page" really means signed in, not just redirected.
    const session = await loginUser({ email: email.trim(), password });
    setSubmitting(false);
    if (session.ok) {
      navigate('/home'); // success: per the requirements doc, the user is "brought to home page"
    } else {
      // Rare: the account was created but the automatic login failed (server hiccup, rate limit...).
      // Don't show a scary error — send them to the login page with a friendly note.
      navigate('/login', { state: { notice: 'Your account was created. Log in to continue.' } });
    }
  }

  return (
    // auth-page + Bootstrap utilities: a full-height page that centers the card both ways.
    <main className="auth-page d-flex align-items-center justify-content-center min-vh-100 p-3">
      {/* aria-labelledby names this section by pointing at the heading's id (helps screen readers).
          Bootstrap "card" = the white rounded box; "card-body" = its padded inside. */}
      <section className="card shadow-sm auth-card w-100" aria-labelledby="register-title">
        <div className="card-body p-4">
        <h1 id="register-title" className="h3 mb-1">Create your account</h1>
        <p className="subtitle text-body-secondary mb-4">Collaborative finance for people who actually share their lives.</p>

        {/* noValidate turns off the browser's built-in pop-up errors so OUR messages are the ones shown. */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email box. onBlur fires when the user leaves the box: that's when we mark it touched and show errors. */}
          <EmailField
            value={email}
            onChange={setEmail}
            onBlur={() => touch('email')}
            error={show('email')}
          />

          {/* Password box. The rules checklist is nested inside so it appears directly under the box. */}
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            onBlur={() => touch('password')}
            error={show('password')}
            autoComplete="new-password" // tells password managers "this is a NEW password" (offers to generate one)
            describedBy="password-rules" // screen readers read the rules list along with this field
          >
            <PasswordRules id="password-rules" password={password} />
          </PasswordField>

          {/* Confirm box: must match the password above. */}
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            onBlur={() => touch('confirm')}
            error={show('confirm')}
            autoComplete="new-password"
          />
          {/* role="status" = polite announcement for screen readers when the match message appears. */}
          <p className="success text-success small mb-2" role="status">
            {confirmMatches ? '✓ Passwords match.' : ''}
          </p>

          {/* Server/submit-level error (duplicate email, server down, etc.). role="alert" announces it immediately. */}
          <p className="error form-error text-danger small mt-2" role="alert">
            {submitError}
          </p>

          {/* disabled while submitting so the user can't create the account twice by double-clicking.
              btn btn-primary btn-lg w-100 = big, full-width blue Bootstrap button (about 48px tall). */}
          <button type="submit" className="btn btn-primary btn-lg w-100 mt-2" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="alt text-center text-body-secondary mt-4 mb-0">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
        </div>
      </section>
    </main>
  );
}
