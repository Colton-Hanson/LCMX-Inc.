// Balances screen (SCRUM-85, SCRUM-136): who owes you and who you owe, from GET /balances,
// with Pay, Mark received and the settlement history. Settling only records a payment made outside the app.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import ExpenseActions from '../components/ExpenseActions.jsx';
import ExpenseDialog from '../components/ExpenseDialog.jsx';
import Icon from '../components/Icons.jsx';
import Message from '../components/Message.jsx';
import NotAvailable from '../components/NotAvailable.jsx';
import SettleDialog from '../components/SettleDialog.jsx';
import ExpandText from '../components/receipt/ExpandText.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getBalances, getGroupExpenses } from '../api/expenses.js';
import { getMembers } from '../api/groups.js';
import { getGroupSettlements, isNotAvailable, recordSettlement } from '../api/proposed.js';
import { buildBalances, FORMER_MEMBER } from '../lib/balances.js';
import { canChangeExpense } from '../lib/expensePermissions.js';
import { getKnownGroups } from '../lib/groupCache.js';
import { historyText, manualKeys, newestFirst, shortDate } from '../lib/settle.js';
import { formatCents, formatMoney, toCents } from '../lib/splits.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import '../balances.css';
import '../receipt.css';
import '../sprint7.css';

// Loads the balances, then the members and expenses of every group in them (ids become emails, and each row gets its expense lines).
//   status  'loading' | 'ready' | 'error'
//   data    the rows and totals from buildBalances, plus emailsByGroup, expensesByGroup and adminGroups (null until ready)
//   reload  tries again (keeps showing the old rows while it loads)
function useBalances() {
  const { profile, onExpired } = useAuth();
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the replies if the page was closed first
    setStatus((s) => (s === 'ready' ? s : 'loading'));
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
      const adminGroups = {};
      groupIds.forEach((id, i) => {
        emailsByGroup[id] = Object.fromEntries(memberRes[i].data.map((m) => [m.user_id, m.email]));
        adminGroups[id] = memberRes[i].data.some((m) => m.user_id === profile.id && m.is_admin);
      });
      // WORKAROUND(no list routes): START. There is no group-detail route, so group names come from this browser's saved list.
      const groupNames = Object.fromEntries(getKnownGroups(profile.id).map((g) => [g.id, g.name]));
      // WORKAROUND(no list routes): END
      // A group whose expenses didn't load still shows its rows, just without the expense lines.
      const expensesByGroup = {};
      groupIds.forEach((id, i) => {
        if (expenseRes[i]?.ok && Array.isArray(expenseRes[i].data)) expensesByGroup[id] = expenseRes[i].data;
      });
      setData({
        ...buildBalances({ balances: res.data, emailsByGroup, groupNames, expensesByGroup, myId: profile.id }),
        emailsByGroup,
        expensesByGroup,
        adminGroups,
        groupIds,
      });
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, onExpired, profile.id]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, data, reload };
}

// Loads the settlement history. The server lists them one group at a time, so this asks each group and
// puts the results together, newest first.
//   state  'loading' | 'ready' | 'off' (the server can't do it) | 'error'
function useSettlements(groupIds) {
  const { onExpired } = useAuth();
  const [history, setHistory] = useState({ state: 'loading', list: [] });
  const [attempt, setAttempt] = useState(0);
  const key = groupIds.join(','); // a stable value to watch

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    Promise.all(key.split(',').map((id) => getGroupSettlements(id))).then((results) => {
      if (cancelled) return;
      if (results.some((r) => r.status === 401)) return onExpired();
      const failed = results.find((r) => !r.ok);
      if (failed) return setHistory({ state: isNotAvailable(failed) ? 'off' : 'error', list: [] });
      const list = results.flatMap((r) => (Array.isArray(r.data) ? r.data : [])).sort(newestFirst);
      setHistory({ state: 'ready', list });
    });
    return () => {
      cancelled = true;
    };
  }, [key, attempt, onExpired]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { history, reload };
}

// "+$12.50" or "−$12.50" (a real minus sign); a zero amount has no sign.
const signed = (cents, sign) => (cents > 0 ? sign : '') + formatMoney(cents);

const SHOWN_LINES = 3; // expense lines shown in the row before "+N more"

// "Lunch $8.33", or "TV for house −$119.16" when the expense reduces the amount.
const lineText = (l) => `${l.title} ${l.offset ? '−' : ''}${formatMoney(l.cents)}`;

// The line under a person's name: the group, then the expenses behind the amount.
// Opens to the full list, where each expense can be opened, and edited or deleted by people allowed to.
//   expense(line)  the full expense for a line, or undefined
//   allowed(expense)  true when you may change it
function RowDetail({ row, expense, allowed, onOpen, onEdit }) {
  const { lines, groupName } = row;
  if (lines.length === 0) return <span className="row-sub">{groupName}</span>;
  const more = lines.length - SHOWN_LINES;
  const hasOffset = lines.some((l) => l.offset);
  const text = `${groupName} · ${lines.slice(0, SHOWN_LINES).map(lineText).join(', ')}${more > 0 ? ` +${more} more` : ''}`;
  return (
    <details className="bal-detail">
      <summary>{text}</summary>
      <ul className="bal-lines">
        {lines.map((l) => (
          <li key={l.id}>
            <span>
              {expense(l) ? (
                <button type="button" className="exp-open" aria-haspopup="dialog" onClick={() => onOpen(expense(l), false)}>{l.title}</button>
              ) : l.title}
            </span>
            <span>{`${l.offset ? '−' : ''}${formatMoney(l.cents)}`}</span>
            {expense(l) && allowed(expense(l)) && (
              <ExpenseActions title={l.title} onEdit={() => onEdit(expense(l))} onDelete={() => onOpen(expense(l), true)} />
            )}
          </li>
        ))}
      </ul>
      {hasOffset && <p className="bal-note">Amounts with a minus take away from the total.</p>}
      {row.settled && <p className="bal-note">Settlements are included in the balance.</p>}
    </details>
  );
}

const CheckIcon = () => (
  <svg className="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

// One person's row: who, the group and expenses, the amount, and Pay or Mark received.
function BalanceRow({ row, kind, manual, onSettle, detail }) {
  const owes = kind === 'owe';
  const paidUp = kind === 'paid';
  return (
    <li className="row-item bal-row">
      <Avatar text={row.name} large />
      <div className="row-grow">
        {/* The name can be cut short with a caret. The words around it always stay whole. */}
        <div className="bal-title row-title">
          {paidUp && <span className="one-line">You and</span>}
          {owes && <span className="bal-verb one-line">You owe</span>}{' '}
          <ExpandText>{row.name}</ExpandText>{' '}
          {kind === 'owed' && <span className="bal-verb one-line">owes you</span>}
          {paidUp && <span className="one-line">are paid up</span>}
        </div>
        <RowDetail row={row} {...detail} />
      </div>
      <div className="bal-side">
        <span className={`bal-amount ${paidUp ? 'bal-mute' : owes ? 'bal-neg' : 'bal-pos'}`}>
          {paidUp ? formatMoney(0) : signed(row.cents, owes ? '−' : '+')}
        </span>
        {manual && <span className="pill-state pill-manual"><CheckIcon />Received (manual)</span>}
        {paidUp && <span className="pill-state pill-paid"><CheckIcon />Paid</span>}
        {owes && (
          <button type="button" className="btn btn-ghost btn-s" aria-label={`Pay ${row.name}`} onClick={(e) => onSettle(row, true, e.currentTarget)}>
            Pay
          </button>
        )}
        {kind === 'owed' && (
          <button type="button" className="chk" aria-label={`Mark received from ${row.name}`} onClick={(e) => onSettle(row, false, e.currentTarget)}>
            <span className="box" aria-hidden="true" />
            Mark received
          </button>
        )}
      </div>
    </li>
  );
}

// The settlement history card.
function History({ history, myId, names, groupNames, onRetry }) {
  return (
    <section className="panel bal-hist" aria-labelledby="hist-title">
      <h2 id="hist-title">Settlement history</h2>
      {history.state === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading history…</p>}
      {history.state === 'off' && <NotAvailable>Settlement history isn’t available yet. Payments you record will show here.</NotAvailable>}
      {history.state === 'error' && (
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load the history. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={onRetry}>Try again</button>
        </div>
      )}
      {history.state === 'ready' && history.list.length === 0 && (
        <p className="text-body-secondary mb-0">No payments recorded yet.</p>
      )}
      {history.state === 'ready' && history.list.length > 0 && (
        <ul className="list-unstyled mb-0">
          {history.list.map((s) => {
            const other = s.paid_by === myId ? s.recipient : s.paid_by;
            const cents = toCents(s.amount);
            return (
              <li className="hist-row" key={s.id}>
                <Avatar text={names[s.group_id]?.[other] ?? '?'} />
                <div className="hist-body">
                  <p>{historyText(s, myId, names[s.group_id])}</p>
                  <p className="sm-mute">{groupNames[s.group_id] ?? `Group ${s.group_id}`}</p>
                </div>
                <div className="hist-end">
                  <p className="hist-amount">{cents === null ? String(s.amount) : formatMoney(cents)}</p>
                  <p className="sm-mute">{shortDate(s.settlement_time)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const TITLES = { owed: 'Who owes you', owe: 'Who you owe', all: 'Between you and others' };

// The whole screen once the balances are loaded. Takes its data and actions as props so it can be previewed.
//   onRecord({ row, owes, cents })  saves a settlement, resolves to the API result
//   onChanged  called after one is saved, to load the new balances
//   removeExpense  the delete call (the preview page passes its own)
export function BalancesView({ data, history, myId, onRecord, onChanged, onRetryHistory, removeExpense, onExpired }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null); // { expense, del } for the expense details dialog
  const [view, setView] = useState(() => (data.owedToYou.length === 0 && data.youOwe.length > 0 ? 'owe' : 'owed'));
  const [dialog, setDialog] = useState(null); // { row, owes }
  const [off, setOff] = useState(false); // the server can't record payments yet
  const [note, setNote] = useState('');
  const noteRef = useRef(null);

  useEffect(() => {
    if (note) noteRef.current?.focus();
  }, [note]);

  const manual = manualKeys(history.list, myId);
  const groupNames = {};
  [...data.owedToYou, ...data.youOwe, ...data.paidUp].forEach((r) => {
    groupNames[r.groupId] = r.groupName;
  });
  const rows = [
    ...(view !== 'owe' ? data.owedToYou.map((row) => ({ row, kind: 'owed' })) : []),
    ...(view !== 'owed' ? data.youOwe.map((row) => ({ row, kind: 'owe' })) : []),
    ...(view !== 'owed' ? data.paidUp.map((row) => ({ row, kind: 'paid' })) : []),
  ];
  const empty = view === 'owed' ? 'Nobody owes you right now.' : view === 'owe' ? 'You don’t owe anyone right now.' : 'Nothing between you and others right now.';

  const expenseOf = (groupId) => (line) => (data.expensesByGroup?.[groupId] ?? []).find((e) => e.id === line.id);
  const allowed = (e) => canChangeExpense({ expense: e, myId, isAdmin: Boolean(data.adminGroups?.[e.group_id]) });
  const editExpense = (e) =>
    navigate(`/groups/${e.group_id}/expenses/new`, { state: { group: { id: e.group_id, name: groupNames[e.group_id] ?? 'Group', type: '' }, edit: e } });
  const nameOf = (groupId) => (id) => (id === myId ? 'You' : data.emailsByGroup?.[groupId]?.[id] ?? FORMER_MEMBER);

  function done(paid, left) {
    const { row } = dialog;
    setDialog(null);
    setNote(
      `${formatMoney(paid)} marked as paid with ${row.name}. It is in the settlement history for both of you.${left > 0 ? ` ${formatMoney(left)} is still outstanding.` : ''}`
    );
    onChanged();
  }

  return (
    <>
      <section className="bal-totals" aria-label="Totals">
        <div className={`panel bal-tab${view === 'owed' ? ' is-on' : ''}`}>
          <button type="button" className="bal-tab-btn" aria-pressed={view === 'owed'} aria-label={`Show who owes you. Owed to you ${formatMoney(data.owedTotal)}`} onClick={() => setView('owed')}>
            <span className="bal-label">Owed to you</span>
            <span className={`bal-value${data.owedTotal > 0 ? ' bal-pos' : ''}`}>{signed(data.owedTotal, '+')}</span>
          </button>
        </div>
        <div className={`panel bal-tab${view === 'owe' ? ' is-on' : ''}`}>
          <button type="button" className="bal-tab-btn" aria-pressed={view === 'owe'} aria-label={`Show who you owe. You owe ${formatMoney(data.oweTotal)}`} onClick={() => setView('owe')}>
            <span className="bal-label">You owe</span>
            <span className={`bal-value${data.oweTotal > 0 ? ' bal-neg' : ''}`}>{signed(data.oweTotal, '−')}</span>
          </button>
          <button type="button" className="btn btn-ghost bal-both" aria-pressed={view === 'all'} onClick={() => setView(view === 'all' ? 'owe' : 'all')}>
            <Icon name="filter" size={16} />
            Show both
          </button>
        </div>
      </section>

      {note && <Message kind="ok" role="status" boxRef={noteRef} tabIndex={-1}>{note}</Message>}
      {data.owedTotal === 0 && data.oweTotal === 0 && <Message kind="ok">You’re all paid up.</Message>}

      <div className="bal-cols">
        <section className="panel bal-main" aria-labelledby="bal-list">
          <h2 id="bal-list">{TITLES[view]}</h2>
          {rows.length === 0 ? (
            <p className="text-body-secondary mb-0">{empty}</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {rows.map(({ row, kind }) => (
                <BalanceRow
                  key={`${kind}-${row.key}`}
                  row={row}
                  kind={kind}
                  manual={kind === 'owed' && manual.has(row.key)}
                  onSettle={(r, owes) => setDialog({ row: r, owes })}
                  detail={{ expense: expenseOf(row.groupId), allowed, onOpen: (expense, del) => setOpen({ expense, del }), onEdit: editExpense }}
                />
              ))}
            </ul>
          )}
          <p className="bal-foot">
            This app does not move money. “Pay” records that a payment was made outside the app. A yellow Received (manual) pill means you marked it received yourself.
          </p>
        </section>

        <History history={history} myId={myId} names={data.emailsByGroup ?? {}} groupNames={groupNames} onRetry={onRetryHistory} />
      </div>

      {open && (
        <ExpenseDialog
          key={`${open.expense.id}-${open.del}`}
          expense={open.expense}
          groupName={groupNames[open.expense.group_id] ?? 'this group'}
          nameOf={nameOf(open.expense.group_id)}
          canChange={allowed(open.expense)}
          startOnDelete={open.del}
          remove={removeExpense}
          onEdit={editExpense}
          onDeleted={(e) => {
            setOpen(null);
            setNote(`Expense “${e.description}” deleted. Balances are updated.`);
            onChanged();
          }}
          onExpired={onExpired}
          onClose={() => setOpen(null)}
        />
      )}

      {dialog && (
        <SettleDialog
          row={dialog.row}
          owes={dialog.owes}
          off={off}
          onRecord={(cents) => onRecord({ row: dialog.row, owes: dialog.owes, cents })}
          onOff={() => setOff(true)}
          onDone={done}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

export default function BalancesPage() {
  usePageTitle('Balances');
  const { profile, onExpired } = useAuth();
  const { status, data, reload } = useBalances();
  const { history, reload: reloadHistory } = useSettlements(data?.groupIds ?? []);

  // You pay them, or they paid you.
  async function record({ row, owes, cents }) {
    const res = await recordSettlement({
      groupId: row.groupId,
      paidBy: owes ? profile.id : row.userId,
      recipient: owes ? row.userId : profile.id,
      amount: formatCents(cents),
    });
    if (res.status === 401) {
      onExpired();
      return null;
    }
    return res;
  }

  return (
    <main className="page-wrap bal-page s7">
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
        <BalancesView
          data={data}
          history={history}
          myId={profile.id}
          onRecord={record}
          onChanged={() => {
            reload();
            reloadHistory();
          }}
          onRetryHistory={reloadHistory}
          onExpired={onExpired}
        />
      )}
    </main>
  );
}
