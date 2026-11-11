import { useEffect, useRef } from 'react';
import ExpandText from './ExpandText.jsx';
import Ring from './Ring.jsx';

// The 'Upload status' card on the upload screen.
//  phase: 'idle', 'uploading' or 'failed'
//  focusHeading: focus the heading (used after Cancel)
export default function UploadStatusCard({ phase, fileName, percent, error, onTryAgain, onChooseAnother, onCancel, focusHeading }) {
  const errorTitle = useRef(null);
  const heading = useRef(null);
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [focusHeading]);
  // On a failure, focus goes to the heading so screen readers hear it.
  useEffect(() => {
    if (phase === 'failed') errorTitle.current?.focus();
  }, [phase]);

  return (
    <section className="panel" aria-labelledby="st-title">
      <h2 id="st-title" tabIndex={-1} ref={heading}>Upload status</h2>
      <div>
        {phase === 'idle' && (
          <div className="srow">
            <span className="idlecircle" aria-hidden="true" />
            <div className="srow-body">
              <p style={{ fontWeight: 700 }}>Nothing uploaded yet</p>
              <p className="mute sm">Pick a receipt and it uploads right away.</p>
            </div>
          </div>
        )}
        {phase === 'uploading' && (
          <div className="srow">
            <Ring percent={percent} />
            <div className="srow-body">
              <p style={{ fontWeight: 700 }}>Uploading… {percent}%</p>
              <ExpandText className="mute sm">{fileName}</ExpandText>
            </div>
          </div>
        )}
        {phase === 'failed' && (
          <div className="srow" role="alert">
            <span className="badcircle">
              <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17v.01" /></svg>
            </span>
            <div className="srow-body">
              <p className="title-bad" tabIndex={-1} ref={errorTitle}>Upload failed</p>
              <p>{error?.message}</p>
              <p className="mute sm">{error?.action}</p>
              {fileName && <ExpandText className="mute sm">{fileName}</ExpandText>}
            </div>
          </div>
        )}
      </div>
      <div className="btn-row">
        {phase === 'failed' && (
          <>
            <button className="btn btn-tint" type="button" onClick={onTryAgain}>Try again</button>
            <button className="btn btn-ghost" type="button" onClick={onChooseAnother}>Choose another file</button>
          </>
        )}
        {phase !== 'failed' && <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </section>
  );
}
