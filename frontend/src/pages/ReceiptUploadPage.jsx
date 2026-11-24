import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/RequireAuth.jsx';
import PickCard from '../components/receipt/PickCard.jsx';
import ReceiptFrame from '../components/receipt/ReceiptFrame.jsx';
import UploadStatusCard from '../components/receipt/UploadStatusCard.jsx';
import Message from '../components/Message.jsx';
import { useMyGroups } from '../lib/groupHooks.js';
import { useReceiptUpload } from '../lib/useReceiptUpload.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Step 1. Comes from the Home pop-up with ?group=<id>, any other way in goes to Home.
// Picking a file uploads it, then moves to /receipts/<id>. Cancel clears the file.
export default function ReceiptUploadPage() {
  usePageTitle('Scan a receipt');
  const { status, groups, reload } = useMyGroups();
  if (status === 'loading') return <main className="page-wrap page-wrap--narrow"><p className="text-body-secondary mb-0" role="status">Loading your groups…</p></main>;
  if (status === 'error') {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Message kind="error" alert>We couldn’t load your groups. Check your connection and try again.</Message>
        <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
      </main>
    );
  }
  return <UploadStep groups={groups} />;
}

// The upload step, once the user's groups are known.
function UploadStep({ groups }) {
  const { onExpired } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wanted = Number(params.get('group'));
  const startGroup = groups.some((g) => g.id === wanted) ? wanted : null;

  const [groupId, setGroupId] = useState(startGroup);
  const pickerRef = useRef(null);
  const upload = useReceiptUpload({
    groupId,
    onExpired,
    onUploaded: (receipt, file) => navigate(`/receipts/${receipt.id}`, { state: { fileName: file.name } }),
  });

  if (startGroup === null) return <Navigate to="/home" replace />;

  return (
    <>
      <ReceiptFrame
        step={1}
        left={
          <PickCard
            ref={pickerRef}
            groups={groups}
            groupId={groupId}
            onGroupChange={setGroupId}
            groupLocked={upload.phase === 'uploading'}
            disabled={upload.phase === 'uploading'}
            onFile={upload.start}
          />
        }
        right={
          <UploadStatusCard
            phase={upload.phase}
            fileName={upload.file?.name}
            percent={upload.percent}
            error={upload.error}
            onTryAgain={() => upload.file && upload.start(upload.file)}
            onChooseAnother={() => pickerRef.current?.choose()}
            onCancel={upload.cancel}
          />
        }
      />
      <div className="visually-hidden" role="status" aria-live="polite">{upload.announcement}</div>
    </>
  );
}
