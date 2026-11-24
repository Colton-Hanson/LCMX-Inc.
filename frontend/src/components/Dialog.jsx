import { useEffect, useId, useRef } from 'react';

// A modal dialog. While it is open, Tab stays inside it, Escape closes it, and focus goes back to the button that
// opened it afterwards. Mark one button with data-autofocus to choose where focus starts (default: the first control).
//   title     the heading, which also names the dialog for screen readers
//   description  optional line under the heading, read out with it
//   onClose   called on Escape
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

//   wide      true for a big box (the zoomed receipt picture)
export default function Dialog({ title, description, onClose, children, wide = false }) {
  const titleId = useId();
  const descId = useId();
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

  // A click on the dark area outside the box closes it, the same as Cancel. It only counts when the press
  // and the release are both on the dark area, so dragging to select text from inside the box doesn't close it.
  const pressedOutside = useRef(false);
  const onScrimDown = (e) => {
    pressedOutside.current = e.target === e.currentTarget;
  };
  const onScrimClick = (e) => {
    if (pressedOutside.current && e.target === e.currentTarget) onClose();
    pressedOutside.current = false;
  };

  return (
    <div className="scrim" onMouseDown={onScrimDown} onClick={onScrimClick}>
      <div className={`dlg${wide ? ' dlg--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} ref={boxRef}>
        <h2 id={titleId} className="h4 mb-0">{title}</h2>
        {description && <p id={descId} className="text-body-secondary">{description}</p>}
        {children}
      </div>
    </div>
  );
}
