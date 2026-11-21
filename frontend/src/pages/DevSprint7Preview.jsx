// DEV_SPRINT7_PREVIEW_ONLY
// Dev-only page showing every Sprint 7 screen and state with sample data (the backend can't give these yet).
// Only exists under npm run dev. Open /dev/sprint7-preview.
import { Link, useSearchParams } from 'react-router-dom';
import RecentExpenses from '../components/RecentExpenses.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import ReceiptReview from '../components/receipt/ReceiptReview.jsx';
import { BalancesView } from './BalancesPage.jsx';
import { ReviewFrame, ReviewNotice } from './ReceiptReviewPage.jsx';
import { AI_NOTE, reviewBlocker } from '../lib/reviewParts.jsx';
import '../balances.css';
import '../receipt.css';
import '../sprint7.css';

const wait = (result) => new Promise((resolve) => setTimeout(() => resolve(result), 400));
const OK = { ok: true, status: 200, data: {} };
const NOT_BUILT = { ok: false, status: 405, data: { detail: 'Method Not Allowed' } };
const SAMPLE_PICTURE = { ok: true, status: 200, blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#e3e8ec"/></svg>'], { type: 'image/svg+xml' }) };
const PICTURE_GONE = { ok: false, status: 404, data: { detail: 'Receipt picture was removed.' } };
const NO_NET = { ok: false, status: 0, network: true };
const FOREVER = new Promise(() => {});

const GROUP = { id: 1, name: 'Lake House Crew', type: 'outing' };
const LONG = 'a-very-long-email-address-for-testing-small-screens@example-university.edu';
const people = (myId, myEmail) => ({ [myId]: myEmail, 902: 'maya@example.com', 903: 'devin@example.com', 904: LONG });
const members = (myId, myEmail, admin) => [
  { user_id: myId, email: myEmail, is_admin: admin },
  { user_id: 902, email: 'maya@example.com', is_admin: !admin },
  { user_id: 903, email: 'devin@example.com', is_admin: false },
  { user_id: 904, email: LONG, is_admin: false },
];
const expense = (id, description, paidBy, shares, amount) => ({ id, group_id: 1, description, amount, paid_by: paidBy, created_at: '2026-10-30T12:00:00Z', shares });
const expenses = (myId) => [
  expense(1, 'Weekly groceries', myId, { [myId]: '20.00', 902: '20.00', 903: '20.00' }, '60.00'),
  expense(2, 'Kayak rental for the whole weekend at the north shore dock', 902, { [myId]: '12.50', 902: '12.50' }, '25.00'),
  expense(3, 'Pizza night', 903, { [myId]: '8.00', 903: '8.00', 904: '8.00' }, '24.00'),
];
const balances = (myId, myEmail) => {
  const row = (userId, cents, lines) => ({ key: `1-${userId}`, groupId: 1, groupName: GROUP.name, userId, name: people(myId, myEmail)[userId], cents, lines });
  return {
    owedToYou: [row(902, 2000, [{ id: 1, title: 'Weekly groceries', cents: 2000, offset: false }]), row(904, 634, [])],
    youOwe: [row(903, 800, [{ id: 3, title: 'Pizza night', cents: 800, offset: false }])],
    paidUp: [],
    owedTotal: 2634,
    oweTotal: 800,
    hasRows: true,
    emailsByGroup: { 1: people(myId, myEmail) },
    expensesByGroup: { 1: expenses(myId) },
    adminGroups: { 1: false },
  };
};
const history = (myId) => [
  { id: 2, group_id: 1, paid_by: 902, recipient: myId, amount: '10.00', recorded_by: myId, settlement_time: '2026-11-03T12:00:00' },
  { id: 1, group_id: 1, paid_by: myId, recipient: 903, amount: '4.00', recorded_by: myId, settlement_time: '2026-11-02T12:00:00' },
];
const RECEIPT = {
  id: 1, group_id: 1, uploader: 1, expense_id: null, status: 'read', store: 'Corner Market', store_location: null, receipt_date: '2026-10-03',
  items: [
    { id: 1, name: 'Oat milk', quantity: 1, unit_price: '4.79', line_total: '4.79', position: 0 },
    { id: 2, name: 'Eggs', quantity: 1, unit_price: '5.49', line_total: '5.49', position: 1 },
    { id: 3, name: 'Pasta', quantity: 2, unit_price: '2.19', line_total: '4.38', position: 2 },
    { id: 4, name: 'Tomatoes', quantity: 1, unit_price: '3.98', line_total: '3.98', position: 3 },
    { id: 5, name: 'Dish soap', quantity: 1, unit_price: '3.49', line_total: '3.49', position: 4 },
    { id: 6, name: 'Chips', quantity: 1, unit_price: '4.29', line_total: '4.29', position: 5 },
    { id: 7, name: 'Ice cream', quantity: 1, unit_price: '6.99', line_total: '6.99', position: 6 },
    { id: 8, name: 'Coffee beans', quantity: 1, unit_price: '12.99', line_total: '12.99', position: 7 },
  ],
};

// Each state: a label and what the fake server answers.
const SCREENS = {
  'bal-ok': { label: 'Balances: works', kind: 'balances', record: OK, history: 'ready' },
  'bal-off': { label: 'Balances: not available', kind: 'balances', record: NOT_BUILT, history: 'off' },
  'bal-loading': { label: 'Balances: history loading', kind: 'balances', record: OK, history: 'loading' },
  'bal-empty': { label: 'Balances: empty', kind: 'balances', record: OK, history: 'ready', empty: true },
  'bal-error': { label: 'Balances: errors', kind: 'balances', record: NO_NET, history: 'error' },
  'exp-ok': { label: 'Expenses: works', kind: 'expenses', load: 'list', remove: OK },
  'exp-admin': { label: 'Expenses: admin', kind: 'expenses', load: 'list', remove: OK, admin: true },
  'exp-off': { label: 'Expenses: not available', kind: 'expenses', load: 'list', remove: NOT_BUILT },
  'exp-loading': { label: 'Expenses: loading', kind: 'expenses', load: 'forever' },
  'exp-empty': { label: 'Expenses: empty', kind: 'expenses', load: 'empty' },
  'exp-error': { label: 'Expenses: error', kind: 'expenses', load: 'error', remove: NO_NET },
  'rev-ok': { label: 'Review: works', kind: 'review', save: OK, picture: OK },
  'rev-removed': { label: 'Review: picture removed', kind: 'review', save: OK, picture: OK, gone: true },
  'rev-off': { label: 'Review: picture not available', kind: 'review', save: OK, picture: NOT_BUILT },
  'rev-warn': { label: 'Review: does not add up', kind: 'review', save: OK, picture: OK, receipt: { ...RECEIPT, total: '50.00' } },
  'rev-error': { label: 'Review: errors', kind: 'review', save: NO_NET, picture: NO_NET },
  'rev-loading': { label: 'Review: loading', kind: 'review-loading' },
  'rev-reading': { label: 'Review: still reading', kind: 'review-block', receipt: { ...RECEIPT, status: 'reading', items: [] } },
  'rev-failed': { label: 'Review: failed', kind: 'review-block', receipt: { ...RECEIPT, status: 'failed', items: [] } },
  'rev-noitems': { label: 'Review: could not read', kind: 'review-block', receipt: { ...RECEIPT, items: [] } },
  'rev-abandoned': { label: 'Review: abandoned', kind: 'review-block', receipt: { ...RECEIPT, status: 'abandoned', items: [] } },
  'rev-confirmed': { label: 'Review: already confirmed', kind: 'review-block', receipt: { ...RECEIPT, status: 'confirmed', expense_id: 7 } },
  'rev-saved': { label: 'Review: already saved', kind: 'review-block', receipt: { ...RECEIPT, expense_id: 7 } },
};

export default function DevSprint7Preview() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const key = SCREENS[params.get('state')] ? params.get('state') : 'bal-ok';
  const current = SCREENS[key];
  const myId = profile.id;
  const noop = () => {};

  let body = null;
  if (current.kind === 'balances') {
    const data = current.empty ? { ...balances(myId, profile.email), owedToYou: [], youOwe: [], owedTotal: 0, oweTotal: 0 } : balances(myId, profile.email);
    const list = current.history === 'ready' && !current.empty ? history(myId) : [];
    body = (
      <main className="page-wrap bal-page s7">
        <div>
          <h1>Balances</h1>
          <p className="text-body-secondary mb-0">Who owes who across your groups.</p>
        </div>
        <BalancesView
          key={key}
          data={data}
          history={{ state: current.history, list }}
          myId={myId}
          onRecord={() => wait(current.record)}
          onChanged={noop}
          onRetryHistory={noop}
        />
      </main>
    );
  } else if (current.kind === 'expenses') {
    const load = () =>
      current.load === 'forever' ? FOREVER : wait(current.load === 'error' ? NO_NET : { ok: true, status: 200, data: current.load === 'empty' ? [] : expenses(myId) });
    body = (
      <main className="page-wrap s7">
        <h1>{GROUP.name}</h1>
        <RecentExpenses key={key} groupId={GROUP.id} group={GROUP} members={members(myId, profile.email, Boolean(current.admin))} membersReady load={load} remove={() => wait(current.remove)} />
      </main>
    );
  } else if (current.kind === 'review') {
    body = (
      <ReviewFrame>
        {AI_NOTE}
        <ReceiptReview
          key={key}
          receipt={current.receipt ?? RECEIPT}
          members={members(myId, profile.email, true)}
          myId={myId}
          groupName={GROUP.name}
          saveItems={() => wait(current.save)}
          saveExpense={() => wait(current.save)}
          removePicture={() => wait(current.picture)}
          loadPicture={async () => (current.gone ? PICTURE_GONE : SAMPLE_PICTURE)}
          onSaved={() => window.scrollTo(0, 0)}
        />
      </ReviewFrame>
    );
  } else if (current.kind === 'review-loading') {
    body = <ReviewFrame><p className="mute" role="status">Loading your receipt…</p></ReviewFrame>;
  } else {
    const blocker = reviewBlocker(current.receipt);
    body = (
      <ReviewFrame step={blocker.step}>
        <ReviewNotice title={blocker.title} actions={blocker.actions}>{blocker.text}</ReviewNotice>
      </ReviewFrame>
    );
  }

  return (
    <>
      <nav className="page-wrap" aria-label="Preview states" style={{ paddingBottom: 0 }}>
        <p className="text-body-secondary mb-0">
          Preview only (development), sample data. <Link to="/home">Back to Home</Link> · <Link to="/dev/receipt-preview">Receipt upload states</Link>
        </p>
        <div className="s7-field" style={{ maxWidth: 360 }}>
          <label htmlFor="preview-state">Screen and state</label>
          <select id="preview-state" className="form-in" style={{ appearance: 'auto' }} value={key} onChange={(e) => setParams({ state: e.target.value })}>
            {Object.entries(SCREENS).map(([id, s]) => (
              <option key={id} value={id}>{s.label}</option>
            ))}
          </select>
        </div>
      </nav>
      {body}
    </>
  );
}
