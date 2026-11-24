import '../../sprint7.css';

// The small receipt slip, drawn from the data (not a photo).
//   lines  [{ key, label, amount }]
//   total  "46.40"
export default function MiniReceipt({ store, location, date, lines, total }) {
  const count = lines.length;
  const label = `Receipt: ${store || 'no store name'}${date ? `, ${date}` : ''}, ${count} ${count === 1 ? 'item' : 'items'}, total ${total}`;
  const scrolls = count > 10;
  return (
    <div className="slip" role="group" aria-label={label}>
      <div className="sl-h">
        <span className="sl-l">{(store || 'Receipt').toUpperCase()}</span>
        {location && <span className="sl-a">{location}</span>}
        {date && <span className="sl-d">{date}</span>}
      </div>
      <div className="sl-b" tabIndex={scrolls ? 0 : undefined} role={scrolls ? 'group' : undefined} aria-label={scrolls ? 'Receipt items, scrolls' : undefined}>
        {lines.map((line) => (
          <div key={line.key}>
            <span className="sl-n">{line.label}</span>
            <span>{line.amount}</span>
          </div>
        ))}
      </div>
      <div className="sl-t">
        <span>TOTAL</span>
        <span>{total}</span>
      </div>
    </div>
  );
}
