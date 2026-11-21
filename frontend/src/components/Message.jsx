import Icon from './Icons.jsx';

// A boxed message with an icon. kind: 'ok' | 'error' | 'warn' | 'info'.
//   alert    true makes screen readers read it out as soon as it appears (use for errors)
//   boxRef   optional ref to the box, so a page can move focus to it after an action
const ICON = { ok: 'check', error: 'error', warn: 'alert', info: 'info' };

//   onClose  when given, a small grey X closes the message (it stays until closed otherwise)
export default function Message({ kind = 'info', alert = false, boxRef, onClose, children, ...rest }) {
  return (
    <div className={`msg msg--${kind}`} role={alert ? 'alert' : undefined} ref={boxRef} {...rest}>
      <Icon name={ICON[kind]} />
      <div className="msg-text">{children}</div>
      {onClose && (
        <button type="button" className="msg-close" aria-label="Dismiss message" onClick={onClose}>
          <svg className="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}
