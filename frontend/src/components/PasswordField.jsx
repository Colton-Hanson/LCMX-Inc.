// PasswordField.jsx — a reusable masked (dots) password input with a label and error message.
// Used for Password and Confirm password on Register, and Password on Login.

import { useId } from 'react'; // unique ids so label/error/hint connect to the right input

// Props:
//   label                 — text shown above the box ("Password", "Confirm password")
//   value / onChange      — current text + setter, owned by the parent page
//   onBlur                — called when the user leaves the field
//   error                 — error text to show ('' = none)
//   autoComplete          — 'new-password' (register) or 'current-password' (login) so password managers behave
//   describedBy           — id of extra helper text (the rules list) for screen readers to read with the field
//   children              — anything nested inside the component tags; here, the rules checklist
export default function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  describedBy,
  children,
}) {
  const id = useId(); // unique id for the input
  const errId = `${id}-err`; // unique id for its error message
  // Build the list of element ids a screen reader should read along with the field:
  // the error (only if there is one) and the helper text (if provided). Empty => undefined (omit the attribute).
  const describedIds = [error ? errId : null, describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field mb-3">
      <label htmlFor={id} className="form-label fw-semibold">{label}</label>
      {/* Same Bootstrap classes as the email box so the fields look identical (see EmailField.jsx). */}
      <input
        id={id}
        className={`form-control form-control-lg${error ? ' is-invalid' : ''}`}
        type="password" // THIS is what masks the characters as dots
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedIds}
      />
      {children /* the rules checklist renders here, directly under the box */}
      <p id={errId} className="error text-danger small mt-1 mb-0" role="alert">
        {error}
      </p>
    </div>
  );
}
