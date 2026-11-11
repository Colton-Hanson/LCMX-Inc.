import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Dialog from '../Dialog.jsx';

// The 'Scan a receipt' pop-up on Home. Pick a group, Continue opens the upload screen.
// No groups yet: asks them to make one first.
export default function ScanDialog({ groups, onClose }) {
  const navigate = useNavigate();
  const groupFieldId = useId();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? null);

  return (
    <Dialog title="Scan a receipt" onClose={onClose}>
      <div className="rc-dlg-scope d-flex flex-column gap-3">
        {groups.length === 0 ? (
          <>
            <p className="mute">Create a group first, then add expenses to it.</p>
            <div className="btn-row">
              <Link className="btn btn-tint" to="/groups/new" data-autofocus>Create group</Link>
              <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="mute">Add a photo or PDF. The AI reads it, then you check every item.</p>
            <div className="field">
              <label htmlFor={groupFieldId} className="form-label fw-semibold">Group</label>
              <select
                id={groupFieldId}
                className="form-select form-select-lg"
                value={groupId}
                onChange={(e) => setGroupId(Number(e.target.value))}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <p className="mute sm">JPEG or PDF. On a phone you can pick from Photos or Files.</p>
            <div className="btn-row">
              <button className="btn btn-tint" type="button" onClick={() => navigate(`/receipts/new?group=${groupId}`)}>Continue</button>
              <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
