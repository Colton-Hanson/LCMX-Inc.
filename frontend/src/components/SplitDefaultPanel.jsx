// "Default split" card on Group settings: even, or a percentage for each member.
// New expenses in the group start on it; the Add expense screen still lets a person pick something else.
import { useState } from 'react';
import Message from './Message.jsx';
import SplitWho from './SplitWho.jsx';
import { useAuth } from './RequireAuth.jsx';
import { checkPercents, defaultBasisPoints, getSplitDefault, saveSplitDefault } from '../lib/splitDefault.js';
import { formatBasisPoints } from '../lib/splits.js';
import '../addExpense.css';

const METHODS = [
  { id: 'even', label: 'Even' },
  { id: 'percentage', label: 'Percentage' },
];

// groupId  the group
// members  accepted members [{ user_id, email }]
export default function SplitDefaultPanel({ groupId, members }) {
  const { profile } = useAuth();
  const ids = members.map((m) => m.user_id);

  const saved = getSplitDefault(groupId);
  const [method, setMethod] = useState(saved.method);
  const [texts, setTexts] = useState(() => textsFor(saved, ids)); // typed percentage for each member
  const [attempted, setAttempted] = useState(false); // true after Save was pressed with percentages that don't add up
  const [notice, setNotice] = useState(null); // { kind, text } after saving

  const check = checkPercents(ids, texts);
  const total = 10000 - check.difference;

  function chooseMethod(next) {
    setMethod(next);
    setNotice(null);
    setAttempted(false);
  }

  function setText(id, text) {
    setTexts((t) => ({ ...t, [id]: text }));
    setNotice(null);
  }

  function save(e) {
    e.preventDefault();
    if (method === 'percentage' && !check.valid) {
      setAttempted(true);
      setNotice(null);
      return;
    }
    const value = method === 'even' ? { method: 'even', percents: {} } : { method: 'percentage', percents: check.basisPoints };
    if (saveSplitDefault(groupId, value)) {
      setAttempted(false);
      setNotice({ kind: 'ok', text: method === 'even' ? 'Default split saved: even.' : 'Default split saved: percentages.' });
    } else {
      setNotice({ kind: 'error', text: 'We couldn’t save the default split in this browser.' });
    }
  }

  return (
    <section className="panel" aria-labelledby="split-default-title">
      <h2 id="split-default-title">Default split</h2>
      <p className="text-body-secondary mb-0">
        New expenses in this group start with this split. You can still pick another split on each expense.
      </p>

      <form onSubmit={save} noValidate aria-label="Default split" className="d-flex flex-column gap-3">
        <div className="seg split-seg" role="group" aria-label="Default split method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={method === m.id ? 'is-on' : ''}
              aria-pressed={method === m.id}
              onClick={() => chooseMethod(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === 'even' && <p className="text-body-secondary mb-0">Everyone in an expense pays the same share.</p>}

        {method === 'percentage' && (
          <div>
            <ul className="split-list" aria-label="Each member’s percentage">
              {members.map((m) => {
                const invalid = check.invalidIds.includes(m.user_id);
                const unbalanced = attempted && !check.valid && check.invalidIds.length === 0;
                const errorId = `split-default-err-${m.user_id}`;
                return (
                  <li key={m.user_id} className="split-row split-row--edit">
                    <SplitWho email={m.email} you={m.user_id === profile.id} />
                    <div className="input-group split-field">
                      <input
                        className={`form-control${invalid ? ' is-invalid' : ''}`}
                        value={texts[m.user_id] ?? ''}
                        onChange={(e) => setText(m.user_id, e.target.value)}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Default percentage for ${m.email}`}
                        aria-invalid={invalid || unbalanced ? 'true' : 'false'}
                        aria-describedby={invalid ? errorId : undefined}
                      />
                      <span className="input-group-text" aria-hidden="true">%</span>
                    </div>
                    {invalid && (
                      <p id={errorId} className="error text-danger small w-100 m-0" role="alert">Enter a number from 0 to 100.</p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3">
              <div
                className={`split-bar ${check.difference === 0 ? 'is-done' : check.difference < 0 ? 'is-over' : ''}`}
                role="progressbar"
                aria-label="Percentage assigned"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, Math.round(total / 100)))}
                aria-valuetext={`${formatBasisPoints(total)}% of 100%`}
              >
                <span style={{ width: `${Math.min(100, Math.max(0, total / 100))}%` }} />
              </div>
              <p className="split-summary" role="status">
                <span>{formatBasisPoints(total)}% of 100%</span>
                {check.invalidIds.length === 0 && check.message && <span className="is-bad">{check.message}</span>}
              </p>
            </div>
          </div>
        )}

        {attempted && !check.valid && <Message kind="error" alert>Can’t save yet. {check.message}</Message>}
        {notice && (
          <Message kind={notice.kind} alert={notice.kind === 'error'} {...(notice.kind === 'ok' ? { role: 'status' } : {})}>
            {notice.text}
          </Message>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-tint">Save default split</button>
        </div>
      </form>
    </section>
  );
}

// Starting texts for the percentage boxes: the saved percentages, or equal ones.
function textsFor(saved, ids) {
  const points = defaultBasisPoints(saved, ids);
  return Object.fromEntries(ids.map((id) => [id, formatBasisPoints(points[id])]));
}
