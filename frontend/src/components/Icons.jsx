// Small line icons used inside messages and buttons. They are decoration only (aria-hidden); the text next to
// each one carries the meaning.
const paths = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  error: 'M12 8v5M12 16.5v.01',
  info: 'M12 11v5M12 7.5v.01',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  scan: 'M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10',
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {(name === 'error' || name === 'info') && <circle cx="12" cy="12" r="10" />}
      <path d={paths[name]} />
    </svg>
  );
}
