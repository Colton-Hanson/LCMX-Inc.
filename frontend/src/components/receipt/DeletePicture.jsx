// Delete receipt picture: the button, the confirm dialog and what happens after.
// Only the saved picture goes. The items stay.
import { useEffect, useId, useRef, useState } from 'react';
import Dialog from '../Dialog.jsx';
import Icon from '../Icons.jsx';
import Message from '../Message.jsx';
import NotAvailable from '../NotAvailable.jsx';
import { deleteReceiptPicture, isNotAvailable } from '../../api/proposed.js';
import { messageFromResult } from '../../lib/apiErrors.js';
import '../../sprint7.css';

export const KEEP_RULE = 'A picture that isn’t saved to an expense is kept for 7 days. After that it is deleted and the receipt is marked abandoned.';
export const PICTURE_OFF_TEXT = 'Deleting the picture isn’t available yet. Nothing was deleted.';

//   remove     the delete call (the preview page passes its own)
//   onExpired  called when the login has ended
//   onDeleted  called once the picture is deleted
export default function DeletePicture({ receiptId, remove = deleteReceiptPicture, onExpired, onDeleted, showRule = true }) {
  const offId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const keepRef = useRef(null);
  const doneRef = useRef(null);

  useEffect(() => {
    if (off) keepRef.current?.focus();
  }, [off]);
  useEffect(() => {
    if (deleted) doneRef.current?.focus();
  }, [deleted]);

  async function confirm() {
    setError('');
    setBusy(true);
    const res = await remove(receiptId);
    setBusy(false);
    if (res.status === 401) return onExpired?.();
    if (res.ok) {
      setOpen(false);
      setDeleted(true);
      onDeleted?.();
    } else if (isNotAvailable(res)) setOff(true);
    else setError(messageFromResult(res, 'We couldn’t delete the picture. Please try again.'));
  }

  if (deleted) {
    return <Message kind="ok" role="status" boxRef={doneRef} tabIndex={-1}>Picture deleted. All items are kept.</Message>;
  }

  return (
    <div className="pic-box">
      {showRule && <p className="sm-mute">{KEEP_RULE}</p>}
      <div>
        <button type="button" className="btn btn-danger-outline btn-s" onClick={() => setOpen(true)}>
          <Icon name="trash" size={18} />
          Delete receipt picture
        </button>
      </div>
      {open && (
        <Dialog
          title="Delete the receipt picture?"
          description="The saved picture is deleted for good. All the items are kept, so nothing else changes."
          onClose={() => setOpen(false)}
        >
          {off && <NotAvailable id={offId}>{PICTURE_OFF_TEXT}</NotAvailable>}
          {error && <Message kind="error" alert>{error}</Message>}
          <div className="btn-row">
            <button type="button" className="btn btn-danger-outline" disabled={off || busy} aria-describedby={off ? offId : undefined} onClick={confirm}>
              {busy ? 'Deleting…' : 'Delete picture'}
            </button>
            <button type="button" className="btn btn-ghost" data-autofocus ref={keepRef} onClick={() => setOpen(false)}>
              {off ? 'Close' : 'Keep it'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
