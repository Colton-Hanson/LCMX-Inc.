// A button that opens a small panel to pick people: search, Everyone, None, Done and a chip per person.
import { useId, useState } from 'react';
import Avatar from '../Avatar.jsx';

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
            <button type="button" className="btn btn-ghost btn-s" onClick={() => onChange(people.map((p) => p.id))}>Everyone</button>
            <button type="button" className="btn btn-ghost btn-s" onClick={() => onChange([])}>None</button>
            <button type="button" className="btn btn-tint btn-s" onClick={onToggle}>Done</button>
          </div>
          <div className="pk-list">
            {shown.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button key={p.id} type="button" className={`pchip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(p.id)}>
                  <Avatar text={p.name} />
                  <span className="pchip-name">{p.name}</span>
                </button>
              );
            })}
            {shown.length === 0 && <p className="sm-mute">Nobody matches that search.</p>}
          </div>
        </div>
      )}
    </>
  );
}
