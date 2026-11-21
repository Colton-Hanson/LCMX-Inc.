// Expense details dialog, with Edit and Delete for people allowed to change the expense.
// Delete asks first and says what is lost.
import { useEffect, useId, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';
import Icon from './Icons.jsx';
import Message from './Message.jsx';
import NotAvailable from './NotAvailable.jsx';
import MiniReceipt from './receipt/MiniReceipt.jsx';
import { deleteExpense, isNotAvailable } from '../api/proposed.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { CHANGE_RULE_TEXT } from '../lib/expensePermissions.js';
import { formatCents, formatMoney, toCents } from '../lib/splits.js';
import '../sprint7.css';

export const DELETE_OFF_TEXT = 'Deleting an expense isn’t available yet. Nothing was deleted.';

const money = (amount) => {
  const cents = toCents(amount);
  return cents === null ? String(amount) : formatMoney(cents);
};
const plain = (amount) => {
  const cents = toCents(amount);
  return cents === null ? String(amount) : formatCents(cents);
};
const dayOf = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

//   nameOf(id)   the name to show for a user id
//   canChange    true when this person may edit or delete it
//   startOnDelete  open straight on the delete question
//   allowDelete  false hides the Delete button (the Balances page deletes from the edit screen instead)
//   remove       the delete call (the preview page passes its own)
//   onEdit(expense)  opens the edit form
//   onDeleted(expense)  called after it is deleted
export default function ExpenseDialog({ expense, groupName, nameOf, canChange, startOnDelete = false, allowDelete = true, remove = deleteExpense, onEdit, onDeleted, onExpired, onClose }) {
  const offId = useId();
  const [step, setStep] = useState(startOnDelete && canChange ? 'delete' : 'details');
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  const [error, setError] = useState('');
  const keepRef = useRef(null);

  useEffect(() => {
    if (off) keepRef.current?.focus();
  }, [off]);

  const people = Object.entries(expense.shares ?? {}).map(([id, amount]) => ({ id, name: nameOf(Number(id)), amount: money(amount) }));
  const total = money(expense.amount);
  const date = dayOf(expense.created_at);

  async function confirmDelete() {
    setError('');
    setBusy(true);
    const res = await remove(expense.id);
    setBusy(false);
    if (res.status === 401) return onExpired?.();
    if (res.ok) return onDeleted(expense);
    if (isNotAvailable(res)) return setOff(true);
    setError(messageFromResult(res, 'We couldn’t delete the expense. Please try again.'));
  }

  const shares = (
    <ul className="exp-split-list dlg-shares" aria-label="Each person’s share">
      {people.map((p) => (
        <li key={p.id}>
          <span>{p.name}</span>
          <span>{p.amount}</span>
        </li>
      ))}
    </ul>
  );

  if (step === 'delete') {
    return (
      <Dialog
        title="Delete this expense?"
        description={`This deletes “${expense.description}” (${total}) and each person’s share of it. Balances in ${groupName} are worked out again without it, so what people owe each other will change. Kept: the group, its other expenses, payments already recorded, and the items on any receipt. This can’t be undone.`}
        onClose={onClose}
      >
        {people.length > 0 && (
          <div>
            <p className="strong-sm">Shares that will be deleted</p>
            {shares}
          </div>
        )}
        {off && <NotAvailable id={offId}>{DELETE_OFF_TEXT}</NotAvailable>}
        {error && <Message kind="error" alert>{error}</Message>}
        <div className="btn-row">
          <button type="button" className="btn btn-danger-outline" disabled={off || busy} aria-describedby={off ? offId : undefined} onClick={confirmDelete}>
            {busy ? 'Deleting…' : 'Delete expense'}
          </button>
          <button type="button" className="btn btn-ghost" data-autofocus ref={keepRef} onClick={onClose}>
            {off ? 'Close' : 'Keep it'}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={expense.description}
      description={`${nameOf(expense.paid_by)} paid ${total}${date ? ` on ${date}` : ''} in ${groupName}.`}
      onClose={onClose}
    >
      {people.length > 0 && (
        <div>
          <p className="strong-sm">Each person’s share</p>
          {shares}
        </div>
      )}
      <MiniReceipt
        store={groupName}
        date={date}
        lines={[{ key: expense.id, label: String(expense.description ?? '').toUpperCase(), amount: plain(expense.amount) }]}
        total={plain(expense.amount)}
      />
      {!canChange && (
        <p className="sm-mute">{CHANGE_RULE_TEXT}</p>
      )}
      <div className="btn-row">
        {canChange && (
          <>
            <button type="button" className="btn btn-tint" onClick={() => onEdit(expense)}>
              <Icon name="edit" size={18} />
              Edit
            </button>
            {allowDelete && (
              <button type="button" className="btn btn-danger-outline" onClick={() => setStep('delete')}>
                <Icon name="trash" size={18} />
                Delete
              </button>
            )}
          </>
        )}
        <button type="button" className="btn btn-ghost" data-autofocus onClick={onClose}>Close</button>
      </div>
    </Dialog>
  );
}
