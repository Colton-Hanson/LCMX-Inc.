import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import PendingInvites from '../components/PendingInvites.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getMyGroups } from '../api/groups.js';
import { typeLabel } from '../lib/groupTypes.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Everyone you share expenses with: invitations waiting for an answer, then your groups from the server, plus a way to create a new one.
export default function GroupsPage() {
  usePageTitle('Groups');
  const { onExpired } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [groups, setGroups] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the reply if the page was closed first
    getMyGroups().then((res) => {
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (!res.ok || !Array.isArray(res.data)) return setStatus('error');
      setGroups(res.data);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, onExpired]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <main className="page-wrap">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <h1>Groups</h1>
          <p className="text-body-secondary mt-1 mb-0">Everyone you share expenses with.</p>
        </div>
        <Link className="btn btn-tint d-inline-flex align-items-center justify-content-center" to="/groups/new">Create group</Link>
      </div>

      <PendingInvites onJoined={reload} />

      {status === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading your groups…</p>}

      {status === 'error' && (
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load your groups. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
        </div>
      )}

      {status === 'ready' && groups.length === 0 && (
        <section className="panel">
          <p className="text-body-secondary mb-0">
            You’re not in a group yet. Create one, or accept an invitation, and it shows up here.
          </p>
        </section>
      )}

      {status === 'ready' && groups.length > 0 && (
        <ul className="group-grid" aria-label="Your groups">
          {groups.map((g) => (
            <li key={g.id}>
              <Link className="group-card" to={`/groups/${g.id}`} state={{ group: { id: g.id, name: g.name, type: g.group_type } }}>
                <span className="group-card-top">
                  <Avatar text={g.name} large />
                  <span className="pill">{typeLabel(g.group_type)}</span>
                </span>
                <span className="group-card-name">{g.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
