import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getKnownEvents } from '../lib/eventCache.js';
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
  const { profile } = useAuth();
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

  // WORKAROUND(no list routes): START. There is no "list events" route, so the Events card shows only events THIS browser created.
  // Remove when the backend can list a group's events. See lib/eventCache.js.
  const events = getKnownEvents(profile.id, groupId);
  // WORKAROUND(no list routes): END

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
          <div className="btn-row">
            <Link className="btn btn-ghost" to={`/groups/${groupId}/events/new`} state={{ group }}>New event</Link>
            <Link className="btn btn-ghost" to={`/groups/${groupId}/settings`} state={{ group }}>Group settings</Link>
          </div>
        </div>
      </div>

      {notices.map((n) => (
        <Message key={n.text} kind={n.kind} alert={n.kind === 'error'}>{n.text}</Message>
      ))}

      <div className="d-flex flex-wrap gap-4 align-items-start">
        <section className="panel" aria-labelledby="events-title" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="panel-head">
            <h2 id="events-title">Events</h2>
            <Link className="btn btn-ghost btn-s" to={`/groups/${groupId}/events/new`} state={{ group }}>New event</Link>
          </div>
          <p className="text-body-secondary mb-0">
            An event is a smaller circle inside the group, for expenses only some members share.
          </p>
          {/* WORKAROUND(no list routes): the events list below is fed by this browser's saved events (lib/eventCache.js). */}
          {events.length > 0 && (
            <ul className="list-unstyled m-0 mt-3">
              {events.map((ev) => (
                <li key={ev.id} className="row-item">
                  <Avatar text={ev.name} />
                  <span className="row-grow">
                    <span className="row-title">{ev.name}</span>
                    <span className="d-block text-body-secondary small">
                      {ev.all ? 'All members' : `${ev.count} ${ev.count === 1 ? 'member' : 'members'}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
