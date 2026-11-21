import { useId, useState } from 'react';

// A person's short name. Tap it to show their email under it, tap again to hide it.
// With no email to show, it is plain text.
//   label  the short name, like "Alice R."
//   email  the full email (optional)
export default function PersonName({ label, email }) {
  const [open, setOpen] = useState(false);
  const emailId = useId();
  if (!email) return <span className="person">{label}</span>;
  return (
    <span className="person">
      <button
        type="button"
        className="person-tap"
        aria-expanded={open}
        aria-controls={open ? emailId : undefined}
        aria-label={`${label}, ${open ? 'hide' : 'show'} email`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && <span id={emailId} className="person-email">{email}</span>}
    </span>
  );
}
