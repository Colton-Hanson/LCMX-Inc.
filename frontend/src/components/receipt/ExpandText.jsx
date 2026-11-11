import { useLayoutEffect, useRef, useState } from 'react';

// One line of small text (file name, note). If it's cut off, a caret button shows the whole thing.
export default function ExpandText({ children, className = '' }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      if (!open) setClipped(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, open]);

  return (
    <div className="rc-expand">
      <p ref={ref} className={`${className} ${open ? 'is-open' : 'is-clip'}`.trim()}>{children}</p>
      {(clipped || open) && (
        <button
          type="button"
          className="rc-caret"
          aria-expanded={open}
          aria-label={open ? 'Show less' : 'Show the full text'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      )}
    </div>
  );
}
