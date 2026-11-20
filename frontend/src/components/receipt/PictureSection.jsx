// The picture, plus the delete button for the people who may use it.
// The button shows only for the uploader or a group admin, once the receipt is no longer uploaded or reading,
// and while the picture still exists.
import { useState } from 'react';
import DeletePicture from './DeletePicture.jsx';
import ReceiptPicture from './ReceiptPicture.jsx';

// Statuses where the server refuses to delete the picture.
const BUSY = ['uploaded', 'reading'];

export const canDeletePicture = ({ receipt, myId, isAdmin }) =>
  Boolean(receipt) && !BUSY.includes(receipt.status) && (receipt.uploader === myId || Boolean(isAdmin));

//   receipt   { id, store, uploader, status }
//   myId      the signed-in person
//   isAdmin   true when they are an admin of the receipt's group
//   load, remove  the picture fetch and delete calls (tests and the preview page pass their own)
export default function PictureSection({ receipt, myId, isAdmin, onExpired, load, remove }) {
  const [gone, setGone] = useState(false);
  const [phase, setPhase] = useState('loading');
  const showDelete = canDeletePicture({ receipt, myId, isAdmin }) && (phase === 'image' || phase === 'pdf');

  return (
    <div className="pic-section">
      <ReceiptPicture receiptId={receipt.id} store={receipt.store} gone={gone} load={load} onPhase={setPhase} />
      {(showDelete || gone) && (
        <DeletePicture receiptId={receipt.id} remove={remove} onExpired={onExpired} onDeleted={() => setGone(true)} />
      )}
    </div>
  );
}
