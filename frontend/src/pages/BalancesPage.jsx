// Balances screen (SCRUM-85): who owes you and who you owe, from GET /balances.
// One row per person per group, with the totals first and the two directions in separate lists.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Message from '../components/Message.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getBalances, getGroupExpenses } from '../api/expenses.js';
import { getMembers } from '../api/groups.js';
import { buildBalances } from '../lib/balances.js';
import { getKnownGroups } from '../lib/groupCache.js';
import { formatMoney } from '../lib/splits.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import '../balances.css';

// Loads the balances, then the members and expenses of every group in them (ids become emails, and each row gets its expense lines).
//   status  'loading' | 'ready' | 'error'
//   data    the rows and totals from buildBalances (null until ready)
//   reload  tries again
function useBalances() {
  const { profile, onExpired } = useAuth();
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the replies if the page was closed first
    setStatus('loading');
    (async () => {
      const res = await getBalances();
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (!res.ok) return setStatus('error');

      // One members request and one expenses request per group (not per row).
      const groupIds = [...new Set((res.data?.group_balances ?? []).map((b) => b.group_id))];
      const [memberRes, expenseRes] = await Promise.all([
        Promise.all(groupIds.map((id) => getMembers(id))),
        Promise.all(groupIds.map((id) => getGroupExpenses(id))),
      ]);
      if (cancelled) return;
      if (memberRes.some((r) => r.status === 401) || expenseRes.some((r) => r?.status === 401)) return onExpired();
      if (memberRes.some((r) => !r.ok)) return setStatus('error');

      const emailsByGroup = {};
      groupIds.forEach((id, i) => {
        emailsByGroup[id] = Object.fromEntries(memberRes[i].data.map((m) => [m.user_id, m.email]));
      });
      // WORKAROUND(no list routes): START. There is no group-detail route, so group names come from this browser's saved list.
      const groupNames = Object.fromEntries(getKnownGroups(profile.id).map((g) => [g.id, g.name]));
      // WORKAROUND(no list routes): END
      // A group whose expenses didn't load still shows its rows, just without the expense lines.
      const expensesByGroup = {};
      groupIds.forEach((id, i) => {
        if (expenseRes[i]?.ok && Array.isArray(expenseRes[i].data)) expensesByGroup[id] = expenseRes[i].data;
      });
      setData(buildBalances({ balances: res.data, emailsByGroup, groupNames, expensesByGroup, myId: profile.id }));
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, onExpired, profile.id]);

  return { status, data, reload: () => setAttempt((n) => n + 1) };
}

// "+$12.50" or "−$12.50" (a real minus sign); a zero amount has no sign.
const signed = (cents, sign) => (cents > 0 ? sign : '') + formatMoney(cents);

// One of the two big totals at the top.
function Total({ label, cents, sign, tone }) {
  return (
    <div className="panel bal-total">
      <p className="bal-label">{label}</p>
      <p className={`bal-value${cents > 0 ? ` bal-${tone}` : ''}`}>{signed(cents, sign)}</p>
    </div>
  );
}

const SHOWN_LINES = 3; // expense lines shown in the row before "+N more"

// "Lunch $8.33", or "TV for house −$119.16" when the expense reduces the amount.
const lineText = (l) => `${l.title} ${l.offset ? '−' : ''}${formatMoney(l.cents)}`;

// The line under a person's name: the group, then the expenses behind the amount.
// Opens to the full list when there are more than 3 or one of them reduces the amount.
function RowDetail({ row }) {
  const { lines, groupName } = row;
  if (lines.length === 0) return <span className="row-sub">{groupName}</span>;
  const more = lines.length - SHOWN_LINES;
  const hasOffset = lines.some((l) => l.offset);
  const text = `${groupName} · ${lines.slice(0, SHOWN_LINES).map(lineText).join(', ')}${more > 0 ? ` +${more} more` : ''}`;
  if (more <= 0 && !hasOffset) return <span className="row-sub">{text}</span>;
  return (
    <details className="bal-detail">
      <summary>{text}</summary>
      <ul className="bal-lines">
        {lines.map((l) => (
          <li key={l.id}>
            <span>{l.title}</span>
            <span>{`${l.offset ? '−' : ''}${formatMoney(l.cents)}`}</span>
          </li>
        ))}
      </ul>
      {hasOffset && <p className="bal-note">Amounts with a minus take away from the total.</p>}
    </details>
  );
}

// One list of people. `line` builds the sentence from the name; `tone` picks the green or red amount.
function BalanceList({ id, title, rows, empty, line, sign, tone }) {
  return (
    <section className="panel" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-body-secondary mb-0">{empty}</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {rows.map((r) => (
            <li className="row-item" key={r.key}>
              <Avatar text={r.name} large />
              <div className="row-grow">
                <span className="row-title">{line(r.name)}</span>
                <RowDetail row={r} />
              </div>
              <span className={`bal-amount bal-${tone}`}>{signed(r.cents, sign)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function BalancesPage() {
  usePageTitle('Balances');
  const { status, data, reload } = useBalances();

  return (
    <main className="page-wrap bal-page">
      <div>
        <h1>Balances</h1>
        <p className="text-body-secondary mb-0">Who owes who across your groups.</p>
      </div>

      {status === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading balances…</p>}

      {status === 'error' && (
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load your balances. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
        </div>
      )}

      {status === 'ready' && !data.hasRows && (
        <section className="panel" aria-labelledby="bal-none">
          <h2 id="bal-none">No balances yet</h2>
          <p className="text-body-secondary mb-0">Once an expense is added to a group, who owes who shows up here.</p>
          <div className="btn-row">
            <Link className="btn btn-ghost" to="/expenses/new">Add expense</Link>
          </div>
        </section>
      )}

      {status === 'ready' && data.hasRows && (
        <>
          <section className="bal-totals" aria-label="Totals">
            <Total label="Owed to you" cents={data.owedTotal} sign="+" tone="pos" />
            <Total label="You owe" cents={data.oweTotal} sign="−" tone="neg" />
          </section>

          {data.owedTotal === 0 && data.oweTotal === 0 && <Message kind="ok">You’re all paid up.</Message>}

          <div className="bal-lists">
            <BalanceList
              id="bal-owed"
              title="Owes you"
              rows={data.owedToYou}
              empty="Nobody owes you right now."
              line={(name) => (
                <>
                  {name} <span className="bal-verb">owes you</span>
                </>
              )}
              sign="+"
              tone="pos"
            />
            <BalanceList
              id="bal-owe"
              title="You owe"
              rows={data.youOwe}
              empty="You don’t owe anyone right now."
              line={(name) => (
                <>
                  <span className="bal-verb">You owe</span> {name}
                </>
              )}
              sign="−"
              tone="neg"
            />
          </div>
        </>
      )}
    </main>
  );
}
