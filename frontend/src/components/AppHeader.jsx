import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import { logoutUser } from '../api/auth.js';
import { initialsFor } from '../lib/initials.js';

const APP_NAME = 'Shared Expense Management Tool';

// The bar across the top of every page.
//   no props  -> logged out version: just the logo and the app name
//   user      -> signed in version ({ email, name }): adds the Home link and the account menu
//   loading   -> used while a signed-in page is still loading. It already has the signed-in layout,
//                so the bar doesn't jump around when the user's info arrives.
export default function AppHeader({ user, loading = false }) {
  const signedIn = Boolean(user) || loading; // true once we have a user, or while one is on the way
  return (
    <header className={`app-header${signedIn ? ' app-header--signed-in' : ''}`}>
      {/* The name is hidden on very small signed-in screens, so the link keeps an explicit label. */}
      <Link className="app-brand" to={signedIn ? '/home' : '/login'} aria-label={signedIn ? `${APP_NAME}, home` : APP_NAME}>
        <Logo />
        <span className="app-brand-name">{APP_NAME}</span>
      </Link>
      {signedIn && (
        <nav className="app-nav" aria-label="Main">
          <NavLink className="app-nav-link" to="/home">Home</NavLink>
          <NavLink className="app-nav-link" to="/groups">Groups</NavLink>
        </nav>
      )}
      {user && <AccountMenu user={user} />}
    </header>
  );
}

// Avatar button that opens a small menu with the signed-in email, a Settings link and a Log out action.
function AccountMenu({ user }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(''); // shown inside the menu if logging out fails
  const wrapRef = useRef(null); // the whole menu, used to tell if a click landed outside of it
  const buttonRef = useRef(null); // the avatar button, so focus can go back to it
  const menuId = useId(); // unique id so the button can point at the menu it opens
  const initial = initialsFor(user.name, user.email);

  // While open: close on an outside press or Escape (Escape returns focus to the button).
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setError('');
    const res = await logoutUser();
    if (res.ok) {
      navigate('/login', { replace: true }); // replace: Back must not return to a signed-in page
    } else {
      setError('We couldn’t log you out. Check your connection and try again.');
    }
  }

  return (
    <div className="account-menu" ref={wrapRef}>
      {/* The initials are what you see. The hidden text gives the button a name for screen readers,
          and starting the name with the visible initials keeps voice control working. */}
      <button
        ref={buttonRef}
        type="button"
        className="account-button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="account-avatar">{initial}</span>
        <span className="visually-hidden">Account menu</span>
        <svg className="account-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="account-popover" id={menuId}>
          <p className="account-email">{user.email}</p>
          <Link className="account-item" to="/settings" onClick={() => setOpen(false)}>Settings</Link>
          <button type="button" className="account-item" onClick={handleLogout}>Log out</button>
          <p className="error form-error text-danger small px-2 mb-1" role="alert">{error}</p>
        </div>
      )}
    </div>
  );
}
