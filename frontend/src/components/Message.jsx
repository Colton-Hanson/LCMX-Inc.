import Icon from './Icons.jsx';

// A boxed message with an icon. kind: 'ok' | 'error' | 'warn' | 'info'.
//   alert    true makes screen readers read it out as soon as it appears (use for errors)
//   boxRef   optional ref to the box, so a page can move focus to it after an action
const ICON = { ok: 'check', error: 'error', warn: 'alert', info: 'info' };

export default function Message({ kind = 'info', alert = false, boxRef, children, ...rest }) {
  return (
    <div className={`msg msg--${kind}`} role={alert ? 'alert' : undefined} ref={boxRef} {...rest}>
      <Icon name={ICON[kind]} />
      <div className="msg-text">{children}</div>
    </div>
  );
}
