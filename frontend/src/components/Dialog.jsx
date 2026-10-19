import { useEffect, useId, useRef } from 'react';

// A modal dialog. While it is open, Tab stays inside it, Escape closes it, and focus goes back to the button that
// opened it afterwards. Mark one button with data-autofocus to choose where focus starts (default: the first control).
//   title     the heading, which also names the dialog for screen readers
//   onClose   called on Escape
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export default function Dialog({ title, onClose, children }) {
  const titleId = useId();
  const boxRef = useRef(null);
  const onCloseRef = useRef(onClose); // keeps the effect below from restarting when the parent re-renders
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const box = boxRef.current;
    (box.querySelector('[data-autofocus]') ?? box.querySelector(FOCUSABLE))?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = Array.from(box.querySelectorAll(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div className="scrim">
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={boxRef}>
        <h2 id={titleId} className="h4 mb-0">{title}</h2>
        {children}
      </div>
    </div>
  );
}
