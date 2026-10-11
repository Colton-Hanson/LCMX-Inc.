import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import AppHeader from './AppHeader.jsx';
import { getProfile } from '../api/auth.js';

// Wraps every page that needs a login. It checks the session when it first loads (and again when the
// user comes back to the browser tab), shows the top bar for the signed-in user, and sends guests and
// expired sessions to the login page.
// Pages rendered inside it read the shared state with useAuth().
export default function RequireAuth() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [profile, setProfile] = useState(null);

  // `navigate` gets a new identity whenever the page changes; a ref keeps toLogin stable so the
  // session check below runs once, not on every page change.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const toLogin = useCallback(
    (notice) => navigateRef.current('/login', { replace: true, state: { notice } }), // replace: Back does not return to a page that needs a login
    []
  );
  // Pages call this when any request comes back 401 (the session ended while the page was open).
  const onExpired = useCallback(() => toLogin('Your session ended. Log in to continue.'), [toLogin]);

  useEffect(() => {
    let cancelled = false; // ignore the response if the page was closed first
    getProfile().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setProfile(res.data);
        setStatus('ready');
      } else if (res.status === 401) {
        toLogin('Log in to continue.');
      } else {
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [toLogin]);

  // Coming back to the tab after a while: check the session again so an expired one is caught right away.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    function recheck() {
      if (document.visibilityState === 'hidden') return;
      getProfile().then((res) => {
        if (res.status === 401) onExpired();
      });
    }
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, [status, onExpired]);

  // Still checking the session: show the bar and a hidden message for screen readers.
  if (status === 'loading') {
    return (
      <>
        <AppHeader loading />
        <main className="page-main">
          <p className="visually-hidden" role="status">Loading…</p>
        </main>
      </>
    );
  }

  // The server couldn't be reached (not a 401), so show an error instead of the page.
  if (status === 'error') {
    return (
      <>
        <AppHeader />
        <main className="page-main d-flex align-items-center justify-content-center p-3">
          <section className="card auth-card w-100">
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
      </>
    );
  }

  // Logged in: show the bar, then whichever page matches the URL (<Outlet />).
  return (
    <>
      <AppHeader user={profile} />
      <Outlet context={{ profile, setProfile, onExpired }} />
    </>
  );
}

// The signed-in profile, a setter to update it, and the function to call when the session has ended.
export function useAuth() {
  return useOutletContext();
}
