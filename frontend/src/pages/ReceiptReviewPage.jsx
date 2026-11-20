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
import { getKnownGroups } from '../lib/groupCache.js';
import { useGroupMembers } from '../lib/groupHooks.js';
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

export const AI_NOTE = (
  <Message kind="info">
    <strong>Read by AI.</strong> It can make mistakes. Fix any name, quantity, or price, then tap the people who share each item.
  </Message>
);

// What to show for a receipt that is not ready to review. Returns null when it is.
export function reviewBlocker(receipt) {
  const id = receipt.id;
  const again = <Link className="btn btn-tint" to={`/receipts/new?group=${receipt.group_id}`}>Try another picture</Link>;
  const home = <Link className="btn btn-ghost" to="/home">Back to Home</Link>;
  if (receipt.expense_id != null || receipt.status === 'confirmed') {
    return { step: 4, title: 'This receipt is already saved', text: 'It was added as an expense, so there is nothing left to check.', actions: <><Link className="btn btn-tint" to={`/groups/${receipt.group_id}`}>Go to the group</Link>{home}</> };
  }
  if (receipt.status === 'failed') {
    return { step: 2, title: 'The AI couldn’t read this receipt', text: 'Nothing was added. Try another picture or take a new photo.', actions: <>{again}{home}</> };
  }
  if (receipt.status === 'abandoned') {
    return { step: 1, title: 'This receipt was abandoned', text: 'It wasn’t saved to an expense within 7 days, so its picture was deleted. Upload it again to start over.', actions: <>{again}{home}</> };
  }
  if (receipt.status !== 'read') {
    return { step: 2, title: 'The AI is still reading this receipt', text: 'The items will be ready to check as soon as it finishes.', actions: <><Link className="btn btn-tint" to={`/receipts/${id}`}>Back to the receipt</Link>{home}</> };
  }
  if ((receipt.items ?? []).length === 0) {
    return { step: 2, title: 'The AI couldn’t read this receipt', text: 'No items were found on it. Try another picture or take a new photo.', actions: <>{again}{home}</> };
  }
  return null;
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
  // WORKAROUND(no list routes): START. The group name comes from this browser's saved list. See lib/groupCache.js.
  const group = getKnownGroups(profile.id).find((g) => g.id === receipt.group_id) ?? { id: receipt.group_id, name: 'Group', type: '' };
  // WORKAROUND(no list routes): END
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
