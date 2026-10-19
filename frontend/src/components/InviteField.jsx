import { useId } from 'react';

// "Invite by email" row: a labelled email box with a button beside it. Enter in the box presses the button,
// so it works inside a bigger form without submitting that form.
// Props: label, value, onChange(value), onSubmit(), buttonLabel, error ('' for none), hint (helper text),
//        busy (disables the button while a request runs), buttonKind ('tint' | 'ghost')
export default function InviteField({ label, value, onChange, onSubmit, buttonLabel, error, hint, busy = false, buttonKind = 'ghost' }) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="form-label fw-semibold">{label}</label>
      <div className="invite-row">
        <input
          id={id}
          className={`form-control form-control-lg${error ? ' is-invalid' : ''}`}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="name@example.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!busy) onSubmit();
            }
          }}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
        />
        <button type="button" className={`btn btn-${buttonKind === 'tint' ? 'tint' : 'ghost'}`} onClick={onSubmit} disabled={busy}>
          {buttonLabel}
        </button>
      </div>
      <p id={errId} className="error text-danger small mt-1 mb-0" role="alert">{error}</p>
      {hint && <p id={hintId} className="text-body-secondary small mt-1 mb-0">{hint}</p>}
    </div>
  );
}
