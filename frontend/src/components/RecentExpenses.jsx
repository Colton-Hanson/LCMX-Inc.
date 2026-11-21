// Recent expenses card for the group page: the newest expenses of the group, from GET /groups/{id}/expenses.
// Each row shows the title, who paid, the date, the total and your own share, and opens to everyone's share.
// Tapping the title opens the details. Edit and Delete show only for people allowed to change the expense.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import ExpenseActions from './ExpenseActions.jsx';
import ExpenseDialog from './ExpenseDialog.jsx';
import ExpandText from './receipt/ExpandText.jsx';
import Message from './Message.jsx';
import { useAuth } from './RequireAuth.jsx';
import { getGroupExpenses } from '../api/expenses.js';
import { FORMER_MEMBER } from '../lib/balances.js';
import { canChangeExpense } from '../lib/expensePermissions.js';
import { labelsFor, personLabel } from '../lib/people.js';
import { useOpenSet } from '../lib/useOpenSet.js';
import { formatMoney, toCents } from '../lib/splits.js';
import '../groupExpenses.css';
import '../receipt.css';
import '../sprint7.css';

const SHOWN = 5; // how many expenses the card lists

// "Oct 30" in the viewer's own time zone, or '' if the date can't be read.
function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "12.50" -> "$12.50". Anything that isn't dollars and cents is shown as it came.
const money = (amount) => {
  const cents = toCents(amount);
  return cents === null ? String(amount) : formatMoney(cents);
};

// members      the group's accepted members [{ user_id, email }] (used to turn paid_by into an email)
// membersReady false until the member list has loaded
// load, remove  the list and delete calls (the preview page passes its own)
// onExpenses   optional: called with the full list whenever it loads or changes (the Events card on the same page uses it)
export default function RecentExpenses({ groupId, group, members, membersReady, load = getGroupExpenses, remove, onExpenses }) {
  const { profile, onExpired } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(null); // { expense, del } for the details dialog
  const [note, setNote] = useState('');
  const noteRef = useRef(null);
  const isAdmin = members.some((m) => m.user_id === profile.id && m.is_admin);

  useEffect(() => {
    if (note) noteRef.current?.focus();
  }, [note]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [expenses, setExpenses] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onExpenses?.(expenses);
  }, [expenses]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the list changes

  useEffect(() => {
    let cancelled = false; // ignore the reply if the page was closed first
    setStatus('loading');
    load(groupId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setExpenses(res.data);
        setStatus('ready');
      } else if (res.status === 401) {
        onExpired();
      } else {
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, attempt, onExpired, load]);

  const names = labelsFor(members); // short names instead of emails
  const payerEmail = (id) => (id === profile.id ? personLabel(profile) : names[id] ?? FORMER_MEMBER);
  const payerName = (id) => (id === profile.id ? 'You' : payerEmail(id));

  // Everyone in the split with their amount: the payer first, then by name.
  const splitPeople = (e) =>
    Object.entries(e.shares ?? {})
      .map(([id, amount]) => ({ id, name: payerName(Number(id)), amount: money(amount), payer: Number(id) === e.paid_by }))
      .sort((a, b) => b.payer - a.payer || a.name.localeCompare(b.name));

  // Which "Split between N people" rows are open, and the ids that can be opened (for Expand all / Collapse all).
  const rows = useOpenSet();
  const splitIds = status === 'ready' && membersReady ? expenses.slice(0, SHOWN).filter((e) => splitPeople(e).length > 1).map((e) => e.id) : [];

  return (
    <section className="panel" aria-labelledby="expenses-title">
      <div className="panel-head">
        <h2 id="expenses-title">Recent expenses</h2>
        {splitIds.length > 0 && (
          <button type="button" className="btn btn-ghost mini-btn" onClick={() => rows.toggleAll(splitIds)}>
            {rows.allOpen(splitIds) ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>
      {note && <Message kind="ok" role="status" boxRef={noteRef} tabIndex={-1}>{note}</Message>}

      {(status === 'loading' || (status === 'ready' && !membersReady)) && (
        <p className="text-body-secondary mb-0" role="status">Loading expenses…</p>
      )}

      {status === 'error' && (
        <>
          <Message kind="error" alert>We couldn’t load the expenses. Check your connection and try again.</Message>
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </div>
        </>
      )}

      {status === 'ready' && membersReady && expenses.length === 0 && (
        <>
          <p className="text-body-secondary mb-0">No expenses yet. Add the first one for this group.</p>
          <div className="btn-row">
            <Link className="btn btn-ghost" to={`/groups/${groupId}/expenses/new`} state={{ group }}>Add expense</Link>
          </div>
        </>
      )}

      {status === 'ready' && membersReady && expenses.length > 0 && (
        <>
          <ul className="list-unstyled mb-0">
            {expenses.slice(0, SHOWN).map((e) => {
              const name = payerName(e.paid_by);
              const share = e.shares?.[profile.id];
              const people = splitPeople(e);
              const allowed = canChangeExpense({ expense: e, myId: profile.id, isAdmin });
              return (
                <li className="row-item" key={e.id}>
                  <Avatar text={payerEmail(e.paid_by)} />
                  <div className="row-grow">
                    <ExpandText className="row-title">
                      <button type="button" className="exp-open" aria-haspopup="dialog" onClick={() => setOpen({ expense: e, del: false })}>{e.description}</button>
                    </ExpandText>
                    <span className="row-sub">{`${name} paid. ${shortDate(e.created_at)}`.trim()}</span>
                  </div>
                  <div className="exp-amount-col">
                    <span className="exp-amount">{money(e.amount)}</span>
                    <span className="row-sub">{share === undefined ? 'Not in this split' : `Your share ${money(share)}`}</span>
                  </div>
                  {allowed && (
                    <ExpenseActions
                      title={e.description}
                      onEdit={() => navigate(`/groups/${groupId}/expenses/new`, { state: { group, edit: e } })}
                      onDelete={() => setOpen({ expense: e, del: true })}
                    />
                  )}
                  {people.length > 1 && (
                    <details className="exp-split" open={rows.isOpen(e.id)} onToggle={(ev) => rows.setOpen(e.id, ev.currentTarget.open)}>
                      <summary>{`Split between ${people.length} people`}</summary>
                      <ul className="exp-split-list">
                        {people.map((p) => (
                          <li key={p.id}>
                            <span>{p.name}</span>
                            <span>{p.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          {expenses.length > SHOWN && (
            <p className="text-body-secondary small mb-0">{`Showing the ${SHOWN} newest of ${expenses.length}.`}</p>
          )}
        </>
      )}
      {open && (
        <ExpenseDialog
          key={`${open.expense.id}-${open.del}`}
          expense={open.expense}
          groupName={group?.name ?? 'this group'}
          nameOf={payerName}
          canChange={canChangeExpense({ expense: open.expense, myId: profile.id, isAdmin })}
          startOnDelete={open.del}
          remove={remove}
          onEdit={(e) => navigate(`/groups/${groupId}/expenses/new`, { state: { group, edit: e } })}
          onDeleted={(e) => {
            setOpen(null);
            setNote(`Expense “${e.description}” deleted. Balances are updated.`);
            setAttempt((n) => n + 1);
          }}
          onExpired={onExpired}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
