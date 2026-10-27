// Pending invitations card, used on the Home and Groups pages.
// Loads GET /groups/invitations/pending and shows each invitation with Accept and Decline.
// Answering updates the card right away; an accepted group is added to the saved list and passed to onJoined.
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import Logo from './Logo.jsx';
import Message from './Message.jsx';
import { useAuth } from './RequireAuth.jsx';
import { getPendingInvitations, acceptInvitation, declineInvitation } from '../api/groups.js';
import { rememberGroup } from '../lib/groupCache.js';
import { messageFromResult } from '../lib/apiErrors.js';
import '../invites.css';

// showTitle  false keeps the "Pending invites" heading for screen readers only
// onJoined   called with the saved group list after an invitation is accepted
export default function PendingInvites({ showTitle = true, onJoined }) {
  const { profile, onExpired } = useAuth();
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [invites, setInvites] = useState([]); // [{ group_id, group_name, group_type }]
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
        onJoined?.(rememberGroup(profile.id, { id: invite.group_id, name: invite.group_name, type: invite.group_type }));
        // WORKAROUND(no list routes): END
        setMessage(`You joined ${invite.group_name}.`);
      } else {
        setMessage(`You declined the invitation to ${invite.group_name}.`);
      }
    },
    [onExpired, onJoined, profile.id]
  );

  return (
    <>
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
          <h2 id="invites-title" className={showTitle ? undefined : 'visually-hidden'}>Pending invites</h2>
          <ul className="list-unstyled m-0 invite-list">
            {invites.map((invite) => (
              <li key={invite.group_id} className="row-item">
                <Avatar text={invite.group_name} large />
                <p className="row-grow invite-text">
                  You’re invited to join{' '}
                  <strong className="invite-name">
                    <Logo size={18} />
                    <span>{invite.group_name}</span>
                  </strong>
                  .
                </p>
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
    </>
  );
}
