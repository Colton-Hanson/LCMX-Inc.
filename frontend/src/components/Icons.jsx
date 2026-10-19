// Small line icons used inside messages and buttons. They are decoration only (aria-hidden); the text next to
// each one carries the meaning.
const paths = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  error: 'M12 8v5M12 16.5v.01',
  info: 'M12 11v5M12 7.5v.01',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {(name === 'error' || name === 'info') && <circle cx="12" cy="12" r="10" />}
      <path d={paths[name]} />
    </svg>
  );
}
