import { useEffect, useRef, useState } from 'react';
import { uploadReceipt } from '../api/receipts.js';
import { uploadErrorFromResult } from './receiptErrors.js';

// Uploads the picked file and tracks it for the screen.
//  phase: 'idle', 'uploading' or 'failed'
//  percent: 0 to 100
//  file, error: the file being sent, and the error if it failed
//  announcement: short line for screen readers
//  start(file) uploads. cancel() stops it and goes back to idle.
export function useReceiptUpload({ groupId, onUploaded, onExpired }) {
  const [phase, setPhase] = useState('idle');
  const [percent, setPercent] = useState(0);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef(null);
  const lastStep = useRef(-1);
  const latest = useRef({});
  latest.current = { groupId, onUploaded, onExpired };

  // Leaving the page cancels the upload.
  useEffect(() => () => abortRef.current?.(), []);

  async function start(chosen) {
    setFile(chosen);
    setError(null);
    setPercent(0);
    setPhase('uploading');
    lastStep.current = -1;
    setAnnouncement(`Uploading ${chosen.name}`);
    const { promise, abort } = uploadReceipt({
      groupId: latest.current.groupId,
      file: chosen,
      onProgress: (p) => {
        setPercent(p);
        // Screen readers hear every 25 percent.
        const step = Math.floor(p / 25);
        if (step > lastStep.current) {
          lastStep.current = step;
          setAnnouncement(`Uploading ${p} percent`);
        }
      },
    });
    abortRef.current = abort;
    const result = await promise;
    abortRef.current = null;
    if (result.aborted) return;
    if (result.ok) {
      setPhase('idle');
      latest.current.onUploaded(result.data, chosen);
      return;
    }
    if (result.status === 401) {
      latest.current.onExpired?.();
      return;
    }
    const failure = uploadErrorFromResult(result);
    setError(failure);
    setAnnouncement(`Upload failed. ${failure.message} ${failure.action}`);
    setPhase('failed');
  }

  function cancel() {
    abortRef.current?.();
    abortRef.current = null;
    setPhase('idle');
    setFile(null);
    setError(null);
    setPercent(0);
    setAnnouncement('Cancelled. Choose a receipt to start again.');
  }

  return { phase, percent, file, error, announcement, start, cancel };
}
