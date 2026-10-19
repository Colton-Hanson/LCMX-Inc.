import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getPendingInvitations, acceptInvitation, declineInvitation } from '../api/groups.js';
import { getKnownGroups, rememberGroup } from '../lib/groupCache.js';
import { typeLabel } from '../lib/groupTypes.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// "Good morning, <first name>": the first word of the profile name, or the start of the email when there is no name.
function greeting(profile) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const first = (profile.name ?? '').trim().split(/\s+/)[0] || profile.email.split('@')[0];
  return `Good ${part}, ${first}`;
}

// Page shown after signing in. The login check and top bar come from RequireAuth.
// Shows the groups this browser knows about and the invitations waiting for an answer. Answering an invitation
// updates the page right away, so an accepted group shows up in "Your groups" without a refresh.
export default function HomePage() {
  usePageTitle('Home');
  const { profile, onExpired } = useAuth();

  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [invites, setInvites] = useState([]); // [{ group_id, group_name, group_type }]
  // WORKAROUND(no list routes): START. "Your groups" can't come from the server (no GET /groups), so it starts from the list this
  // browser remembers. Replace with a real request when that route exists. See lib/groupCache.js.
  const [groups, setGroups] = useState(() => getKnownGroups(profile.id));
  // WORKAROUND(no list routes): END
  const [busyId, setBusyId] = useState(null); // group id of the invitation being answered
  const [message, setMessage] = useState(''); // confirmation shown after an answer
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0); // goes up when the user presses "Try again"
  const messageRef = useRef(null);

  useEffect(() => {
    let cancelled = false; // ignore the response if the page was closed first
    setLoadState('loading');
    getPendingInvitations().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setInvites(res.data);
        setLoadState('ready');
      } else if (res.status === 401) {
        onExpired();
      } else {
        setLoadState('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, onExpired]);

  // After an answer the button the user pressed is gone, so move focus to the confirmation message.
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const respond = useCallback(
    async (invite, accept) => {
      setBusyId(invite.group_id);
      setError('');
      setMessage('');
      const res = await (accept ? acceptInvitation : declineInvitation)(invite.group_id);
      setBusyId(null);
      if (res.status === 401) {
        onExpired();
        return;
      }
      // 404 means the invitation is already gone (answered somewhere else, or withdrawn), so it leaves the list too.
      if (!res.ok && res.status !== 404) {
        setError(messageFromResult(res, 'We couldn’t answer that invitation. Please try again.'));
        return;
      }
      setInvites((list) => list.filter((i) => i.group_id !== invite.group_id));
      if (!res.ok) {
        setMessage(`The invitation to ${invite.group_name} is no longer available.`);
      } else if (accept) {
        // WORKAROUND(no list routes): START. The user just joined, so remember the group in this browser; that's how it shows up
        // under "Your groups" right away without a refresh. See lib/groupCache.js.
        setGroups(rememberGroup(profile.id, { id: invite.group_id, name: invite.group_name, type: invite.group_type }));
        // WORKAROUND(no list routes): END
        setMessage(`You joined ${invite.group_name}.`);
      } else {
        setMessage(`You declined the invitation to ${invite.group_name}.`);
      }
    },
    [onExpired, profile.id]
  );

  return (
    <main className="page-wrap">
      <div>
        <h1>{greeting(profile)}</h1>
        <p className="text-body-secondary mt-1 mb-0">Here is what is happening across your groups.</p>
      </div>

      <section className="panel" aria-labelledby="groups-title">
        <div className="panel-head">
          <h2 id="groups-title">Your groups</h2>
          <Link className="link-strong" to="/groups">See all</Link>
        </div>
        {groups.length === 0 ? (
          <div className="d-flex flex-column align-items-start gap-3">
            <p className="text-body-secondary mb-0">You are not in any groups on this device yet. Groups you create or join show up here.</p>
            <Link className="btn btn-tint" to="/groups/new">Create group</Link>
          </div>
        ) : (
          <ul className="list-unstyled m-0">
            {groups.map((g) => (
              <li key={g.id}>
                <Link className="row-item" to={`/groups/${g.id}`} state={{ group: g }}>
                  <Avatar text={g.name} large />
                  <span className="row-grow">
                    <span className="row-title">{g.name}</span>
                    <span className="pill">{typeLabel(g.type)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <Message kind="ok" boxRef={messageRef} tabIndex={-1}>
          {message}
        </Message>
      )}
      {error && <Message kind="error" alert>{error}</Message>}

      {loadState === 'error' && (
        <section className="panel" aria-labelledby="invites-title">
          <h2 id="invites-title">Pending invites</h2>
          <Message kind="error" alert>We couldn’t load your invitations. Check your connection and try again.</Message>
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </div>
        </section>
      )}

      {loadState === 'loading' && <p className="visually-hidden" role="status">Loading your invitations…</p>}

      {loadState === 'ready' && invites.length > 0 && (
        <section className="panel" aria-labelledby="invites-title">
          <h2 id="invites-title">Pending invites</h2>
          <ul className="list-unstyled m-0">
            {invites.map((invite) => (
              <li key={invite.group_id} className="row-item">
                <Avatar text={invite.group_name} large />
                <span className="row-grow">
                  <span className="row-title">You’re invited to join {invite.group_name}</span>
                  <span className="pill">{typeLabel(invite.group_type)}</span>
                </span>
                <span className="btn-row">
                  <button
                    type="button"
                    className="btn btn-tint btn-s"
                    aria-label={`Accept invitation to ${invite.group_name}`}
                    disabled={busyId !== null}
                    onClick={() => respond(invite, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-s"
                    aria-label={`Decline invitation to ${invite.group_name}`}
                    disabled={busyId !== null}
                    onClick={() => respond(invite, false)}
                  >
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
