// Settle up dialog: full amount or part of it, then a confirm step.
// It only records a payment made outside the app. No money moves.
import { useEffect, useId, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';
import Message from './Message.jsx';
import NotAvailable from './NotAvailable.jsx';
import { isNotAvailable } from '../api/proposed.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { checkPartAmount, shortName } from '../lib/settle.js';
import { formatMoney } from '../lib/splits.js';

export const SETTLE_OFF_TEXT = 'Recording a payment isn’t available yet. Nothing was saved.';

//   row     { name, cents, groupName } for the person
//   owes    true when you owe them (Pay), false when they owe you (Mark received)
//   off     true once we know the server can't record payments yet
//   onRecord(cents)  saves it, resolves to the API result
//   onOff   called when the server says it can't do it yet
//   onDone(paidCents, leftCents)  called after it is saved
export default function SettleDialog({ row, owes, off = false, onRecord, onOff, onDone, onClose }) {
  const amountId = useId();
  const helpId = useId();
  const offId = useId();
  const [part, setPart] = useState(false);
  const [text, setText] = useState('');
  const [step, setStep] = useState('amount'); // 'amount' | 'confirm'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const yesRef = useRef(null);
  const backRef = useRef(null);

  // Keep focus inside the dialog when the step changes.
  useEffect(() => {
    if (step === 'confirm') (off ? backRef : yesRef).current?.focus();
  }, [step, off]);

  const { name, cents, groupName } = row;
  const who = shortName(name);
  const check = part ? checkPartAmount(text, cents) : { cents, error: '' };
  const valid = check.cents !== null;
  const paid = valid ? check.cents : 0;
  const left = cents - paid;
  const showError = part && text.trim() !== '' && !valid;
  const leftText = left === 0 ? 'Nothing will be left over. This balance will be paid.' : `${formatMoney(left)} will stay outstanding.`;

  async function confirm() {
    setError('');
    setBusy(true);
    const res = await onRecord(paid);
    setBusy(false);
    if (!res) return;
    if (res.ok) return onDone(paid, left);
    if (isNotAvailable(res)) return onOff();
    setError(messageFromResult(res, 'We couldn’t record that. Please try again.'));
  }

  return (
    <Dialog
      title={owes ? `Pay ${who}` : `Mark received from ${who}`}
      description={`${owes ? `You owe ${name}` : `${name} owes you`} ${formatMoney(cents)} in ${groupName}.`}
      onClose={onClose}
    >
      <Message kind="info">
        This app does not move money. Settling up records that the payment was made outside the app, like cash or a bank transfer.
      </Message>

      {step === 'amount' && (
        <>
          <fieldset className="plain">
            <legend>{owes ? `How much did you pay ${who}?` : `How much did ${who} pay you?`}</legend>
            <div className="seg settle-seg" role="group" aria-label="Amount">
              <button type="button" className={part ? '' : 'is-on'} aria-pressed={!part} onClick={() => setPart(false)}>
                {`Full amount (${formatMoney(cents)})`}
              </button>
              <button type="button" className={part ? 'is-on' : ''} aria-pressed={part} onClick={() => setPart(true)}>
                Part of it
              </button>
            </div>
          </fieldset>

          {part && (
            <div className="s7-field">
              <label htmlFor={amountId}>Amount paid</label>
              <input
                id={amountId}
                className="form-in"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={text}
                aria-invalid={showError}
                aria-describedby={helpId}
                onChange={(e) => setText(e.target.value)}
              />
              {showError ? (
                <Message kind="error" alert id={helpId}>{check.error}</Message>
              ) : (
                <p className="sm-mute" id={helpId}>{`Up to ${formatMoney(cents)}, like 10.00.`}</p>
              )}
            </div>
          )}

          {valid && <p className="strong-sm" role="status">{leftText}</p>}

          <div className="btn-row">
            <button type="button" className="btn btn-tint" disabled={!valid} onClick={() => setStep('confirm')}>Mark as paid</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <p className="fw-bold">{`Mark ${formatMoney(paid)} as paid?`}</p>
          <p>
            {owes
              ? `This records that you paid ${name} ${formatMoney(paid)} outside the app. `
              : `This records that ${name} paid you ${formatMoney(paid)} outside the app. `}
            {leftText} You both see it in the settlement history.
          </p>
          {off && <NotAvailable id={offId}>{SETTLE_OFF_TEXT}</NotAvailable>}
          {error && <Message kind="error" alert>{error}</Message>}
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-tint"
              ref={yesRef}
              disabled={off || busy}
              aria-describedby={off ? offId : undefined}
              onClick={confirm}
            >
              {busy ? 'Saving…' : 'Yes, mark as paid'}
            </button>
            <button type="button" className="btn btn-ghost" ref={backRef} onClick={() => (off ? onClose() : setStep('amount'))}>
              {off ? 'Close' : 'Go back'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
