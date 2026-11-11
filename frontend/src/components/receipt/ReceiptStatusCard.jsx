import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { summarizeReceipt } from '../../lib/money.js';
import ExpandText from './ExpandText.jsx';

const READING_LINES = ['Looking for the store and the date…', 'Finding every item…', 'Matching each item with its price…'];
const LINE_MS = 4000;

const formatElapsed = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function CheckRow({ title, children, bold }) {
  return (
    <div className="srow">
      <span className="okcircle"><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
      <div className="srow-body">
        <p className={bold ? 'title-ok' : undefined} style={bold ? undefined : { fontWeight: 700 }}>{title}</p>
        {children}
      </div>
    </div>
  );
}

// Lines that rotate while the AI works so it doesn't look stuck.
function ReadingLines() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % READING_LINES.length), LINE_MS);
    return () => clearInterval(timer);
  }, []);
  return <p className="mute sm" aria-hidden="true">{READING_LINES[index]}</p>;
}

// The 'Upload status' card after the file is saved.
//  state: 'waiting', 'read' or 'failed'
//  onCancel: forgets this receipt and goes back to the empty upload screen
export default function ReceiptStatusCard({ state, receipt, fileName, elapsed, slow, problem, receiptId, onTryAnother, onTakePhoto, onCancel }) {
  const headingRef = useRef(null);
  // Move focus to the heading when the screen changes.
  useEffect(() => {
    headingRef.current?.focus();
  }, [state]);

  const summary = state === 'read' ? summarizeReceipt(receipt) : null;
  const uploaded = (
    <CheckRow title="Upload successful" bold>
      {fileName && <ExpandText className="mute sm">{fileName}</ExpandText>}
    </CheckRow>
  );

  return (
    <section className="panel" aria-labelledby="st-title">
      <h2 id="st-title" tabIndex={-1} ref={headingRef}>Upload status</h2>

      {state === 'waiting' && (
        <div>
          {uploaded}
          <div className="srow">
            <span className="rc-spin" aria-hidden="true" />
            <div className="srow-body">
              <p style={{ fontWeight: 700 }}>The AI is reading it</p>
              <ReadingLines />
              <p className="mute sm timer">Time so far: {formatElapsed(elapsed)}</p>
            </div>
          </div>
          {slow && <p className="mute sm status-note">This is taking longer than usual. You can keep waiting.</p>}
          {problem && <p className="mute sm status-note">We’re having trouble reaching the server. Still trying.</p>}
        </div>
      )}

      {state === 'read' && (
        <>
          <div>
            {uploaded}
            <CheckRow title="The AI finished reading it">
              <p className="mute sm">It picked out the store, the date, and every item with its price.</p>
            </CheckRow>
          </div>
          <dl className="kv" aria-label="What the AI found">
            <dt>Store</dt><dd>{summary.store || '—'}</dd>
            <dt>Date</dt><dd>{summary.date || '—'}</dd>
            <dt>Items</dt><dd>{summary.itemCount} found</dd>
            <dt>Total</dt><dd className="money">{summary.total}</dd>
          </dl>
          <p className="mute sm">The AI can make mistakes. You will check every item on the next screen before anything is saved.</p>
        </>
      )}

      {state === 'failed' && (
        <div>
          {uploaded}
          <div className="srow" role="alert">
            <span className="badcircle"><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17v.01" /></svg></span>
            <div className="srow-body">
              <p className="title-bad">The AI couldn’t read this receipt</p>
              <p className="mute sm">Try another picture or take a new photo.</p>
            </div>
          </div>
        </div>
      )}

      <div className="btn-row">
        {state === 'read' && <Link className="btn btn-tint" to={`/receipts/${receiptId}/review`}>Check the items</Link>}
        {state === 'failed' && (
          <>
            <button className="btn btn-tint" type="button" onClick={onTryAnother}>Try another picture</button>
            <button className="btn btn-ghost" type="button" onClick={onTakePhoto}>Take a new photo</button>
          </>
        )}
        {state !== 'failed' && <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </section>
  );
}
