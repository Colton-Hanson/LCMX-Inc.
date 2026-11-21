// The receipt picture in a big pop-up that can be zoomed. It zooms to the spot you point at, so a double click on
// the total zooms in on the total (not the corner).
//   + and - buttons or keys zoom around the middle of what you see, "Fit" goes back, double click toggles fit and 2x,
//   and with the mouse you can drag the picture around when it is zoomed in. A touch screen scrolls it by finger.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Dialog from '../Dialog.jsx';
import '../../sprint7.css';

export const ZOOMS = [1, 1.5, 2, 3, 4]; // 1 = fits the box; bigger = the picture grows and the box scrolls
const DOUBLE_CLICK_STEP = 2; // 200%

// Where to scroll so the spot you pointed at stays under your pointer after the picture changes size.
//   fx, fy  the spot as a fraction of the picture (0 to 1)
//   px, py  where the pointer is inside the box, in pixels
//   width, height  the picture's new size in pixels
export function scrollForAnchor({ fx, fy, px, py }, width, height) {
  return { left: Math.max(0, fx * width - px), top: Math.max(0, fy * height - py) };
}

const fraction = (value, fallback = 0.5) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback);

export default function PictureViewer({ url, alt, onClose }) {
  const [step, setStep] = useState(0);
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const anchor = useRef(null);
  const drag = useRef(null);
  const zoom = ZOOMS[step];

  // Zoom to `next`, keeping the point (clientX, clientY) where it is. Without a point, the middle of the visible area.
  const zoomTo = (next, clientX, clientY) => {
    const target = Math.min(ZOOMS.length - 1, Math.max(0, next));
    const box = boxRef.current?.getBoundingClientRect();
    const img = imgRef.current?.getBoundingClientRect();
    if (box && img) {
      const x = clientX ?? box.left + box.width / 2;
      const y = clientY ?? box.top + box.height / 2;
      anchor.current = {
        fx: fraction((x - img.left) / img.width),
        fy: fraction((y - img.top) / img.height),
        px: x - box.left,
        py: y - box.top,
      };
    }
    setStep(target);
  };

  // After the picture has its new size, scroll so the remembered spot is back under the pointer.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const img = imgRef.current;
    const a = anchor.current;
    anchor.current = null;
    if (!box || !img || !a) return;
    if (step === 0) {
      box.scrollLeft = 0;
      box.scrollTop = 0;
      return;
    }
    const { left, top } = scrollForAnchor(a, img.offsetWidth, img.offsetHeight);
    box.scrollLeft = left;
    box.scrollTop = top;
  }, [step]);

  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '+' || e.key === '=') zoomTo(stepRef.current + 1);
      else if (e.key === '-' || e.key === '_') zoomTo(stepRef.current - 1);
      else if (e.key === '0') zoomTo(0);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Mouse drag to move around while zoomed in (fingers just scroll the box).
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || step === 0) return;
    const box = boxRef.current;
    drag.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    boxRef.current.scrollLeft = d.left - (e.clientX - d.x);
    boxRef.current.scrollTop = d.top - (e.clientY - d.y);
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <Dialog title="Receipt picture" onClose={onClose} wide>
      <div className="pic-tools" role="group" aria-label="Zoom">
        <button type="button" className="btn btn-ghost pic-btn" onClick={() => zoomTo(step - 1)} disabled={step === 0} aria-label="Zoom out">−</button>
        <span className="pic-zoom" role="status">{`${Math.round(zoom * 100)}%`}</span>
        <button type="button" className="btn btn-ghost pic-btn" onClick={() => zoomTo(step + 1)} disabled={step === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        <button type="button" className="btn btn-ghost pic-btn" onClick={() => zoomTo(0)} disabled={step === 0}>Fit</button>
        <span className="pic-tip">Double click a spot to zoom there</span>
        <button type="button" className="btn btn-tint pic-btn pic-close" data-autofocus onClick={onClose}>Close</button>
      </div>
      <div
        className={`pic-scroll${step > 0 ? ' is-zoomed' : ''}`}
        ref={boxRef}
        tabIndex={0}
        aria-label="Receipt picture. Scroll to move around when zoomed in."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          className="pic-big"
          src={url}
          alt={alt}
          draggable={false}
          style={{ width: `${zoom * 100}%` }}
          onDoubleClick={(e) => zoomTo(step === 0 ? DOUBLE_CLICK_STEP : 0, e.clientX, e.clientY)}
        />
      </div>
    </Dialog>
  );
}
