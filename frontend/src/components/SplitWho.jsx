// The person at the start of a split row: avatar and email. On phones an email longer than NAME_LIMIT characters
// is cut short with "…" and gets a small arrow that opens the full email on its own line. Shorter emails get no arrow.
import { useState } from 'react';
import Avatar from './Avatar.jsx';

export const NAME_LIMIT = 22; // characters

// email  the person's email
// you    true for the signed-in user, adds "(you)"
export default function SplitWho({ email, you = false }) {
  const [open, setOpen] = useState(false);
  const long = email.length > NAME_LIMIT;

  return (
    <span className={`split-who${long ? ' is-long' : ''}${open ? ' is-open' : ''}`}>
      <Avatar text={email} />
      <span className="split-name">{you ? `${email} (you)` : email}</span>
      {long && (
        <button
          type="button"
          className="split-more"
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} the full email for ${email}`}
          onClick={() => setOpen((o) => !o)}
        >
          <svg className="split-more-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </span>
  );
}
