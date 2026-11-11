import { forwardRef, useId, useImperativeHandle, useRef } from 'react';

// The 'Choose your receipt' card: group, file buttons and how-to.
// Group gets locked once an upload starts. Parent can reopen the picker with ref.choose() or ref.camera().
const PickCard = forwardRef(function PickCard({ groups, groupId, onGroupChange, groupLocked, onFile, disabled }, ref) {
  const groupFieldId = useId();
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  useImperativeHandle(ref, () => ({ choose: () => fileInput.current?.click(), camera: () => cameraInput.current?.click() }));

  // clear it so picking the same file again still works
  function handleChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  }

  return (
    <section className="panel" aria-labelledby="u-title">
      <h2 id="u-title">Choose your receipt</h2>
      <div className="field">
        <label htmlFor={groupFieldId} className="form-label fw-semibold">Group</label>
        <select
          id={groupFieldId}
          className="form-select form-select-lg"
          value={groupId}
          disabled={groupLocked}
          onChange={(e) => onGroupChange(Number(e.target.value))}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div className="pick">
        <svg className="ic" style={{ width: 40, height: 40, color: 'var(--pri)' }} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /></svg>
        <p style={{ fontWeight: 600 }}>Add a photo or PDF of a receipt or bill.</p>
        <div className="btn-row">
          <button className="btn btn-tint" type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>Choose a file</button>
          <button className="btn btn-ghost" type="button" disabled={disabled} onClick={() => cameraInput.current?.click()}>Take a photo</button>
        </div>
        <p className="mute sm">JPEG photos and PDFs work.</p>
        <input ref={fileInput} type="file" hidden tabIndex={-1} accept="image/jpeg,application/pdf,.jpg,.jpeg,.pdf" onChange={handleChange} data-testid="file-input" />
        <input ref={cameraInput} type="file" hidden tabIndex={-1} accept="image/jpeg" capture="environment" onChange={handleChange} data-testid="camera-input" />
      </div>
      <div className="how">
        <div>
          <h3><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v12H3zM8 20h8M12 16v4" /></svg>On a computer</h3>
          <ol className="sl">
            <li><span className="sn" aria-hidden="true">1</span><p className="st">Click Choose a file</p><p className="mute sm sd">Your file explorer opens.</p></li>
            <li><span className="sn" aria-hidden="true">2</span><p className="st">Pick your receipt</p><p className="mute sm sd">A JPEG photo or a PDF.</p></li>
            <li><span className="sn" aria-hidden="true">3</span><p className="st">Wait for the green check</p><p className="mute sm sd">That means it uploaded.</p></li>
          </ol>
        </div>
        <div>
          <h3><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2" /></svg>On a phone</h3>
          <ol className="sl">
            <li><span className="sn" aria-hidden="true">1</span><p className="st">Tap Choose a file</p><p className="mute sm sd">Or tap Take a photo to use the camera.</p></li>
            <li><span className="sn" aria-hidden="true">2</span><p className="st">Pick Photos or Files</p><p className="mute sm sd">Photos has your pictures. Files has PDFs.</p></li>
            <li><span className="sn" aria-hidden="true">3</span><p className="st">Wait for the green check</p><p className="mute sm sd">That means it uploaded.</p></li>
          </ol>
        </div>
      </div>
      <p className="mute sm">You can delete the picture later. The items stay on the expense.</p>
    </section>
  );
});

export default PickCard;
