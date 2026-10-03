// validators.js — pure "is this input OK?" functions. No React and no network in here,
// which makes them easy to test (see validators.test.js).
// Convention: each validate function returns an error message string, or '' (empty) when the input is fine.
// NOTE: these checks are only for helpful feedback in the browser. The server must ALWAYS re-check,
// because anyone can bypass browser code.

// A "regular expression" describing the shape of an email: something@something.tld
//   ^            start of the text
//   [^\s@]+      one or more characters that are NOT whitespace and NOT "@"  (the part before @)
//   @            a literal @
//   [^\s@]+      one or more non-space, non-@ characters (the domain, e.g. "umkc")
//   \.           a literal dot
//   [^\s@]{2,}   two or more characters (the ending, e.g. "edu")
//   $            end of the text
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email) {
  // `?? ''` means "if email is null/undefined, use an empty string"; trim() removes spaces at the ends.
  const value = (email ?? '').trim();
  if (!value) return 'Enter your email address.'; // nothing typed
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address, like name@example.com.'; // wrong shape
  return ''; // '' = no error
}

// The password rules from the requirements doc (Create Account use case):
// 8 characters, 1 capital letter, 1 symbol, "etc." — the "etc." is still undefined by the team.
// Each rule has: an id, the text shown to the user, and a test() that returns true when satisfied.
// TO ADD A RULE: add one more object to this list. The checklist on screen AND the validation
// below both read this list, so nothing else needs to change.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'capital', label: 'At least 1 capital letter', test: (p) => /[A-Z]/.test(p) }, // any A–Z
  { id: 'symbol', label: 'At least 1 symbol (e.g. ! @ # $ %)', test: (p) => /[^A-Za-z0-9\s]/.test(p) }, // not a letter, number, or space
];

// Runs every rule against the password and reports which are met. Used to draw the live checklist.
export function checkPasswordRules(password) {
  const p = password ?? ''; // treat missing as an empty string
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(p) }));
}

// Overall password check used when the user leaves the field or submits.
export function validatePassword(password) {
  if (!password) return 'Create a password.'; // nothing typed yet
  const unmet = checkPasswordRules(password).filter((r) => !r.met); // keep only the rules NOT satisfied
  return unmet.length ? 'Your password doesn’t meet all the requirements yet.' : '';
}

// The "confirm password" box must be filled in and must exactly match the first password box.
export function validateConfirm(password, confirm) {
  if (!confirm) return 'Re-enter your password.';
  if (password !== confirm) return 'Passwords don’t match.';
  return '';
}
