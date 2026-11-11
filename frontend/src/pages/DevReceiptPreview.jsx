// DEV_RECEIPT_PREVIEW_ONLY
// Dev-only page showing every receipt state with sample data (the backend can't give 'read' or 'failed' yet).
// Only exists under npm run dev. Open /dev/receipt-preview.
import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PickCard from '../components/receipt/PickCard.jsx';
import ReceiptFrame from '../components/receipt/ReceiptFrame.jsx';
import ReceiptStatusCard from '../components/receipt/ReceiptStatusCard.jsx';
import UploadStatusCard from '../components/receipt/UploadStatusCard.jsx';

const GROUPS = [{ id: 1, name: 'Lake House Crew', type: 'outing' }, { id: 2, name: 'Family', type: 'family' }];
const READ = {
  id: 1,
  status: 'read',
  store: 'Corner Market',
  receipt_date: '2026-10-03',
  items: [
    { id: 1, name: 'Milk', quantity: 2, unit_price: '3.50', line_total: '7.00', position: 0 },
    { id: 2, name: 'Bread', quantity: 1, unit_price: '4.25', line_total: '4.25', position: 1 },
    { id: 3, name: 'Eggs', quantity: 3, unit_price: '5.05', line_total: '15.15', position: 2 },
    { id: 4, name: 'Apples', quantity: 4, unit_price: '1.00', line_total: '4.00', position: 3 },
    { id: 5, name: 'Coffee', quantity: 1, unit_price: '9.00', line_total: '9.00', position: 4 },
    { id: 6, name: 'Rice', quantity: 1, unit_price: '3.00', line_total: '3.00', position: 5 },
    { id: 7, name: 'Soap', quantity: 1, unit_price: '2.00', line_total: '2.00', position: 6 },
    { id: 8, name: 'Gum', quantity: 1, unit_price: '2.00', line_total: '2.00', position: 7 },
  ],
};
const LONG_NAME = 'corner-market-grocery-receipt-october-third-twenty-twenty-six-final-scan-version-two.jpg';

// Each state: which card and what it shows.
const STATES = {
  uploading: { label: 'Uploading 62%', step: 1, upload: { phase: 'uploading', percent: 62, fileName: LONG_NAME } },
  idle: { label: 'Nothing picked yet', step: 1, upload: { phase: 'idle' } },
  reading: { label: 'Reading', step: 2, status: { state: 'waiting', elapsed: 12 } },
  slow: { label: 'Reading, slow', step: 2, status: { state: 'waiting', elapsed: 95, slow: true } },
  trouble: { label: 'Reading, connection trouble', step: 2, status: { state: 'waiting', elapsed: 20, problem: true } },
  summary: { label: 'Summary', step: 3, status: { state: 'read', receipt: READ } },
  unreadable: { label: 'Could not read it', step: 2, status: { state: 'failed' } },
  wrong_format: { label: 'Wrong format', step: 1, upload: { phase: 'failed', fileName: 'notes.txt', error: { message: 'Only JPEG and PDF receipts are supported.', action: 'Choose a .jpg, .jpeg, or .pdf file.' } } },
  too_large: { label: 'Too large', step: 1, upload: { phase: 'failed', fileName: LONG_NAME, error: { message: 'This file is too large (max 10 MB).', action: 'Choose a smaller file, or take a new photo.' } } },
  corrupt: { label: 'Corrupt file', step: 1, upload: { phase: 'failed', fileName: 'receipt.jpg', error: { message: 'That file could not be read.', action: 'Try another picture, or take a new photo.' } } },
  network: { label: 'No connection', step: 1, upload: { phase: 'failed', fileName: 'receipt.jpg', error: { message: 'We couldn’t reach the server.', action: 'Check your connection and try again.' } } },
};

export default function DevReceiptPreview() {
  const [params, setParams] = useSearchParams();
  const key = STATES[params.get('state')] ? params.get('state') : 'uploading';
  const current = STATES[key];
  const pickerRef = useRef(null);
  const noop = () => {};

  return (
    <>
      <nav className="page-wrap" aria-label="Preview states" style={{ paddingBottom: 0 }}>
        <p className="text-body-secondary mb-0">Preview only (development). <Link to="/home">Back to Home</Link></p>
        <div className="btn-row">
          {Object.entries(STATES).map(([id, s]) => (
            <button key={id} type="button" className={`btn btn-s ${id === key ? 'btn-tint' : 'btn-ghost'}`} onClick={() => setParams({ state: id })}>{s.label}</button>
          ))}
        </div>
      </nav>
      <ReceiptFrame
        step={current.step}
        left={<PickCard ref={pickerRef} groups={GROUPS} groupId={1} onGroupChange={noop} groupLocked onFile={noop} disabled={Boolean(current.status && current.status.state === 'waiting')} />}
        right={
          current.upload ? (
            <UploadStatusCard {...current.upload} percent={current.upload.percent ?? 0} onTryAgain={noop} onChooseAnother={noop} onCancel={noop} />
          ) : (
            <ReceiptStatusCard fileName={LONG_NAME} receiptId="1" elapsed={0} slow={false} problem={false} onTryAnother={noop} onTakePhoto={noop} onCancel={noop} {...current.status} />
          )
        }
      />
    </>
  );
}
