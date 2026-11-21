// Add expense screen (SCRUM-83, SCRUM-84): pick a group, enter a title and total, choose who paid and who is in,
// then split it evenly, by custom amounts or by percentage. Nothing is saved until "Save expense" is pressed.
// The same form edits an expense (SCRUM-135) when the page is opened with one in the router state.
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Avatar, { avatarClass } from '../components/Avatar.jsx';
import Icon from '../components/Icons.jsx';
import ExpenseDialog from '../components/ExpenseDialog.jsx';
import FlowTrace from '../components/FlowTrace.jsx';
import Message from '../components/Message.jsx';
import NotAvailable from '../components/NotAvailable.jsx';
import SplitWho from '../components/SplitWho.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { createExpense } from '../api/expenses.js';
import { getGroupEvents } from '../api/groups.js';
import { isNotAvailable, updateExpense } from '../api/proposed.js';
import { parseGroupId, useGroupMembers, useMyGroups, useSplitDefault } from '../lib/groupHooks.js';
import { labelsFor } from '../lib/people.js';

const MAX_STACK = 4; // avatars shown in the "who is in" box before it says +N
import { defaultBasisPoints } from '../lib/splitDefault.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { canChangeExpense } from '../lib/expensePermissions.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { validateExpenseTitle, validateExpenseTotal } from '../lib/expenseValidators.js';
import {
  calculateSplit,
  evenShares,
  formatBasisPoints,
  formatCents,
  formatMoney,
  splitValuesForRequest,
  toCents,
} from '../lib/splits.js';
import '../addExpense.css';

const METHODS = [
  { id: 'even', label: 'Even' },
  { id: 'custom', label: 'Custom' },
  { id: 'percentage', label: 'Percentage' },
];

// Opened at /expenses/new (pick a group) or /groups/:groupId/expenses/new (group already chosen).
export default function AddExpensePage() {
  const rawId = useParams().groupId; // group id from the address, if there is one
  const urlGroupId = rawId === undefined ? null : parseGroupId(rawId); // null when missing or not a number
  if (rawId !== undefined && urlGroupId === null) {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Link className="back-link" to="/groups">← Groups</Link>
        <Message kind="error" alert>That group address isn’t valid.</Message>
      </main>
    );
  }
  return <AddExpense urlGroupId={urlGroupId} />;
}

// Loads the user's groups first, then shows the form.
function AddExpense({ urlGroupId }) {
  const { status, groups, reload } = useMyGroups();
  if (status === 'loading') {
    return (
      <main className="page-wrap page-wrap--narrow">
        <p className="text-body-secondary mb-0" role="status">Loading your groups…</p>
      </main>
    );
  }
  if (status === 'error') {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Link className="back-link" to="/groups">← Groups</Link>
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load your groups. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
        </div>
      </main>
    );
  }
  return <AddExpenseForm urlGroupId={urlGroupId} known={groups} />;
}

// Group picker at the top, the expense form underneath. Changing the group switches the form to that group's members and default split.
function AddExpenseForm({ urlGroupId, known }) {
  const stateEdit = useLocation().state?.edit ?? null;
  const edit = stateEdit && stateEdit.group_id === urlGroupId ? stateEdit : null; // the expense being edited, if any
  const heading = edit ? 'Edit expense' : 'Add expense';
  usePageTitle(heading);
  const groupFieldId = useId(); // links the Group label to its dropdown
  const [title, setTitle] = useState(edit?.description ?? ''); // kept here so changing the group does not clear them
  const [totalText, setTotalText] = useState(edit ? String(edit.amount) : '');

  const inList = urlGroupId === null || known.some((g) => g.id === urlGroupId);
  const groups = inList ? known : [...known, { id: urlGroupId, name: 'Group', type: '' }]; // adds the group from the address
  const [groupId, setGroupId] = useState(urlGroupId ?? groups[0]?.id ?? null); // the group from the address, else the first one
  const group = groups.find((g) => g.id === groupId) ?? null;

  // No group at all: ask the user to create one first.
  if (groups.length === 0) {
    return (
      <main className="page-wrap page-wrap--narrow">
        <div>
          <Link className="back-link" to="/groups">← Groups</Link>
          <h1>Add expense</h1>
        </div>
        <section className="panel" aria-labelledby="no-group-title">
          <h2 id="no-group-title">You’re not in a group yet</h2>
          <p className="text-body-secondary mb-0">Create a group first, then add expenses to it.</p>
          <div className="btn-row">
            <Link className="btn btn-tint" to="/groups/new">Create group</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <div>
        <Link className="back-link" to={`/groups/${group.id}`} state={{ group }}>
          ← {group.name}
        </Link>
        <div className="add-top">
          <div className="add-top-main">
            <h1 className="title-case">{heading}</h1>
            {/* Where the expense goes, right under the heading: "in Apartment 4B" */}
            <div className="add-in">
              <label htmlFor={groupFieldId} className="visually-hidden">Group</label>
              <select
                id={groupFieldId}
                className="form-select"
                value={groupId}
                disabled={Boolean(edit)}
                onChange={(e) => setGroupId(Number(e.target.value))}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          {!edit && (
            <div className="seg how-seg" role="group" aria-label="How to add">
              <span className="on" aria-current="page"><Icon name="edit" size={16} /><span>Enter by <span className="cap">hand</span></span></span>
              <Link to={`/receipts/new?group=${group.id}`}><Icon name="scan" size={16} /><span>Scan a <span className="cap">receipt</span></span></Link>
            </div>
          )}
        </div>
      </div>

      <div className="add-grid">
      {/* key restarts the form when another group is chosen */}
      <ExpenseForm
        key={group.id}
        group={group}
        edit={edit}
        title={title}
        setTitle={setTitle}
        totalText={totalText}
        setTotalText={setTotalText}
      />
      </div>
    </main>
  );
}

// The group's default percentages for these people, as the text shown in the boxes ("50.00").
function percentTexts(saved, ids) {
  const points = defaultBasisPoints(saved, ids);
  return Object.fromEntries(ids.map((id) => [id, formatBasisPoints(points[id])]));
}

// The expense form for one group. It waits for the group's default split (from the server) so the form opens on it.
// If the default can't be loaded the form starts on an even split. Editing an expense does not need it.
function ExpenseForm(props) {
  const { status, saved } = useSplitDefault(props.group.id, !props.edit);
  if (status === 'loading') return <p className="text-body-secondary mb-0" role="status">Loading the group…</p>;
  return (
    <>
      {status === 'error' && <Message kind="info" role="status">We couldn’t load this group’s default split, so this expense starts on an even split.</Message>}
      <ExpenseFormFields {...props} saved={saved} />
    </>
  );
}

function ExpenseFormFields({ group, edit, saved, title, setTitle, totalText, setTotalText }) {
  const groupId = group.id;
  const navigate = useNavigate();
  const { profile, onExpired } = useAuth();
  const { status, members, reload } = useGroupMembers(groupId); // accepted members of the group
  const paidById = useId(); // links the Paid by label to its dropdown
  const eventFieldId = useId();
  const eventHelpId = useId();
  const editOffId = useId();

  // Editing starts from the saved expense: who paid, who is in, and each person's amount.
  const [payerId, setPayerId] = useState(edit?.paid_by ?? null); // who paid; null means you
  const [picked, setPicked] = useState(edit ? Object.keys(edit.shares ?? {}).map(Number) : null); // user ids in the split; null means everyone
  const [method, setMethod] = useState(edit ? 'custom' : saved.method); // 'even' | 'custom' | 'percentage'; starts on the group's default
  const [values, setValues] = useState(edit ? { ...(edit.shares ?? {}) } : null); // typed amounts or percentages, by user id; null until something is typed
  const [events, setEvents] = useState([]); // the group's events, for the event picker
  const [eventId, setEventId] = useState(edit?.event_id != null ? String(edit.event_id) : ''); // the chosen event, '' for none
  const [editOff, setEditOff] = useState(false); // the server can't save edits yet
  const [deleting, setDeleting] = useState(false); // the delete question is open (edit screen only)
  const [titleError, setTitleError] = useState('');
  const [totalError, setTotalError] = useState('');
  const [splitBlocked, setSplitBlocked] = useState(false); // true after Save was pressed with a split that does not add up
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusTick, setFocusTick] = useState(0); // goes up when Save is blocked, to focus the first problem
  const formRef = useRef(null);

  useEffect(() => {
    if (focusTick) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  // The event picker is optional, so a failed load just leaves it out.
  useEffect(() => {
    let cancelled = false;
    getGroupEvents(groupId)?.then?.((res) => {
      if (!cancelled && res?.ok && Array.isArray(res.data)) setEvents(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const allIds = members.map((m) => m.user_id);
  const participantIds = picked === null ? allIds : allIds.filter((id) => picked.includes(id)); // chosen people, in member order
  const paidBy = payerId ?? (allIds.includes(profile.id) ? profile.id : allIds[0] ?? null);
  const totalCents = toCents(totalText); // null while the total is not a valid amount
  // Until something is typed, percentage shows the group's default for the people in the split.
  const shownValues = values ?? (method === 'percentage' ? percentTexts(saved, participantIds) : {});
  const split = calculateSplit({ totalCents, memberIds: participantIds, method, values: shownValues });
  // Deleting lives here, for the people allowed to change this expense (same rule as before).
  const isAdmin = members.some((m) => m.user_id === profile.id && m.is_admin);
  const canDelete = Boolean(edit) && canChangeExpense({ expense: edit, myId: profile.id, isAdmin });
  const labels = labelsFor(members); // short names, like "Alice R.", instead of emails
  const emailOf = (id) => labels[id] ?? ''; // (the name is kept for the code below, it now holds the short name)
  const nobody = participantIds.length === 0;
  // The expense card is done once it has a title and a total. That is when the guide line appears.
  const done = validateExpenseTitle(title) === '' && validateExpenseTotal(totalText) === '';
  const expenseRef = useRef(null);

  // Adds or removes one person from the split.
  const toggle = (id) =>
    setPicked((list) => {
      const current = list ?? allIds;
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });

  // Starting numbers for custom (even amounts). Percentage and even start with nothing typed.
  function startingValues(next) {
    if (next === 'custom' && totalCents > 0 && participantIds.length) {
      const { shares } = evenShares(totalCents, participantIds);
      return Object.fromEntries(participantIds.map((id) => [id, formatCents(shares[id])]));
    }
    return null;
  }

  // Switches the split method. Even clears the typed numbers.
  function chooseMethod(next) {
    if (next === method) return;
    setValues(startingValues(next));
    setMethod(next);
    setSplitBlocked(false);
  }

  const setValue = (id, text) => setValues({ ...shownValues, [id]: text }); // stores what was typed for one person

  // Picking an event puts its members in the split. "No event" puts everyone back in.
  function chooseEvent(value) {
    setEventId(value);
    const event = events.find((ev) => String(ev.id) === value);
    // Only a real event changes who is in. Choosing "No event" leaves your picks alone.
    if (!event) return;
    setPicked(allIds.filter((id) => event.member_ids.includes(id)));
    setValues(null);
    if (method === 'custom') setMethod('even');
    setSplitBlocked(false);
  }

  // The count box: everyone is in -> take everyone out; otherwise put everyone in.
  const everyoneIn = participantIds.length === members.length;
  function toggleEveryone() {
    setPicked(everyoneIn ? [] : null);
    setValues(null);
    if (method === 'custom') setMethod('even');
    setSplitBlocked(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    const titleProblem = validateExpenseTitle(title);
    const totalProblem = validateExpenseTotal(totalText);
    setTitleError(titleProblem);
    setTotalError(totalProblem);
    if (titleProblem || totalProblem) {
      setFocusTick((n) => n + 1);
      return;
    }
    if (nobody || paidBy === null) return;
    if (!split.valid) {
      setSplitBlocked(true);
      setFocusTick((n) => n + 1);
      return;
    }

    setSubmitting(true);
    const send = edit ? (body) => updateExpense(edit.id, body) : createExpense;
    const res = await send({
      groupId,
      description: title,
      amount: formatCents(totalCents),
      paidBy,
      eventId: eventId === '' ? null : Number(eventId),
      participantIds,
      splitMethod: method,
      splitValues: splitValuesForRequest({ method, memberIds: participantIds, values: shownValues, shares: split.shares }),
    });
    if (res.status === 401) {
      onExpired();
      return;
    }
    if (edit && isNotAvailable(res)) {
      setSubmitting(false);
      setEditOff(true);
      return;
    }
    if (!res.ok) {
      setSubmitting(false);
      setSubmitError(messageFromResult(res, 'We couldn’t save the expense. Please try again.'));
      return;
    }
    const count = participantIds.length;
    const text = `Expense “${res.data?.description ?? title.trim()}” ${edit ? 'updated' : 'saved'}: ${formatMoney(totalCents)} shared by ${count} ${count === 1 ? 'person' : 'people'}.`;
    navigate(`/groups/${groupId}`, { state: { group, notices: [{ kind: 'ok', text }] } });
  }

  if (status === 'denied') {
    return <Message kind="error" alert>You can’t add an expense to this group. It may not exist, or you may not be an accepted member.</Message>;
  }

  // Numbers for the progress bar under the custom and percentage lists.
  const showBar = method !== 'even' && totalCents > 0 && !nobody;
  const barMax = method === 'custom' ? totalCents : 10000;
  const assigned = barMax - split.difference; // amount (cents) or percentage (basis points) given out so far
  const barPercent = showBar ? Math.min(100, Math.max(0, Math.round((assigned / barMax) * 100))) : 0;
  const barState = split.difference === 0 ? 'is-done' : split.difference < 0 ? 'is-over' : '';
  const assignedText = method === 'custom'
    ? `${formatMoney(assigned)} of ${formatMoney(totalCents ?? 0)}`
    : `${formatBasisPoints(assigned)}% of 100%`;
  const noneAreInvalid = split.invalidIds.length === 0; // true when every typed number can be read

  return (
    <form className="add-form" onSubmit={handleSubmit} noValidate aria-label={edit ? 'Edit expense' : 'Add expense'} ref={formRef}>
      <section className={`panel add-expense${done ? ' is-done' : ''}`} aria-labelledby="expense-title" ref={expenseRef}>
      <h2 id="expense-title" className="visually-hidden">The expense</h2>
      <TextField
        label="Title"
        variant="center"
        placeholder="What’s it for?"
        value={title}
        onChange={setTitle}
        onBlur={() => title && setTitleError(validateExpenseTitle(title))}
        error={titleError}
        autoComplete="off"
      />

      <TextField
        label="Total ($)"
        variant="hero"
        placeholder="0.00"
        value={totalText}
        onChange={setTotalText}
        onBlur={() => totalText && setTotalError(validateExpenseTotal(totalText))}
        error={totalError}
        inputMode="decimal"
        autoComplete="off"
      />

      {status === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading members…</p>}
      {status === 'error' && (
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load the members. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="field">
            <label htmlFor={paidById} className="form-label fw-semibold">Paid by</label>
            <select
              id={paidById}
              className="form-select form-select-lg"
              value={paidBy ?? ''}
              onChange={(e) => setPayerId(Number(e.target.value))}
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {labels[m.user_id]}{m.user_id === profile.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          {events.length > 0 && (
            <div className="field">
              <label htmlFor={eventFieldId} className="form-label fw-semibold">Event <span className="fw-normal text-body-secondary">(optional)</span></label>
              <select
                id={eventFieldId}
                className="form-select form-select-lg"
                value={eventId}
                aria-describedby={eventHelpId}
                onChange={(e) => chooseEvent(e.target.value)}
              >
                <option value="">No event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              <p id={eventHelpId} className="text-body-secondary small mt-1 mb-0">Picking an event puts its members in the split.</p>
            </div>
          )}

          <fieldset className="plain">
            <legend>Who is in this expense?</legend>
            {/* A tight box with the people who are in, overlapping (the same look as "Who's on this receipt?"). */}
            {/* Tap it to put everyone in, or (when everyone is in) take everyone out. */}
            <button
              type="button"
              className="who-summary"
              onClick={toggleEveryone}
            >
              <span className="stk" aria-hidden="true">
                {members.filter((m) => participantIds.includes(m.user_id)).slice(0, MAX_STACK).map((m) => <Avatar key={m.user_id} text={labels[m.user_id]} />)}
                {participantIds.length > MAX_STACK && <span className="av stk-more">{`+${participantIds.length - MAX_STACK}`}</span>}
              </span>
              <span>{everyoneIn ? `Everyone (${members.length})` : `${participantIds.length} of ${members.length}`}</span>
              <span className="who-hint">{`. Tap to ${everyoneIn ? 'take everyone out' : 'put everyone in'}`}</span>
            </button>
            <ul className="chip-list" aria-label="Members">
              {members.map((m) => {
                const on = participantIds.includes(m.user_id);
                return (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      className={`chip${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggle(m.user_id)}
                    >
                      <Avatar text={labels[m.user_id]} />
                      {labels[m.user_id]}{m.user_id === profile.id ? ' (you)' : ''}
                    </button>
                  </li>
                );
              })}
            </ul>
            {nobody && (
              <p className="error text-danger small mt-2 mb-0" role="alert">Pick at least one person to split with.</p>
            )}
          </fieldset>

        </>
      )}
      </section>

      <section className={`panel add-split${done ? ' is-next' : ''}`} aria-labelledby="split-title">
      {done && <FlowTrace sourceRef={expenseRef} />}
      <h2 id="split-title">How to split it</h2>
      {status === 'ready' && (
        <>
          <div className="plain">
            <div className="seg split-seg" role="group" aria-label="Split method">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={method === m.id ? 'is-on' : ''}
                  aria-pressed={method === m.id}
                  onClick={() => chooseMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* One coloured piece per person, as wide as their share (equal when the split is even). Same colours as their avatars. */}
            {!nobody && (
              <div className="split-microbar" aria-hidden="true">
                {(() => {
                  const weights = participantIds.map((id) => split.shares?.[id] ?? 0);
                  const flat = weights.every((w) => w === 0);
                  return participantIds.map((id, i) => <i key={id} className={avatarClass(labels[id])} style={{ flexGrow: flat ? 1 : weights[i] }} />);
                })()}
              </div>
            )}
            <p className="text-body-secondary small mt-2 mb-0">
              Group default: {saved.method === 'percentage' ? 'percentage' : 'even'}. You can pick another split for this expense.
            </p>

            {!nobody && (
              <ul className="split-list mt-3" aria-label="Each person’s share">
                {participantIds.map((id) => {
                  const email = emailOf(id);
                  const share = split.shares?.[id]; // cents, or undefined when no preview yet
                  const invalid = split.invalidIds.includes(id); // typed text could not be read
                  const unbalanced = splitBlocked && !split.valid && noneAreInvalid; // Save was blocked by the totals
                  const errorId = `split-err-${id}`;
                  return (
                    <li key={id} className={`split-row${method === 'even' ? '' : ' split-row--edit'}`}>
                      <SplitWho email={email} you={id === profile.id} />

                      {method === 'custom' && (
                        <div className="input-group split-field">
                          <span className="input-group-text" aria-hidden="true">$</span>
                          <input
                            className={`form-control${invalid ? ' is-invalid' : ''}`}
                            value={shownValues[id] ?? ''}
                            onChange={(e) => setValue(id, e.target.value)}
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`Amount for ${email}`}
                            aria-invalid={invalid || unbalanced ? 'true' : 'false'}
                            aria-describedby={invalid ? errorId : undefined}
                          />
                        </div>
                      )}

                      {method === 'percentage' && (
                        <>
                          <div className="input-group split-field">
                            <input
                              className={`form-control${invalid ? ' is-invalid' : ''}`}
                              value={shownValues[id] ?? ''}
                              onChange={(e) => setValue(id, e.target.value)}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`Percentage for ${email}`}
                              aria-invalid={invalid || unbalanced ? 'true' : 'false'}
                              aria-describedby={invalid ? errorId : undefined}
                            />
                            <span className="input-group-text" aria-hidden="true">%</span>
                          </div>
                          <span className="split-amount">{share === undefined ? '—' : formatMoney(share)}</span>
                        </>
                      )}

                      {method === 'even' && (
                        <span className="split-amount">
                          {share === undefined ? '—' : formatMoney(share)}
                          {split.adjustedIds.includes(id) && (
                            <>
                              <span className="split-extra" aria-hidden="true">+1¢</span>
                              <span className="visually-hidden">, includes an extra cent</span>
                            </>
                          )}
                        </span>
                      )}

                      {invalid && (
                        <p id={errorId} className="error text-danger small w-100 m-0" role="alert">
                          {method === 'custom' ? 'Enter dollars and cents, like 12.50.' : 'Enter a number from 0 to 100.'}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {method === 'even' && split.adjustedIds.length > 0 && (
              <p className="text-body-secondary small mt-2 mb-0" role="status">
                {split.adjustedIds.length} leftover {split.adjustedIds.length === 1 ? 'cent' : 'cents'} added to{' '}
                {split.adjustedIds.length === 1 ? emailOf(split.adjustedIds[0]) : `the first ${split.adjustedIds.length} people`}.
              </p>
            )}

            {showBar && (
              <div className="mt-3">
                <div
                  className={`split-bar ${barState}`}
                  role="progressbar"
                  aria-label={method === 'custom' ? 'Amount assigned' : 'Percentage assigned'}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={barPercent}
                  aria-valuetext={assignedText}
                >
                  <span style={{ width: `${barPercent}%` }} />
                </div>
                <p className="split-summary" role="status">
                  <span>{assignedText}</span>
                  {noneAreInvalid && split.message && <span className="is-bad">{split.message}</span>}
                </p>
              </div>
            )}
          </div>
        </>
      )}
      {status !== 'ready' && <p className="text-body-secondary mb-0">The split shows up once the members have loaded.</p>}

      {splitBlocked && !split.valid && (
        <Message kind="error" alert>Can’t save yet. {split.message}</Message>
      )}
      {submitError && <Message kind="error" alert>{submitError}</Message>}
      {editOff && <NotAvailable id={editOffId}>Editing an expense isn’t available yet. Nothing was changed.</NotAvailable>}

      <div className="btn-row">
        <button type="submit" className="btn btn-tint btn-shine" disabled={submitting || status !== 'ready' || editOff} aria-describedby={editOff ? editOffId : undefined}>
          <span className="btn-text">{submitting ? 'Saving expense…' : edit ? 'Save changes' : 'Save expense'}</span>
        </button>
        <Link className="btn btn-ghost" to={`/groups/${groupId}`} state={{ group }}>Cancel</Link>
        {canDelete && (
          <button type="button" className="btn btn-danger-outline" onClick={() => setDeleting(true)}>Delete expense</button>
        )}
      </div>
      </section>
      {deleting && (
        <ExpenseDialog
          expense={edit}
          groupName={group.name}
          nameOf={(id) => (id === profile.id ? 'You' : emailOf(id) || 'Former member')}
          canChange
          startOnDelete
          onEdit={() => {}}
          onDeleted={(e) =>
            navigate(`/groups/${groupId}`, { state: { group, notices: [{ kind: 'ok', text: `Expense “${e.description}” deleted. Balances are updated.` }] } })
          }
          onExpired={onExpired}
          onClose={() => setDeleting(false)}
        />
      )}
    </form>
  );
}
