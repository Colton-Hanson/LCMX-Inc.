// Add expense screen (SCRUM-83, SCRUM-84): pick a group, enter a title and total, choose who paid and who is in,
// then split it evenly, by custom amounts or by percentage. Nothing is saved until "Save expense" is pressed.
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import SplitWho from '../components/SplitWho.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { createExpense } from '../api/expenses.js';
import { getKnownGroups } from '../lib/groupCache.js';
import { parseGroupId, useGroupMembers } from '../lib/groupHooks.js';
import { defaultBasisPoints, getSplitDefault } from '../lib/splitDefault.js';
import { messageFromResult } from '../lib/apiErrors.js';
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

// Group picker at the top, the expense form underneath. Changing the group switches the form to that group's members and default split.
function AddExpense({ urlGroupId }) {
  usePageTitle('Add expense');
  const { profile } = useAuth();
  const groupFieldId = useId(); // links the Group label to its dropdown
  const [title, setTitle] = useState(''); // kept here so changing the group does not clear them
  const [totalText, setTotalText] = useState('');

  // WORKAROUND(no list routes): START. The group list is the one this browser has saved. See lib/groupCache.js.
  const known = getKnownGroups(profile.id);
  // WORKAROUND(no list routes): END
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
    <main className="page-wrap page-wrap--narrow">
      <div>
        <Link className="back-link" to={`/groups/${group.id}`} state={{ group }}>
          ← {group.name}
        </Link>
        <h1>Add expense</h1>
        <p className="text-body-secondary mt-1 mb-0">Enter what was spent and how it is shared.</p>
      </div>

      <div className="panel">
        <div className="field">
          <label htmlFor={groupFieldId} className="form-label fw-semibold">Group</label>
          <select
            id={groupFieldId}
            className="form-select form-select-lg"
            value={groupId}
            onChange={(e) => setGroupId(Number(e.target.value))}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* key restarts the form when another group is chosen */}
      <ExpenseForm
        key={group.id}
        group={group}
        title={title}
        setTitle={setTitle}
        totalText={totalText}
        setTotalText={setTotalText}
      />
    </main>
  );
}

// The group's default percentages for these people, as the text shown in the boxes ("50.00").
function percentTexts(saved, ids) {
  const points = defaultBasisPoints(saved, ids);
  return Object.fromEntries(ids.map((id) => [id, formatBasisPoints(points[id])]));
}

// The expense form for one group.
function ExpenseForm({ group, title, setTitle, totalText, setTotalText }) {
  const groupId = group.id;
  const saved = getSplitDefault(groupId); // the group's default split, set in Group settings
  const navigate = useNavigate();
  const { profile, onExpired } = useAuth();
  const { status, members, reload } = useGroupMembers(groupId); // accepted members of the group
  const paidById = useId(); // links the Paid by label to its dropdown

  const [payerId, setPayerId] = useState(null); // who paid; null means you
  const [picked, setPicked] = useState(null); // user ids in the split; null means everyone
  const [method, setMethod] = useState(saved.method); // 'even' | 'custom' | 'percentage'; starts on the group's default
  const [values, setValues] = useState(null); // typed amounts or percentages, by user id; null until something is typed
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

  const allIds = members.map((m) => m.user_id);
  const participantIds = picked === null ? allIds : allIds.filter((id) => picked.includes(id)); // chosen people, in member order
  const paidBy = payerId ?? (allIds.includes(profile.id) ? profile.id : allIds[0] ?? null);
  const totalCents = toCents(totalText); // null while the total is not a valid amount
  // Until something is typed, percentage shows the group's default for the people in the split.
  const shownValues = values ?? (method === 'percentage' ? percentTexts(saved, participantIds) : {});
  const split = calculateSplit({ totalCents, memberIds: participantIds, method, values: shownValues });
  const emailOf = (id) => members.find((m) => m.user_id === id)?.email ?? '';
  const nobody = participantIds.length === 0;

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
    const res = await createExpense({
      groupId,
      description: title,
      amount: formatCents(totalCents),
      paidBy,
      participantIds,
      splitMethod: method,
      splitValues: splitValuesForRequest({ method, memberIds: participantIds, values: shownValues, shares: split.shares }),
    });
    if (res.status === 401) {
      onExpired();
      return;
    }
    if (!res.ok) {
      setSubmitting(false);
      setSubmitError(messageFromResult(res, 'We couldn’t save the expense. Please try again.'));
      return;
    }
    const count = participantIds.length;
    const text = `Expense “${res.data.description}” saved: ${formatMoney(totalCents)} shared by ${count} ${count === 1 ? 'person' : 'people'}.`;
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
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label="Add expense" ref={formRef}>
      <TextField
        label="Title"
        value={title}
        onChange={setTitle}
        onBlur={() => title && setTitleError(validateExpenseTitle(title))}
        error={titleError}
        autoComplete="off"
      />

      <TextField
        label="Total ($)"
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
                  {m.email}{m.user_id === profile.id ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="plain">
            <legend>Who is in this expense?</legend>
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
                      <Avatar text={m.email} />
                      {m.email}{m.user_id === profile.id ? ' (you)' : ''}
                    </button>
                  </li>
                );
              })}
            </ul>
            {nobody && (
              <p className="error text-danger small mt-2 mb-0" role="alert">Pick at least one person to split with.</p>
            )}
          </fieldset>

          <fieldset className="plain">
            <legend>How to split it</legend>
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
          </fieldset>
        </>
      )}

      {splitBlocked && !split.valid && (
        <Message kind="error" alert>Can’t save yet. {split.message}</Message>
      )}
      {submitError && <Message kind="error" alert>{submitError}</Message>}

      <div className="btn-row">
        <button type="submit" className="btn btn-tint" disabled={submitting || status !== 'ready'}>
          {submitting ? 'Saving expense…' : 'Save expense'}
        </button>
        <Link className="btn btn-ghost" to={`/groups/${groupId}`} state={{ group }}>Cancel</Link>
      </div>
    </form>
  );
}
