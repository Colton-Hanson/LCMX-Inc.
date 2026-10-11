import { useId } from 'react';

// Labelled text input with an error message slot, matching EmailField and PasswordField.
// Props:
//   label, value, onChange(value), onBlur, error ('' for none), type, autoComplete, inputMode, disabled
//   describedBy  id of extra helper text that screen readers should read with the field
//   children     rendered directly under the input (helper text, checklists)
export default function TextField({
  label,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  describedBy,
  disabled,
  children,
}) {
  const id = useId(); // unique id so the label and the input are linked
  const errId = `${id}-err`; // id of the error message below
  // Everything a screen reader should read along with the input: the error (if there is one) and the helper text.
  const describedIds = [error ? errId : null, describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field mb-3">
      <label htmlFor={id} className="form-label fw-semibold">{label}</label>
      <input
        id={id}
        className={`form-control form-control-lg${error ? ' is-invalid' : ''}`}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedIds}
      />
      {children}
      {/* role="alert" makes screen readers read the error out as soon as it appears. */}
      <p id={errId} className="error text-danger small mt-1 mb-0" role="alert">
        {error}
      </p>
    </div>
  );
}
