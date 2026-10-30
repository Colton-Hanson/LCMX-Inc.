// Recent expenses card for the group page: the newest expenses of the group, from GET /groups/{id}/expenses.
// Each row shows the title, who paid, the date, the total and your own share, and opens to everyone's share.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Message from './Message.jsx';
import { useAuth } from './RequireAuth.jsx';
import { getGroupExpenses } from '../api/expenses.js';
import { FORMER_MEMBER } from '../lib/balances.js';
import { formatMoney, toCents } from '../lib/splits.js';
import '../groupExpenses.css';

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
export default function RecentExpenses({ groupId, group, members, membersReady }) {
  const { profile, onExpired } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [expenses, setExpenses] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the reply if the page was closed first
    setStatus('loading');
    getGroupExpenses(groupId).then((res) => {
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
  }, [groupId, attempt, onExpired]);

  const emails = Object.fromEntries(members.map((m) => [m.user_id, m.email]));
  const payerEmail = (id) => (id === profile.id ? profile.email : emails[id] ?? FORMER_MEMBER);
  const payerName = (id) => (id === profile.id ? 'You' : payerEmail(id));

  // Everyone in the split with their amount: the payer first, then by name.
  const splitPeople = (e) =>
    Object.entries(e.shares ?? {})
      .map(([id, amount]) => ({ id, name: payerName(Number(id)), amount: money(amount), payer: Number(id) === e.paid_by }))
      .sort((a, b) => b.payer - a.payer || a.name.localeCompare(b.name));

  return (
    <section className="panel" aria-labelledby="expenses-title">
      <h2 id="expenses-title">Recent expenses</h2>

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
              return (
                <li className="row-item" key={e.id}>
                  <Avatar text={payerEmail(e.paid_by)} />
                  <div className="row-grow">
                    <span className="row-title">{e.description}</span>
                    <span className="row-sub">{`${name} paid. ${shortDate(e.created_at)}`.trim()}</span>
                  </div>
                  <div className="exp-amount-col">
                    <span className="exp-amount">{money(e.amount)}</span>
                    <span className="row-sub">{share === undefined ? 'Not in this split' : `Your share ${money(share)}`}</span>
                  </div>
                  {people.length > 1 && (
                    <details className="exp-split">
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
    </section>
  );
}
