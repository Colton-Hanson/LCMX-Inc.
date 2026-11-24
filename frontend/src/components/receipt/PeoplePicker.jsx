// A button that opens a small panel to pick people: search, Everyone, None, Done and a chip per person.
import { useId, useLayoutEffect, useRef, useState } from 'react';
import Avatar from '../Avatar.jsx';

// One box in the grid. The name stays on one line. If it is cut off, a small caret opens the whole name
// (wrapped over more lines) and closes it again. The caret is its own button, so picking the person still works.
function PersonChip({ person, on, onToggle }) {
  const nameRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return undefined;
    const measure = () => {
      if (!open) setClipped(el.scrollWidth > el.clientWidth); // any cut-off, even 1px, shows the caret
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [person.name, open]);

  const hasMore = clipped || open;
  return (
    <div className={`pk-cell${open ? ' is-open' : ''}${hasMore ? ' has-more' : ''}`}>
      <button type="button" className={`pchip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onToggle}>
        <Avatar text={person.name} />
        <span ref={nameRef} className="pchip-name">{person.name}</span>
      </button>
      {hasMore && (
        <button
          type="button"
          className="pk-more"
          aria-expanded={open}
          aria-label={`${open ? 'Show less of' : 'Show all of'} ${person.name}`}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      )}
    </div>
  );
}

//   people    [{ id, name }] to choose from
//   selected  ids that are in
//   label     the words on the button, like "2 of 3"
//   name      what this picks for, read out with the button ("Who is in on Milk")
export default function PeoplePicker({ people, selected, onChange, label, name, open, onToggle }) {
  const panelId = useId();
  const [query, setQuery] = useState('');
  const shown = people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const stack = people.filter((p) => selected.includes(p.id)).slice(0, 4);

  return (
    <>
      <div className="pk-head">
        {stack.length > 0 && (
          <span className="stk" aria-hidden="true">
            {stack.map((p) => <Avatar key={p.id} text={p.name} />)}
          </span>
        )}
        <button type="button" className="sumb" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={`${name}: ${label}`} onClick={onToggle}>
          {label}
        </button>
      </div>
      {open && (
        <div className="pk-panel" id={panelId} role="group" aria-label={name}>
          <div className="pk-tools">
            <input className="form-in pk-search" type="text" placeholder="Search people" aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} />
            {/* One button, not two: "None" while everyone is in, "Everyone" otherwise (the top button already says Everyone (n)) */}
            {people.length > 0 && people.every((p) => selected.includes(p.id))
              ? <button type="button" className="btn btn-ghost btn-s" onClick={() => onChange([])}>None</button>
              : <button type="button" className="btn btn-ghost btn-s" onClick={() => onChange(people.map((p) => p.id))}>Everyone</button>}
            <button type="button" className="btn btn-tint btn-s" onClick={onToggle}>Done</button>
          </div>
          <div className="pk-list">
            {shown.map((p) => (
              <PersonChip key={p.id} person={p} on={selected.includes(p.id)} onToggle={() => toggle(p.id)} />
            ))}
            {shown.length === 0 && <p className="sm-mute">Nobody matches that search.</p>}
          </div>
        </div>
      )}
    </>
  );
}
