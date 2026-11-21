import { useLayoutEffect, useRef, useState } from 'react';

// A quiet "go here next" cue. It sits inside the card that is next to fill in. A short line runs in from the finished
// card, then two strokes slip around this card's border, one each way, and meet on the far side. It plays once when it
// appears and then stays as a faint outline. It is decoration only (hidden from screen readers).
//   sourceRef  the finished card. On a wide screen the cards sit side by side, so the line comes in from the left
//              at the height of the finished card's middle. On a phone it comes in from the top, in the middle.
const R = 12; // the card's corner radius
const GAP = 24; // the space between cards

export default function FlowTrace({ sourceRef }) {
  const ref = useRef(null);
  const [geo, setGeo] = useState(null);

  useLayoutEffect(() => {
    const card = ref.current?.parentElement;
    if (!card) return undefined;
    const measure = () => {
      const c = card.getBoundingClientRect();
      const side = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 900px)').matches;
      let ey = c.height / 2;
      const source = sourceRef?.current;
      if (side && source) {
        const s = source.getBoundingClientRect();
        ey = Math.min(c.height - R, Math.max(R, s.top + s.height / 2 - c.top));
      }
      setGeo({ w: c.width, h: c.height, side, ey });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    if (sourceRef?.current) observer.observe(sourceRef.current);
    return () => observer.disconnect();
  }, [sourceRef]);

  if (!geo) return <svg ref={ref} className="flow-trace" aria-hidden="true" focusable="false" />;
  const { w, h, side, ey } = geo;
  const cx = w / 2;
  const arc = (sweep, x, y) => `A ${R} ${R} 0 0 ${sweep} ${x} ${y}`;
  const paths = side
    ? {
        line: `M ${-GAP} ${ey} L 0 ${ey}`,
        a: `M 0 ${ey} L 0 ${R} ${arc(1, R, 0)} L ${w - R} 0 ${arc(1, w, R)} L ${w} ${ey}`,
        b: `M 0 ${ey} L 0 ${h - R} ${arc(0, R, h)} L ${w - R} ${h} ${arc(0, w, h - R)} L ${w} ${ey}`,
      }
    : {
        line: `M ${cx} ${-GAP} L ${cx} 0`,
        a: `M ${cx} 0 L ${w - R} 0 ${arc(1, w, R)} L ${w} ${h - R} ${arc(1, w - R, h)} L ${cx} ${h}`,
        b: `M ${cx} 0 L ${R} 0 ${arc(0, 0, R)} L 0 ${h - R} ${arc(0, R, h)} L ${cx} ${h}`,
      };
  return (
    <svg ref={ref} className="flow-trace" aria-hidden="true" focusable="false">
      <path className="ft-line" d={paths.line} pathLength="100" />
      <path className="ft-a" d={paths.a} pathLength="100" />
      <path className="ft-b" d={paths.b} pathLength="100" />
    </svg>
  );
}
