// One group: members, events with who shares them, and recent expenses.
// Edit and delete (SCRUM-135) show only when the server allows this person to change the expense.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Logo from '../components/Logo.jsx';
import Message from '../components/Message.jsx';
import PersonName from '../components/PersonName.jsx';
import RecentExpenses from '../components/RecentExpenses.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getGroupEvents } from '../api/groups.js';
import { parseGroupId, useGroupMembers, useKnownGroup } from '../lib/groupHooks.js';
import { typeLabel } from '../lib/groupTypes.js';
import { labelsFor } from '../lib/people.js';
import { formatMoney, toCents } from '../lib/splits.js';
import { useOpenSet } from '../lib/useOpenSet.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// "12.50" -> "$12.50"; anything else is shown as it came.
const money = (amount) => {
  const cents = toCents(amount);
  return cents === null ? String(amount) : formatMoney(cents);
};

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
  const labels = labelsFor(members);
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
  const eventRows = useOpenSet(); // which events have their "Split between N people" open
  const [groupExpenses, setGroupExpenses] = useState([]); // the group's expenses, handed up by the Recent expenses card
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
            <Avatar text={title} large single />
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
          <RecentExpenses groupId={groupId} group={group} members={members} membersReady={status === 'ready'} onExpenses={setGroupExpenses} />

          <section className="panel" aria-labelledby="events-title">
            <div className="panel-head">
              <h2 id="events-title">Events</h2>
              <span className="panel-actions">
                <Link className="btn btn-ghost mini-btn" to={`/groups/${groupId}/events/new`} state={{ group }}>New event</Link>
                {eventsState.status === 'ready' && events.length > 0 && (
                  <button type="button" className="btn btn-ghost mini-btn" onClick={() => eventRows.toggleAll(events.map((ev) => ev.id))}>
                    {eventRows.allOpen(events.map((ev) => ev.id)) ? 'Collapse all' : 'Expand all'}
                  </button>
                )}
              </span>
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
                  const spent = groupExpenses.filter((e) => e.event_id === ev.id); // the expenses that belong to this event
                  // Everyone with a share of those expenses (from the server's shares), so the shares add up to the totals.
                  // The event's members come first. Someone the server put on an event expense who is NOT in the event is
                  // listed after them and marked, instead of being left out.
                  const sharers = [...new Set(spent.flatMap((e) => Object.keys(e.shares ?? {}).map(Number)))];
                  const everyone = [...ev.member_ids.filter((id) => labels[id]), ...sharers.filter((id) => !ev.member_ids.includes(id))];
                  const people = everyone.map((id) => {
                    const cents = spent.reduce((sum, e) => sum + (toCents(e.shares?.[id]) ?? 0), 0);
                    return { id, name: labels[id] ?? 'Former member', outside: !ev.member_ids.includes(id), share: spent.length > 0 ? formatMoney(cents) : '' };
                  });
                  const count = people.length;
                  return (
                    <li key={ev.id} className="row-item">
                      <Logo size={32} /> {/* the pie logo marks every event */}
                      <span className="row-grow">
                        <span className="row-title">{ev.name}</span>
                      </span>
                      {/* Same caret as the expenses: closed, "Split between N people"; open, each person with their circle. */}
                      <details className="exp-split" open={eventRows.isOpen(ev.id)} onToggle={(e) => eventRows.setOpen(ev.id, e.currentTarget.open)}>
                        <summary>{`Split between ${count} ${count === 1 ? 'person' : 'people'}`}</summary>
                        <ul className="exp-split-list ev-people" aria-label={`Members in ${ev.name}`}>
                          {people.map((p) => (
                            <li key={p.id}>
                              <Avatar text={p.name} />
                              <span className="ev-pname">
                                {p.name}
                                {p.outside && <span className="ev-out"> · not in this event</span>}
                              </span>
                              {p.share && <span className="ev-pshare">{p.share}</span>}
                            </li>
                          ))}
                        </ul>
                      </details>
                      <ul className="ev-exps" aria-label={`Expenses in ${ev.name}`}>
                        {spent.length === 0 && <li className="text-body-secondary small">No expenses yet</li>}
                        {spent.map((e) => (
                          <li key={e.id}>
                            <span className="ev-exp-name">
                              {e.description}
                              <span className="ev-exp-by"> · {labels[e.paid_by] ?? 'Former member'} paid</span>
                            </span>
                            <span className="ev-exp-amt">{money(e.amount)}</span>
                          </li>
                        ))}
                      </ul>
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
                  <Avatar text={labels[m.user_id]} />
                  <span className="row-grow row-title">
                    <PersonName label={labels[m.user_id]} email={m.email} />
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
