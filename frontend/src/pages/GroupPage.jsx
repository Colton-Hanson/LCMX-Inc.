import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import RecentExpenses from '../components/RecentExpenses.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getGroupEvents } from '../api/groups.js';
import { parseGroupId, useGroupMembers, useKnownGroup } from '../lib/groupHooks.js';
import { typeLabel } from '../lib/groupTypes.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Shown when the address has no valid group id, or the user can't open the group.
function Unavailable({ children }) {
  return (
    <main className="page-wrap page-wrap--narrow">
      <Link className="back-link" to="/groups">← Groups</Link>
      <Message kind="error" alert>{children}</Message>
    </main>
  );
}

// The group's own page: who is in it, and where to go next (new event, group settings).
// Messages from the page that sent the user here (invites sent, an event created) arrive in the router state.
export default function GroupPage() {
  const groupId = parseGroupId(useParams().groupId);
  if (groupId === null) {
    return <Unavailable>That group address isn’t valid.</Unavailable>;
  }
  return <GroupDetails groupId={groupId} />;
}

function GroupDetails({ groupId }) {
  const { profile, onExpired } = useAuth();
  const { state, pathname } = useLocation();
  const navigate = useNavigate();
  const group = useKnownGroup(groupId);
  const { status, members, reload } = useGroupMembers(groupId);
  const title = group?.name ?? 'Group';
  usePageTitle(title);

  // Messages from the page that sent the user here show once. They are copied out of the router state, then the
  // state is cleared, so a refresh or coming back later doesn't show a stale "Invite sent" after it was accepted.
  const [notices] = useState(() => state?.notices ?? []);
  useEffect(() => {
    if (state?.notices) navigate(pathname, { replace: true, state: { group: state.group } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The group's events come from the server.
  const [eventsState, setEventsState] = useState({ status: 'loading', list: [] }); // status: 'loading' | 'ready' | 'error'
  const [eventsAttempt, setEventsAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false; // ignore the reply if the page was closed first
    getGroupEvents(groupId).then((res) => {
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (!res.ok || !Array.isArray(res.data)) return setEventsState({ status: 'error', list: [] });
      setEventsState({ status: 'ready', list: res.data });
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, eventsAttempt, onExpired]);
  const events = eventsState.list;

  if (status === 'denied') {
    return <Unavailable>You can’t open this group. It may not exist, or you may not be an accepted member.</Unavailable>;
  }

  return (
    <main className="page-wrap">
      <div>
        <Link className="back-link" to="/groups">← Groups</Link>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <Avatar text={title} large />
            <div>
              <h1>{title}</h1>
              <p className="text-body-secondary small mb-0">
                {group && <span className="pill me-2">{typeLabel(group.type)}</span>}
                {status === 'ready' && `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
              </p>
            </div>
          </div>
          <div className="btn-row group-actions">
            <Link className="btn btn-tint" to={`/groups/${groupId}/expenses/new`} state={{ group }}>Add expense</Link>
            <Link className="btn btn-ghost" to={`/groups/${groupId}/events/new`} state={{ group }}>New event</Link>
            <Link className="btn btn-ghost" to={`/groups/${groupId}/settings`} state={{ group }}>Group settings</Link>
          </div>
        </div>
      </div>

      {notices.map((n) => (
        <Message key={n.text} kind={n.kind} alert={n.kind === 'error'}>{n.text}</Message>
      ))}

      <div className="d-flex flex-wrap gap-4 align-items-start">
        {/* Left column: the group's expenses, then its events. */}
        <div className="d-flex flex-column gap-4" style={{ flex: '1 1 480px', minWidth: 0 }}>
          <RecentExpenses groupId={groupId} group={group} members={members} membersReady={status === 'ready'} />

          <section className="panel" aria-labelledby="events-title">
            <div className="panel-head">
              <h2 id="events-title">Events</h2>
              <Link className="btn btn-ghost btn-s" to={`/groups/${groupId}/events/new`} state={{ group }}>New event</Link>
            </div>
            <p className="text-body-secondary mb-0">
              An event is a smaller circle inside the group, for expenses only some members share.
            </p>
            {eventsState.status === 'loading' && <p className="text-body-secondary mt-3 mb-0" role="status">Loading events…</p>}
            {eventsState.status === 'error' && (
              <div className="d-flex flex-column align-items-start gap-3 mt-3">
                <Message kind="error" alert>We couldn’t load the events. Check your connection and try again.</Message>
                <button type="button" className="btn btn-ghost" onClick={() => setEventsAttempt((n) => n + 1)}>Try again</button>
              </div>
            )}
            {eventsState.status === 'ready' && events.length > 0 && (
              <ul className="list-unstyled m-0 mt-3">
                {events.map((ev) => {
                  const count = ev.member_ids.length;
                  const all = status === 'ready' && count === members.length;
                  return (
                    <li key={ev.id} className="row-item">
                      <Avatar text={ev.name} />
                      <span className="row-grow">
                        <span className="row-title">{ev.name}</span>
                        <span className="d-block text-body-secondary small">
                          {all ? 'All members' : `${count} ${count === 1 ? 'member' : 'members'}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="panel" aria-labelledby="members-title" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 id="members-title">Members</h2>
          {status === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading members…</p>}
          {status === 'error' && (
            <>
              <Message kind="error" alert>We couldn’t load the members. Check your connection and try again.</Message>
              <div>
                <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
              </div>
            </>
          )}
          {status === 'ready' && (
            <ul className="list-unstyled m-0">
              {members.map((m) => (
                <li key={m.user_id} className="row-item">
                  <Avatar text={m.email} />
                  <span className="row-grow row-title">
                    {m.email}
                    {m.user_id === profile.id && ' (you)'}
                  </span>
                  <span className={`pill${m.is_admin ? ' pill--primary' : ''}`}>{m.is_admin ? 'Admin' : 'Member'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
