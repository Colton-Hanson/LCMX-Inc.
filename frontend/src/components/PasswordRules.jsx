// PasswordRules.jsx — the live checklist shown under the password box on the Register page.
// Each rule flips from "○ not met" to "✓ met" as the user types.

import { useId } from 'react';
import { checkPasswordRules } from '../lib/validators.js'; // the rule definitions live in validators.js

// Props:
//   password — the current password text (the list re-draws every time it changes)
//   id       — optional element id so the password input can point at this list via aria-describedby
export default function PasswordRules({ password, id }) {
  const fallbackId = useId(); // used only if the parent didn't pass an id
  const rules = checkPasswordRules(password); // [{id, label, met}, ...]
  return (
    <ul className="rules list-unstyled small mt-2 mb-0" id={id ?? fallbackId} aria-label="Password requirements">
      {rules.map((r) => (
        // `key` helps React track list items. Bootstrap's text colors show the state: green + bold when met, gray when not.
        <li key={r.id} className={r.met ? 'met text-success fw-semibold' : 'unmet text-body-secondary'}>
          {/* The ✓/○ symbol is decorative (aria-hidden) because we also spell out the status in text below,
              so the checklist never depends on color or symbols alone. */}
          <span aria-hidden="true">{r.met ? '✓' : '○'}</span> {r.label}
          {/* visually-hidden (Bootstrap) = visible to screen readers only (hidden on screen). */}
          <span className="visually-hidden">{r.met ? ' (met)' : ' (not met yet)'}</span>
        </li>
      ))}
    </ul>
  );
}
