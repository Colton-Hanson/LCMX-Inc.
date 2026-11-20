import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/RequireAuth.jsx';
import PickCard from '../components/receipt/PickCard.jsx';
import ReceiptFrame from '../components/receipt/ReceiptFrame.jsx';
import ReceiptStatusCard from '../components/receipt/ReceiptStatusCard.jsx';
import UploadStatusCard from '../components/receipt/UploadStatusCard.jsx';
import { getMembers } from '../api/groups.js';
import { getKnownGroups } from '../lib/groupCache.js';
import { useReceiptStatus } from '../lib/useReceiptStatus.js';
import { useReceiptUpload } from '../lib/useReceiptUpload.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Steps 2 and 3: the AI reads the file, then the summary shows. The receipt id is in the URL so a refresh keeps your place.
// Can't open the receipt: back to Home. Cancel resets this screen for a new upload.
export default function ReceiptStatusPage() {
  usePageTitle('Scan a receipt');
  const { receiptId } = useParams();
  const { state: routeState } = useLocation();
  const { profile, onExpired } = useAuth();
  const navigate = useNavigate();
  // After Cancel: stop checking and show the empty upload screen. Only for this receipt.
  const [resetFor, setResetFor] = useState(null);
  const reset = resetFor === receiptId;
  const status = useReceiptStatus(reset ? null : receiptId, onExpired, () => navigate('/home', { replace: true }));
  const pickerRef = useRef(null);

  // The delete picture button is for the uploader or a group admin, so find out if this person is an admin.
  const [isAdmin, setIsAdmin] = useState(false);
  const receiptGroup = status.receipt?.group_id;
  const needsAdminCheck = (status.state === 'read' || status.state === 'confirmed') && receiptGroup != null && status.receipt.uploader !== profile.id;
  useEffect(() => {
    if (!needsAdminCheck) return undefined;
    let cancelled = false;
    getMembers(receiptGroup)?.then?.((res) => {
      if (!cancelled && res?.ok) setIsAdmin(res.data.some((m) => m.user_id === profile.id && m.is_admin));
    });
    return () => {
      cancelled = true;
    };
  }, [needsAdminCheck, receiptGroup, profile.id]);

  // WORKAROUND(no list routes): START. The group list is the one this browser has saved. See lib/groupCache.js.
  const known = useMemo(() => getKnownGroups(profile.id), [profile.id]);
  // WORKAROUND(no list routes): END
  const [chosenGroup, setChosenGroup] = useState(null);
  const groupId = chosenGroup ?? status.receipt?.group_id ?? known[0]?.id ?? 0;
  const groups = known.some((g) => g.id === groupId) || !groupId ? known : [...known, { id: groupId, name: 'Group', type: '' }];

  const upload = useReceiptUpload({
    groupId,
    onExpired,
    onUploaded: (receipt, file) => navigate(`/receipts/${receipt.id}`, { state: { fileName: file.name } }),
  });

  // Lines for screen readers.
  const [announcement, setAnnouncement] = useState('Upload successful. The AI is reading your receipt.');
  useEffect(() => {
    if (reset) setAnnouncement('Cancelled. Choose a receipt to start again.');
    else if (status.state === 'read') {
      const count = status.receipt?.items?.length ?? 0;
      setAnnouncement(`Done: ${count} ${count === 1 ? 'item' : 'items'} found`);
    } else if (status.state === 'failed') setAnnouncement('We couldn’t read this receipt.');
    else if (status.state === 'abandoned') setAnnouncement('This receipt was abandoned. Its picture was deleted.');
    else if (status.state === 'confirmed') setAnnouncement('This receipt is already added to the group.');
    else setAnnouncement('Upload successful. The AI is reading your receipt.');
  }, [status.state, status.receipt, reset]);
  useEffect(() => {
    if (status.slow) setAnnouncement('This is taking longer than usual.');
  }, [status.slow]);

  // Step 2 while reading, step 3 once it's read.
  const step = reset ? 1 : status.state === 'confirmed' ? 4 : status.state === 'read' ? 3 : 2;
  const sending = upload.phase !== 'idle';
  const canPickAgain = reset || status.state === 'failed' || status.state === 'abandoned';

  function cancel() {
    upload.cancel();
    setResetFor(receiptId);
  }

  return (
    <>
      <ReceiptFrame
        step={step}
        left={
          <PickCard
            ref={pickerRef}
            groups={groups}
            groupId={groupId}
            onGroupChange={setChosenGroup}
            groupLocked={!reset || upload.phase === 'uploading'}
            disabled={!canPickAgain || upload.phase === 'uploading'}
            onFile={upload.start}
          />
        }
        right={
          sending || reset ? (
            <UploadStatusCard
              phase={upload.phase}
              fileName={upload.file?.name}
              percent={upload.percent}
              error={upload.error}
              onTryAgain={() => upload.file && upload.start(upload.file)}
              onChooseAnother={() => pickerRef.current?.choose()}
              onCancel={cancel}
              focusHeading={reset}
            />
          ) : (
            <ReceiptStatusCard
              state={status.state}
              receipt={status.receipt}
              receiptId={receiptId}
              myId={profile.id}
              isAdmin={isAdmin}
              fileName={routeState?.fileName}
              elapsed={status.elapsed}
              slow={status.slow}
              problem={status.problem}
              onTryAnother={() => pickerRef.current?.choose()}
              onTakePhoto={() => pickerRef.current?.camera()}
              onCancel={cancel}
              onExpired={onExpired}
            />
          )
        }
      />
      <div className="visually-hidden" role="status" aria-live="polite">{sending ? upload.announcement : announcement}</div>
    </>
  );
}
