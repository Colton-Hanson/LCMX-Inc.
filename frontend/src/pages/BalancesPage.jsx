// Balances screen (SCRUM-85, SCRUM-136): who owes you and who you owe, from GET /balances,
// with Pay, Mark received and the settlement history. Settling only records a payment made outside the app.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import ExpenseDialog from '../components/ExpenseDialog.jsx';
import Icon from '../components/Icons.jsx';
import Message from '../components/Message.jsx';
import NotAvailable from '../components/NotAvailable.jsx';
import SettleDialog from '../components/SettleDialog.jsx';
import PersonName from '../components/PersonName.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getBalances, getGroupExpenses } from '../api/expenses.js';
import { getMembers, getMyGroups } from '../api/groups.js';
import { getGroupSettlements, isNotAvailable, recordSettlement } from '../api/proposed.js';
import { buildBalances, FORMER_MEMBER } from '../lib/balances.js';
import { canChangeExpense } from '../lib/expensePermissions.js';
import { labelsFor } from '../lib/people.js';
import { formatDay, historyText, newestFirst, receivedThisMonth, toDate } from '../lib/settle.js';
import { formatCents, formatMoney, toCents } from '../lib/splits.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import '../balances.css';
import '../receipt.css';
import '../sprint7.css';

// Loads the balances, then the members and expenses of every group in them (ids become short names, and each row gets its expense lines).
//   status  'loading' | 'ready' | 'error'
//   data    the rows and totals from buildBalances, plus namesByGroup, emailsByGroup, expensesByGroup and adminGroups (null until ready)
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
      const [memberRes, expenseRes, groupsRes] = await Promise.all([
        Promise.all(groupIds.map((id) => getMembers(id))),
        Promise.all(groupIds.map((id) => getGroupExpenses(id))),
        getMyGroups(),
      ]);
      if (cancelled) return;
      if (groupsRes?.status === 401 || memberRes.some((r) => r.status === 401) || expenseRes.some((r) => r?.status === 401)) return onExpired();
      if (memberRes.some((r) => !r.ok)) return setStatus('error');

      const emailsByGroup = {}; // full emails, shown only when a name is tapped
      const namesByGroup = {}; // the short names shown everywhere else
      const adminGroups = {};
      groupIds.forEach((id, i) => {
        emailsByGroup[id] = Object.fromEntries(memberRes[i].data.map((m) => [m.user_id, m.email]));
        namesByGroup[id] = labelsFor(memberRes[i].data);
        adminGroups[id] = memberRes[i].data.some((m) => m.user_id === profile.id && m.is_admin);
      });
      // Group names come from GET /groups. If that fails the rows still show, just without the names.
      const groupNames = Object.fromEntries((groupsRes?.ok && Array.isArray(groupsRes.data) ? groupsRes.data : []).map((g) => [g.id, g.name]));
      // A group whose expenses didn't load still shows its rows, just without the expense lines.
      const expensesByGroup = {};
      groupIds.forEach((id, i) => {
        if (expenseRes[i]?.ok && Array.isArray(expenseRes[i].data)) expensesByGroup[id] = expenseRes[i].data;
      });
      setData({
        ...buildBalances({ balances: res.data, emailsByGroup: namesByGroup, fullEmailsByGroup: emailsByGroup, groupNames, expensesByGroup, myId: profile.id }),
        emailsByGroup,
        namesByGroup,
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
// The yellow "Received (manual)" pill on a row where the person STILL owes more (a part payment you recorded).
// Switched off for now: next to "Mark received" it looked confusing. The code stays; set this to true to bring it back.
const SHOW_MANUAL_PILL_ON_PARTIAL = false;

// "Lunch $8.33", or "TV for house −$119.16" when the expense reduces the amount.
const lineText = (l) => `${l.title} ${l.offset ? '−' : ''}${formatMoney(l.cents)}`;

// The line under a person's name: the group, then the expenses behind the amount.
// It starts closed (one line). The caret opens the full list, where each expense can be opened,
// and edited by people allowed to. Deleting is done on the edit screen.
//   expense(line)  the full expense for a line, or undefined
//   allowed(expense)  true when you may change it
//   open / onToggle  whether the list is open, and a function that flips it
function RowDetail({ row, expense, allowed, onOpen, onEdit, open, onToggle }) {
  const listId = useId();
  const { lines, groupName } = row;
  if (lines.length === 0) return <span className="row-sub">{groupName}</span>;
  const more = lines.length - SHOWN_LINES;
  const hasOffset = lines.some((l) => l.offset);
  const text = `${groupName} · ${lines.slice(0, SHOWN_LINES).map(lineText).join(', ')}`;
  return (
    <div className="bal-detail">
      {/* The grey summary line is only there while the row is closed. Open, the list below says it all. */}
      <div className={`bal-summary${open ? ' is-open' : ''}`}>
        {!open && (
          <span className="bal-summary-text">
            {text}
            {more > 0 && (
              <>
                {' '}
                <button type="button" className="bal-more" aria-label={`Show ${more} more expenses for ${row.name}`} onClick={onToggle}>{`+${more} more`}</button>
              </>
            )}
          </span>
        )}
        <button
          type="button"
          className="bal-caret"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${open ? 'Hide' : 'Show'} the expenses for ${row.name}`}
          onClick={onToggle}
        >
          <svg className="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <div id={listId} hidden={!open}>
        {open && (
          <>
            <ul className="bal-lines">
              {lines.map((l) => (
                <li key={l.id}>
                  <span>
                    {expense(l) ? (
                      <button type="button" className="exp-open" aria-haspopup="dialog" onClick={() => onOpen(expense(l))}>{l.title}</button>
                    ) : l.title}
                    {l.at && <span className="bal-line-when">{formatDay(l.at)}</span>}
                  </span>
                  <span className="bal-line-end">
                    <span>{`${l.offset ? '−' : ''}${formatMoney(l.cents)}`}</span>
                    {expense(l) && allowed(expense(l)) && (
                      <button type="button" className="exp-edit-link" aria-label={`Edit ${l.title}`} onClick={() => onEdit(expense(l))}>Edit</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {hasOffset && <p className="bal-note">Amounts with a minus take away from the total.</p>}
            {row.settled && <p className="bal-note">Settlements are included in the balance.</p>}
          </>
        )}
      </div>
    </div>
  );
}

const CheckIcon = () => (
  <svg className="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

// One person's row: who, the group and expenses, the amount, and what you can do with it.
//   kind  'owed' (they owe you: Mark received), 'received' (they paid you, the server has it),
//         'owe' (you owe them: Pay) or 'paid' (nothing owed either way)
//   manual  true when the payment to you was recorded by you (yellow pill) rather than by them (green pill)
function BalanceRow({ row, kind, manual, when, onSettle, detail, open, onToggle }) {
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
          <PersonName label={row.name} email={row.email} />{' '}
          {kind === 'owed' && <span className="bal-verb one-line">owes you</span>}
          {kind === 'received' && <span className="bal-verb one-line">paid you</span>}
          {paidUp && <span className="one-line">are paid up</span>}
        </div>
        <RowDetail row={row} {...detail} open={open} onToggle={onToggle} />
      </div>
      <div className="bal-side">
        <span className="bal-amt">
          <span className={`bal-amount ${paidUp ? 'bal-mute' : owes ? 'bal-neg' : 'bal-pos'}`}>
            {paidUp ? formatMoney(0) : signed(row.cents, owes ? '−' : '+')}
          </span>
          {when && <span className="bal-when">{when}</span>}
        </span>
        {manual && <span className="pill-state pill-manual"><CheckIcon />Received (manual)</span>}
        {kind === 'received' && !manual && <span className="pill-state pill-received"><CheckIcon />Payment received</span>}
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
                  <p className="sm-mute">{formatDay(s.settlement_time)}</p>
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
export function BalancesView({ data, history, myId, onRecord, onChanged, onRetryHistory }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null); // the expense shown in the details dialog
  const [expanded, setExpanded] = useState(() => new Set()); // keys of the rows whose expense list is open
  const [view, setView] = useState(() => (data.owedToYou.length === 0 && data.youOwe.length > 0 ? 'owe' : 'owed'));
  const [dialog, setDialog] = useState(null); // { row, owes }
  const [off, setOff] = useState(false); // the server can't record payments yet
  const [note, setNote] = useState('');
  const noteRef = useRef(null);

  useEffect(() => {
    if (note) noteRef.current?.focus();
  }, [note]);

  // The server sends every payment in the group, so only the ones you are part of are shown.
  const mine = history.list.filter((h) => h.paid_by === myId || h.recipient === myId);
  const groupNames = {};
  [...data.owedToYou, ...data.youOwe, ...data.paidUp].forEach((r) => {
    groupNames[r.groupId] = r.groupName;
  });

  // Money paid to you this month, from the server's settlements only. The server already takes it off the balances,
  // so it is added back to show the full amount, with how much of it has come in. "Manual" is the part you recorded
  // yourself (recorded_by is you). The server has no way to undo a settlement, so neither does this screen.
  const received = receivedThisMonth(mine, myId);
  const manualTotal = received.manualTotal;
  const owedKeys = new Set([...data.owedToYou, ...data.youOwe].map((r) => r.key));
  const receivedRows = Object.entries(received.byRow)
    .filter(([key]) => !owedKeys.has(key))
    .map(([key, cents]) => {
      const [groupId, userId] = key.split('-').map(Number);
      return {
        key,
        groupId,
        groupName: groupNames[groupId] ?? `Group ${groupId}`,
        userId,
        name: data.namesByGroup?.[groupId]?.[userId] ?? FORMER_MEMBER,
        email: data.emailsByGroup?.[groupId]?.[userId] ?? null,
        cents,
        lines: [],
        settled: false,
      };
    })
    .sort((a, b) => b.cents - a.cents || a.groupId - b.groupId);
  const receivedKeys = new Set(receivedRows.map((r) => r.key));
  const owedFull = data.owedTotal + received.total;
  const actualReceived = received.total; // the part you recorded yourself is already in it

  // Rows go newest first: the later of the person's newest expense and your newest payment with them.
  const lastPay = {};
  mine.forEach((s) => {
    const key = `${s.group_id}-${s.paid_by === myId ? s.recipient : s.paid_by}`;
    lastPay[key] = Math.max(lastPay[key] ?? 0, toDate(s.settlement_time).getTime() || 0);
  });
  const activityAt = (row) => Math.max(row.lastAt ?? 0, lastPay[row.key] ?? 0);
  const newestFirstRows = (list) => [...list].sort((a, b) => activityAt(b) - activityAt(a)); // ties keep their order
  const whenOf = (row) => (activityAt(row) > 0 ? formatDay(new Date(activityAt(row)).toISOString()) : '');

  const rows = [
    ...(view !== 'owe' ? newestFirstRows(data.owedToYou).map((row) => ({ row, kind: 'owed' })) : []),
    ...(view !== 'owe' ? newestFirstRows(receivedRows).map((row) => ({ row, kind: 'received' })) : []),
    ...(view !== 'owed' ? newestFirstRows(data.youOwe).map((row) => ({ row, kind: 'owe' })) : []),
    ...(view !== 'owed' ? data.paidUp.filter((row) => !receivedKeys.has(row.key)).map((row) => ({ row, kind: 'paid' })) : []),
  ];
  const withLines = rows.filter(({ row }) => row.lines.length > 0).map(({ row, kind }) => `${kind}-${row.key}`);
  const allOpen = withLines.length > 0 && withLines.every((k) => expanded.has(k));
  const toggleRow = (key) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAll = () =>
    setExpanded((set) => {
      const next = new Set(set);
      withLines.forEach((k) => (allOpen ? next.delete(k) : next.add(k)));
      return next;
    });
  const empty = view === 'owed' ? 'Nobody owes you right now.' : view === 'owe' ? 'You don’t owe anyone right now.' : 'Nothing between you and others right now.';

  const expenseOf = (groupId) => (line) => (data.expensesByGroup?.[groupId] ?? []).find((e) => e.id === line.id);
  const allowed = (e) => canChangeExpense({ expense: e, myId, isAdmin: Boolean(data.adminGroups?.[e.group_id]) });
  const editExpense = (e) =>
    navigate(`/groups/${e.group_id}/expenses/new`, { state: { group: { id: e.group_id, name: groupNames[e.group_id] ?? 'Group', type: '' }, edit: e } });
  const nameOf = (groupId) => (id) => (id === myId ? 'You' : data.namesByGroup?.[groupId]?.[id] ?? FORMER_MEMBER);

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
          <button
            type="button"
            className="bal-tab-btn"
            aria-pressed={view === 'owed'}
            onClick={() => setView('owed')}
          >
            {/* No aria-label here: the button is named by what it shows, so its name always contains its visible text. */}
            <span className="visually-hidden">Show who owes you. </span>
            <span className="bal-label">Owed to you</span>
            <span className="bal-owed-row">
              <span className={`bal-value${owedFull > 0 ? ' bal-pos' : ''}`}>{signed(owedFull, '+')}</span>
              <span className="bal-recv">
                <span className="bal-label">Actual amount received</span>
                <span className="bal-recv-total">
                  {formatMoney(actualReceived)} <span className="bal-recv-of">of {formatMoney(owedFull)}</span>
                </span>
                {manualTotal > 0 && <span className="bal-recv-manual">includes {formatMoney(manualTotal)} marked by you</span>}
              </span>
            </span>
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

      {note && <Message kind="ok" role="status" boxRef={noteRef} tabIndex={-1} onClose={() => setNote('')}>{note}</Message>}
      {data.owedTotal === 0 && data.oweTotal === 0 && <Message kind="ok">You’re all paid up.</Message>}

      <div className="bal-cols">
        <section className="panel bal-main" aria-labelledby="bal-list">
          <div className="bal-list-head">
            <h2 id="bal-list">{TITLES[view]}</h2>
            {withLines.length > 0 && (
              <button type="button" className="btn btn-ghost btn-s" onClick={toggleAll}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="text-body-secondary mb-0">{empty}</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {rows.map(({ row, kind }) => (
                <BalanceRow
                  key={`${kind}-${row.key}`}
                  row={row}
                  kind={kind}
                  when={kind === 'paid' ? '' : whenOf(row)}
                  manual={(kind === 'received' || (SHOW_MANUAL_PILL_ON_PARTIAL && kind === 'owed')) && (received.manualByRow[row.key] ?? 0) > 0 && (kind === 'owed' || received.manualByRow[row.key] === received.byRow[row.key])}
                  onSettle={(r, owes) => setDialog({ row: r, owes })}
                  open={expanded.has(`${kind}-${row.key}`)}
                  onToggle={() => toggleRow(`${kind}-${row.key}`)}
                  detail={{ expense: expenseOf(row.groupId), allowed, onOpen: setOpen, onEdit: editExpense }}
                />
              ))}
            </ul>
          )}
          <p className="bal-foot">
            This app does not move money. “Pay” records that a payment was made outside the app. A yellow Received (manual) pill means you recorded the payment yourself and the other person has not confirmed. A recorded payment can’t be undone.
          </p>
        </section>

        <History history={{ ...history, list: mine }} myId={myId} names={data.namesByGroup ?? {}} groupNames={groupNames} onRetry={onRetryHistory} />
      </div>

      {open && (
        <ExpenseDialog
          key={open.id}
          expense={open}
          groupName={groupNames[open.group_id] ?? 'this group'}
          nameOf={nameOf(open.group_id)}
          canChange={allowed(open)}
          allowDelete={false}
          onEdit={editExpense}
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
        />
      )}
    </main>
  );
}
