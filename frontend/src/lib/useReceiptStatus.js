import { useEffect, useRef, useState } from 'react';
import { getReceipt } from '../api/receipts.js';

export const POLL_MS = 2000; // how often we check
export const SLOW_AFTER_SECONDS = 90; // then show the taking longer note
const FAILS_BEFORE_NOTICE = 3; // bad checks in a row before the connection message

// Keeps checking one receipt until it's read, failed or missing.
//  state: 'waiting', 'read' or 'failed'
//  receipt: latest one from the server
//  elapsed: seconds waited
//  slow: waited past 90 seconds
//  problem: several checks failed in a row (it keeps trying)
// onExpired = logged out. onMissing = receipt can't be opened. A null receiptId pauses it.
export function useReceiptStatus(receiptId, onExpired, onMissing) {
  const [state, setState] = useState('waiting');
  const [receipt, setReceipt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [problem, setProblem] = useState(false);
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;
  const missingRef = useRef(onMissing);
  missingRef.current = onMissing;

  useEffect(() => {
    if (receiptId == null) return undefined;
    let cancelled = false;
    let timer = null;
    let fails = 0;
    setState('waiting');
    setReceipt(null);
    setProblem(false);
    setElapsed(0);

    async function check() {
      const result = await getReceipt(receiptId);
      if (cancelled) return;
      if (result.ok) {
        fails = 0;
        setProblem(false);
        setReceipt(result.data);
        const status = result.data?.status;
        if (status === 'read' || status === 'failed') {
          setState(status);
          return;
        }
        timer = setTimeout(check, POLL_MS);
        return;
      }
      if (result.status === 401) {
        expiredRef.current?.();
        return;
      }
      // Won't fix itself, so stop. Anything else keeps retrying.
      if (result.status >= 400 && result.status < 500 && result.status !== 429) {
        missingRef.current?.();
        return;
      }
      fails += 1;
      if (fails >= FAILS_BEFORE_NOTICE) setProblem(true);
      timer = setTimeout(check, POLL_MS);
    }
    check();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [receiptId]);

  // Seconds for the on-screen timer. Stops when done.
  useEffect(() => {
    if (receiptId == null || state !== 'waiting') return undefined;
    const startedAt = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [state, receiptId]);

  return { state, receipt, elapsed, slow: elapsed >= SLOW_AFTER_SECONDS, problem };
}
