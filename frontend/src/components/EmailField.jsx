// EmailField.jsx — a reusable labelled email input with an error message slot.
// Used by both the Register and Login forms so they look and behave the same.

import { useId } from 'react'; // Generates a unique id per component so labels/errors link to the right input.

// Props (the inputs this component receives from its parent page):
//   value / onChange  — the current text and the function to call when the user types (the page owns the state)
//   onBlur            — called when the user leaves the field (Register uses this to show errors at that moment)
//   error             — error text to display ('' = none)
//   autoComplete      — hint for browsers/password managers ('email' by default)
export default function EmailField({ value, onChange, onBlur, error, autoComplete = 'email' }) {
  const id = useId(); // unique id for this input, e.g. ":r1:"
  const errId = `${id}-err`; // matching id for its error message
  return (
    <div className="field mb-3">
      {/* htmlFor ties this label to the input with the same id: clicking the label focuses the
          input, and screen readers announce "Email" when the input is focused. */}
      <label htmlFor={id} className="form-label fw-semibold">Email</label>
      {/* Bootstrap classes: form-control = styled box, form-control-lg = tall (about 48px, easy to tap on a phone),
          is-invalid = red outline when there's an error. */}
      <input
        id={id}
        className={`form-control form-control-lg${error ? ' is-invalid' : ''}`}
        type="email" // phones show an email keyboard; browsers know it's an email field
        inputMode="email" // extra hint for mobile keyboards
        value={value} // controlled input: React state is the single source of truth
        onChange={(e) => onChange(e.target.value)} // pass the newly typed text up to the page
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : 'false'} // tells screen readers whether the field currently has a problem
        aria-describedby={error ? errId : undefined} // makes screen readers read the error with the field
      />
      {/* role="alert" makes screen readers announce the error text as soon as it appears. */}
      <p id={errId} className="error text-danger small mt-1 mb-0" role="alert">
        {error}
      </p>
    </div>
  );
}
