import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { createEvent } from '../api/groups.js';
import { parseGroupId, useGroupMembers, useKnownGroup } from '../lib/groupHooks.js';
import { rememberEvent } from '../lib/eventCache.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { validateEventName } from '../lib/validators.js';

export default function CreateEventPage() {
  const groupId = parseGroupId(useParams().groupId);
  if (groupId === null) {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Link className="back-link" to="/groups">← Groups</Link>
        <Message kind="error" alert>That group address isn’t valid.</Message>
      </main>
    );
  }
  return <EventForm groupId={groupId} />;
}

// Create event screen: a name, and who is in the event (everyone, or a chosen few). The button stays off while
// nobody is selected. Nothing is saved until "Create event" is pressed, so Cancel (a plain link) discards it all.
function EventForm({ groupId }) {
  usePageTitle('New event');
  const navigate = useNavigate();
  const { profile, onExpired } = useAuth();
  const group = useKnownGroup(groupId);
  const { status, members, reload } = useGroupMembers(groupId);

  const [name, setName] = useState('');
  const [mode, setMode] = useState('all'); // 'all' | 'pick'
  const [picked, setPicked] = useState([]); // user ids chosen in 'pick' mode
  const [nameError, setNameError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusTick, setFocusTick] = useState(0); // bumped when a submit is blocked, to focus the first invalid field
  const formRef = useRef(null);

  useEffect(() => {
    if (focusTick) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  const backTo = `/groups/${groupId}`;
  const memberIds = mode === 'all' ? members.map((m) => m.user_id) : picked;
  const nobody = memberIds.length === 0;
  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    const problem = validateEventName(name);
    setNameError(problem);
    if (problem) {
      setFocusTick((n) => n + 1);
      return;
    }
    if (nobody) return;

    setSubmitting(true);
    const res = await createEvent({ name, groupId, memberIds });
    if (res.status === 401) {
      onExpired();
      return;
    }
    if (!res.ok) {
      setSubmitting(false);
      setSubmitError(messageFromResult(res, 'We couldn’t create the event. Please try again.'));
      return;
    }
    // WORKAROUND(no list routes): START. The backend can't list events, so remember this one in this browser so the group page can
    // show it. Only this browser will ever see it. Delete when a list-events route exists. See lib/eventCache.js.
    rememberEvent(profile.id, groupId, { id: res.data.id, name: res.data.name, count: res.data.member_ids.length, all: mode === 'all' });
    // WORKAROUND(no list routes): END
    const text = `Event “${res.data.name}” created for ${res.data.member_ids.length} ${res.data.member_ids.length === 1 ? 'member' : 'members'}.`;
    navigate(backTo, { state: { group, notices: [{ kind: 'ok', text }] } });
  }

  if (status === 'denied') {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Link className="back-link" to="/groups">← Groups</Link>
        <Message kind="error" alert>You can’t add an event to this group. It may not exist, or you may not be an accepted member.</Message>
      </main>
    );
  }

  return (
    <main className="page-wrap page-wrap--narrow">
      <div>
        <Link className="back-link" to={backTo} state={{ group }}>← {group?.name ?? 'Group'}</Link>
        <h1>New event</h1>
        <p className="text-body-secondary mt-1 mb-0">A smaller circle inside the group, for expenses only some members share.</p>
      </div>

      <form className="panel" onSubmit={handleSubmit} noValidate aria-label="New event" ref={formRef}>
        <TextField
          label="Event name"
          value={name}
          onChange={setName}
          onBlur={() => name && setNameError(validateEventName(name))}
          error={nameError}
          autoComplete="off"
        />

        <fieldset className="plain">
          <legend>Who is in this event?</legend>
          <div className="seg" role="group" aria-label="Who is in this event">
            <button type="button" className={mode === 'all' ? 'is-on' : ''} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
              All members
            </button>
            <button type="button" className={mode === 'pick' ? 'is-on' : ''} aria-pressed={mode === 'pick'} onClick={() => setMode('pick')}>
              Pick members
            </button>
          </div>

          {status === 'loading' && <p className="text-body-secondary mt-3 mb-0" role="status">Loading members…</p>}
          {status === 'error' && (
            <div className="mt-3 d-flex flex-column align-items-start gap-3">
              <Message kind="error" alert>We couldn’t load the members. Check your connection and try again.</Message>
              <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
            </div>
          )}
          {status === 'ready' && mode === 'pick' && (
            <ul className="chip-list mt-3" aria-label="Members">
              {members.map((m) => (
                <li key={m.user_id}>
                  <button type="button" className={`chip${picked.includes(m.user_id) ? ' is-on' : ''}`} aria-pressed={picked.includes(m.user_id)} onClick={() => toggle(m.user_id)}>
                    <Avatar text={m.email} />
                    {m.email}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {status === 'ready' && mode === 'all' && (
            <p className="text-body-secondary mt-3 mb-0">
              Everyone in the group is in this event ({members.length} {members.length === 1 ? 'member' : 'members'}).
            </p>
          )}
        </fieldset>

        {status === 'ready' && nobody && <Message kind="error" alert>Pick at least one member to create this event.</Message>}

        <Message kind="info">
          <p>Once it is created, you can tag an expense to this event instead of the whole group.</p>
        </Message>

        {submitError && <Message kind="error" alert>{submitError}</Message>}

        <div className="btn-row">
          <button type="submit" className="btn btn-tint" disabled={submitting || status !== 'ready' || nobody}>
            {submitting ? 'Creating event…' : 'Create event'}
          </button>
          <Link className="btn btn-ghost" to={backTo} state={{ group }}>Cancel</Link>
        </div>
      </form>
    </main>
  );
}
