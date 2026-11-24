// Step 3 of scanning a receipt: check the items and pick who shares each one (SCRUM-134).
// Loads the receipt and the group's members, then shows the review screen or why it can't be shown.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import '../receipt.css';
import '../sprint7.css';
import Message from '../components/Message.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import ReceiptReview from '../components/receipt/ReceiptReview.jsx';
import Stepper from '../components/receipt/Stepper.jsx';
import { getGroupEvents } from '../api/groups.js';
import { confirmReceipt, getReceipt, saveReceiptItems } from '../api/receipts.js';
import { useGroupMembers, useKnownGroup } from '../lib/groupHooks.js';
import { AI_NOTE, reviewBlocker } from '../lib/reviewParts.jsx';
import { formatMoney } from '../lib/splits.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// The frame every state shares: title, the two ways to add, and the steps.
export function ReviewFrame({ step = 3, children }) {
  return (
    <main className="page-wrap rcpt s7">
      <div className="rc-top">
        <h1>Check your receipt</h1>
        <div className="seg" role="group" aria-label="How to add">
          <Link to="/expenses/new">Enter by hand</Link>
          <span className="on" aria-current="page">Scan a receipt</span>
        </div>
      </div>
      <Stepper current={step} />
      {children}
    </main>
  );
}

// A card for when the review can't be shown, with where to go next.
export function ReviewNotice({ title, children, actions }) {
  return (
    <section className="panel" aria-labelledby="review-note">
      <h2 id="review-note">{title}</h2>
      <p className="mute">{children}</p>
      <div className="btn-row">{actions}</div>
    </section>
  );
}

export default function ReceiptReviewPage() {
  usePageTitle('Check the items');
  const { receiptId } = useParams();
  const { onExpired } = useAuth();
  const [load, setLoad] = useState({ state: 'loading', receipt: null }); // 'loading' | 'ready' | 'missing' | 'error'
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading', receipt: null });
    getReceipt(receiptId).then((res) => {
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (res.ok) return setLoad({ state: 'ready', receipt: res.data });
      setLoad({ state: res.status >= 400 && res.status < 500 ? 'missing' : 'error', receipt: null });
    });
    return () => {
      cancelled = true;
    };
  }, [receiptId, attempt, onExpired]);

  if (load.state === 'loading') {
    return <ReviewFrame><p className="mute" role="status">Loading your receipt…</p></ReviewFrame>;
  }
  if (load.state === 'error') {
    return (
      <ReviewFrame>
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load this receipt. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      </ReviewFrame>
    );
  }
  if (load.state === 'missing') {
    return (
      <ReviewFrame>
        <Message kind="error" alert>We couldn’t open this receipt. It may not exist, or it may belong to someone else.</Message>
        <div><Link className="btn btn-ghost" to="/home">Back to Home</Link></div>
      </ReviewFrame>
    );
  }

  const blocker = reviewBlocker(load.receipt);
  if (blocker) {
    return (
      <ReviewFrame step={blocker.step}>
        <ReviewNotice title={blocker.title} actions={blocker.actions}>{blocker.text}</ReviewNotice>
      </ReviewFrame>
    );
  }
  return <ReadyReview receipt={load.receipt} />;
}

// The receipt is read: load the group's members, then show the review.
function ReadyReview({ receipt }) {
  const { profile, onExpired } = useAuth();
  const navigate = useNavigate();
  const { status, members, reload } = useGroupMembers(receipt.group_id);
  // The group's name comes from the server; "Group" shows until it arrives.
  const group = useKnownGroup(receipt.group_id) ?? { id: receipt.group_id, name: 'Group', type: '' };
  const saveItems = useCallback((items) => saveReceiptItems(receipt.id, items), [receipt.id]);
  const saveExpense = useCallback((body) => confirmReceipt(receipt.id, body), [receipt.id]);
  // The Event picker is optional, so a failed load just leaves it out.
  const [events, setEvents] = useState([]);
  useEffect(() => {
    let cancelled = false;
    getGroupEvents(receipt.group_id)?.then?.((res) => {
      if (!cancelled && res?.ok && Array.isArray(res.data)) setEvents(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt.group_id]);

  return (
    <ReviewFrame>
      {AI_NOTE}
      {status === 'loading' && <p className="mute" role="status">Loading the group’s members…</p>}
      {status === 'error' && (
        <div className="d-flex flex-column align-items-start gap-3">
          <Message kind="error" alert>We couldn’t load the members. Check your connection and try again.</Message>
          <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
        </div>
      )}
      {status === 'denied' && <Message kind="error" alert>You can’t add an expense to this group. You may not be an accepted member.</Message>}
      {status === 'ready' && (
        <ReceiptReview
          receipt={receipt}
          members={members}
          events={events}
          myId={profile.id}
          groupName={group.name}
          saveItems={saveItems}
          saveExpense={saveExpense}
          onExpired={onExpired}
          onSaved={({ description, cents, count }) =>
            navigate(`/groups/${receipt.group_id}`, {
              state: { group, notices: [{ kind: 'ok', text: `Expense “${description}” saved: ${formatMoney(cents)} shared by ${count} ${count === 1 ? 'person' : 'people'}.` }] },
            })
          }
        />
      )}
    </ReviewFrame>
  );
}
