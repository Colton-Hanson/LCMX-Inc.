import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmailField from '../components/EmailField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordRules from '../components/PasswordRules.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import TextField from '../components/TextField.jsx';
import {
  changePassword,
  confirmEmailChange,
  getProfile,
  requestEmailChange,
  updateProfile,
} from '../api/auth.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { initialsFor } from '../lib/initials.js';
import { EMAIL_FORMAT_MESSAGE, checkPasswordRules, validateEmail, validateName } from '../lib/validators.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Notification preferences, in the order they are shown. `key` is the field name in the profile API.
const NOTIFICATIONS = [
  { key: 'notify_group_invite', label: 'Someone invites me to a group' },
  { key: 'notify_new_expense', label: 'An expense is added to one of my groups' },
  { key: 'notify_settlement', label: 'Someone marks a payment as paid' },
  { key: 'notify_removed_from_group', label: 'I’m removed from a group' },
];

// Settings page: profile, password and notification preferences, each saved on its own.
// The login check and top bar come from RequireAuth.
export default function SettingsPage() {
  usePageTitle('Settings');
  const { profile, setProfile, onExpired } = useAuth();
  return (
    <main className="settings-wrap">
      <div>
        <h1 className="mb-1">Settings</h1>
        <p className="text-body-secondary mb-0">Your profile, sign-in details and notifications.</p>
      </div>
      <ProfileCard profile={profile} onProfile={setProfile} onExpired={onExpired} />
      <PasswordCard onExpired={onExpired} />
      <NotificationsCard profile={profile} onProfile={setProfile} onExpired={onExpired} />
    </main>
  );
}

// Shared card layout: a titled section that screen readers can jump to.
function SettingsCard({ id, title, children }) {
  return (
    <section className="card settings-card" aria-labelledby={`${id}-title`}>
      <div className="card-body p-3 p-sm-4">
        <h2 id={`${id}-title`} className="fs-5 mb-3">{title}</h2>
        {children}
      </div>
    </section>
  );
}

// Photo (upload not built yet), name and email.
// A new name is saved right away. A new email is only a request until the verification code is
// confirmed, so there are two forms: the main one, and a second one that shows up while an email is pending.
function ProfileCard({ profile, onProfile, onExpired }) {
  const [name, setName] = useState(profile.name ?? ''); // what is typed in the boxes, starting from the saved profile
  const [email, setEmail] = useState(profile.email);
  const [code, setCode] = useState(''); // the verification code box
  const [notice, setNotice] = useState(''); // green message at the bottom of the card
  const [error, setError] = useState(''); // red message for problems that don't belong to one field
  const [codeError, setCodeError] = useState(''); // the next three are the messages under each field
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [focusTick, setFocusTick] = useState(0); // bumped when a save is blocked, to focus the first invalid field
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  // After a blocked save, put the cursor in the first box that has an error.
  useEffect(() => {
    if (focusTick) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  // Keep the inputs in step with the saved profile (for example after an email change is confirmed).
  useEffect(() => {
    setName(profile.name ?? '');
    setEmail(profile.email);
  }, [profile.name, profile.email]);

  const initial = initialsFor(profile.name, profile.email);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setNameError('');
    setEmailError('');
    // Work out what actually changed. Emails are compared trimmed and lowercase, like the server stores them.
    const nameChanged = name.trim() !== (profile.name ?? '');
    const newEmail = email.trim().toLowerCase();
    const emailChanged = newEmail !== profile.email.toLowerCase();
    if (!nameChanged && !emailChanged) {
      setNotice('There are no changes to save.');
      return;
    }

    // Check the changed fields here first; nothing is sent to the server while one is invalid.
    const nameProblem = nameChanged ? validateName(name) : '';
    const emailProblem = emailChanged ? validateEmail(email) : '';
    if (nameProblem || emailProblem) {
      setNameError(nameProblem);
      setEmailError(emailProblem);
      setFocusTick((t) => t + 1);
      return;
    }

    // Save the name first, then start the email change if the email changed too.
    setBusy(true);
    let current = profile;
    if (nameChanged) {
      const res = await updateProfile({ name: name.trim() });
      if (res.status === 401) return onExpired(); // the session ended, so go to the login page
      if (!res.ok) {
        setBusy(false);
        const message = messageFromResult(res, 'We couldn’t save your name.');
        if (res.status === 400 || res.status === 422) {
          setNameError(message);
          setFocusTick((t) => t + 1);
        } else {
          setError(message);
        }
        return;
      }
      current = res.data; // keep the newest profile from the server
      onProfile(res.data);
    }
    if (emailChanged) {
      const res = await requestEmailChange(newEmail);
      if (res.status === 401) return onExpired();
      if (!res.ok) {
        setBusy(false);
        if (res.status === 400 || res.status === 409 || res.status === 422) {
          setEmailError(res.status === 422 ? EMAIL_FORMAT_MESSAGE : messageFromResult(res, 'We couldn’t use that email.'));
          setFocusTick((t) => t + 1);
        } else {
          setError(messageFromResult(res, 'We couldn’t start the email change.'));
        }
        return;
      }
      // Until real email delivery exists, the API returns the code so it can be filled in automatically.
      setCode(res.data?.verification_token ?? '');
      onProfile({ ...current, pending_email: newEmail });
      setEmail(newEmail); // show the cleaned-up address that is being verified
      setNotice('Enter the verification code below to finish changing your email.');
    } else {
      setNotice('Changes saved.');
    }
    setBusy(false);
  }

  // Send the code to finish the email change, then reload the profile so the new email shows up.
  async function handleConfirm(e) {
    e.preventDefault();
    setCodeError('');
    setNotice('');
    if (!code.trim()) {
      setCodeError('Enter the verification code.');
      return;
    }
    setBusy(true);
    const res = await confirmEmailChange(code);
    if (!res.ok) {
      setBusy(false);
      setCodeError(messageFromResult(res, 'We couldn’t verify that code.'));
      return;
    }
    const fresh = await getProfile();
    setBusy(false);
    // If reloading fails, fall back to the pending email we already know about.
    onProfile(fresh.ok ? fresh.data : { ...profile, email: profile.pending_email, pending_email: null });
    setCode('');
    setNotice('Your email address was updated.');
  }

  // Asks for a fresh code for the email that is waiting to be verified, and fills it in like the first one.
  async function handleResend() {
    setCodeError('');
    setNotice('');
    setBusy(true);
    const res = await requestEmailChange(profile.pending_email);
    setBusy(false);
    if (res.status === 401) return onExpired();
    if (!res.ok) {
      setCodeError(messageFromResult(res, 'We couldn’t send a new code.'));
      return;
    }
    setCode(res.data?.verification_token ?? '');
    setNotice('A new verification code was filled in below.');
  }

  return (
    <SettingsCard id="profile" title="Profile">
      {/* Photo upload isn't built yet, so the button is turned off and says why. */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <span className="account-avatar avatar-lg" aria-hidden="true">{initial}</span>
        <div>
          <button type="button" className="btn btn-ghost" disabled aria-describedby="photo-note">
            Upload a photo
          </button>
          <p id="photo-note" className="text-body-secondary small mb-0 mt-1">Photo upload isn’t available yet.</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSave} noValidate>
        <TextField
          label="Name"
          value={name}
          onChange={(v) => {
            setName(v);
            setNameError('');
          }}
          error={nameError}
          autoComplete="name"
        />
        <EmailField
          value={email}
          onChange={(v) => {
            setEmail(v);
            setEmailError('');
          }}
          error={emailError}
        />
        <p className="text-body-secondary small">
          If you change your email, a verification code is needed before the new address takes effect.
        </p>
        <p className="error form-error text-danger small mt-2" role="alert">{error}</p>
        <button type="submit" className="btn btn-tint" disabled={busy}>Save changes</button>
      </form>

      {/* Only shown while an email change is waiting for its code. */}
      {profile.pending_email && (
        <form className="pending-box" onSubmit={handleConfirm} noValidate aria-labelledby="pending-title">
          <h3 id="pending-title" className="fs-6 mb-1">Verify your new email</h3>
          <p className="text-body-secondary small">
            Waiting to verify <strong>{profile.pending_email}</strong>. You still sign in with {profile.email} until
            the code is confirmed.
          </p>
          <TextField
            label="Verification code"
            value={code}
            onChange={setCode}
            error={codeError}
            autoComplete="one-time-code"
          />
          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-tint" disabled={busy}>Confirm email</button>
            <button type="button" className="btn btn-ghost" onClick={handleResend} disabled={busy}>
              Send a new code
            </button>
          </div>
        </form>
      )}

      <p className="notice text-success fw-semibold small mt-3 mb-0" role="status">{notice}</p>
    </SettingsCard>
  );
}

// Changing the password. The form stays hidden until "Change password" is pressed.
// A successful change ends every session on the server, so the user is sent to log in again.
function PasswordCard({ onExpired }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(''); // the three password boxes
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState(''); // the next three are the messages under each box
  const [nextError, setNextError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [error, setError] = useState(''); // problems that belong to no single field (server down, etc.)
  const [focusTick, setFocusTick] = useState(0); // bumped when a save is blocked, to focus the first invalid field
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false); // the form stays hidden until the user asks to change the password
  const formRef = useRef(null);
  const openButtonRef = useRef(null);
  const wasOpen = useRef(false);
  const confirmMatches = confirm && next === confirm; // drives the "Passwords match" line

  // After a blocked submit, put the cursor in the first box that has an error.
  useEffect(() => {
    if (focusTick) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  // Move focus into the form when it opens, and back to the button when it closes.
  useEffect(() => {
    if (open) formRef.current?.querySelector('input')?.focus();
    else if (wasOpen.current) openButtonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Close the form and throw away anything that was typed or shown.
  function handleCancel() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setCurrentError('');
    setNextError('');
    setConfirmError('');
    setError('');
    setOpen(false);
  }

  // Check the boxes first, then send the change. The server still has the final say on every rule.
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Check every field here first; nothing is sent to the server while one is invalid.
    let currentProblem = '';
    let nextProblem = '';
    let confirmProblem = '';
    if (!current) currentProblem = 'Enter your current password.';
    if (!next) nextProblem = 'Enter a new password.';
    else if (checkPasswordRules(next).some((rule) => !rule.met)) {
      nextProblem = 'Your new password doesn’t meet all the requirements yet.';
    }
    if (!confirm) confirmProblem = 'Confirm your new password.';
    else if (next && next !== confirm) confirmProblem = 'The new passwords don’t match.';
    setCurrentError(currentProblem);
    setNextError(nextProblem);
    setConfirmError(confirmProblem);
    if (currentProblem || nextProblem || confirmProblem) {
      setFocusTick((t) => t + 1);
      return;
    }

    setBusy(true);
    const res = await changePassword({ currentPassword: current, newPassword: next });
    setBusy(false);
    if (res.status === 401) return onExpired();
    if (!res.ok) {
      const message = messageFromResult(res, 'We couldn’t change your password.');
      if (res.status === 400) setCurrentError(message); // wrong current password
      else if (res.status === 422) setNextError(message); // new password rejected by the server's rules
      else {
        setError(message);
        return;
      }
      setFocusTick((t) => t + 1);
      return;
    }
    navigate('/login', { replace: true, state: { notice: 'Password changed. Log in with your new password.' } });
  }

  return (
    <SettingsCard id="password" title="Password">
      <p className="text-body-secondary small">We ask for your current password before accepting a new one.</p>
      {!open && (
        <button
          ref={openButtonRef}
          type="button"
          className="btn btn-tint"
          aria-expanded="false"
          aria-controls="password-form"
          onClick={() => setOpen(true)}
        >
          Change password
        </button>
      )}
      {open && (
      <form id="password-form" ref={formRef} onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="Current password"
          value={current}
          onChange={(v) => {
            setCurrent(v);
            setCurrentError('');
          }}
          error={currentError}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={next}
          onChange={(v) => {
            setNext(v);
            setNextError('');
          }}
          error={nextError}
          autoComplete="new-password"
          describedBy="new-password-rules"
        >
          <PasswordRules id="new-password-rules" password={next} />
        </PasswordField>
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setConfirmError('');
          }}
          error={confirmError}
          autoComplete="new-password"
        />
        <p className="success text-success small mb-2" role="status">
          {confirmMatches ? '✓ Passwords match.' : ''}
        </p>
        <p className="error form-error text-danger small mt-2" role="alert">{error}</p>
        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-tint" disabled={busy}>Update password</button>
          <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
      )}
    </SettingsCard>
  );
}

// The four notification preferences, saved together.
function NotificationsCard({ profile, onProfile, onExpired }) {
  // The current on/off value of each checkbox, starting from what is saved on the server.
  const [values, setValues] = useState(() =>
    Object.fromEntries(NOTIFICATIONS.map(({ key }) => [key, Boolean(profile[key])]))
  );
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const res = await updateProfile(values);
    setBusy(false);
    if (res.status === 401) return onExpired();
    if (!res.ok) {
      setError(messageFromResult(res, 'We couldn’t save your notification choices.'));
      return;
    }
    onProfile(res.data);
    setNotice('Notification choices saved.');
  }

  return (
    <SettingsCard id="notifications" title="Notifications">
      <form onSubmit={handleSave}>
        {/* fieldset + legend groups the checkboxes, so a screen reader reads "Tell me when" with each one. */}
        <fieldset>
          <legend className="fs-6 fw-normal text-body-secondary">Tell me when</legend>
          {NOTIFICATIONS.map(({ key, label }) => (
            <label key={key} className="check-row">
              <input
                type="checkbox"
                className="form-check-input"
                checked={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p className="error form-error text-danger small mt-2" role="alert">{error}</p>
        <button type="submit" className="btn btn-tint mt-2" disabled={busy}>Save notification choices</button>
        <p className="notice text-success fw-semibold small mt-3 mb-0" role="status">{notice}</p>
      </form>
    </SettingsCard>
  );
}
