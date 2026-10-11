// Four-slice pie mark used in the top bar. It is decorative: the app name is always rendered
// as text beside it, so screen readers skip the graphic.
// One entry per pie slice: `d` is the shape (an SVG path) and `fill` is its colour.
const SLICES = [
  { d: 'M38 38 L29.200 5.159 A34 34 0 0 1 62.042 13.958 Z', fill: '#ffc43d' },
  { d: 'M38 38 L62.042 13.958 A34 34 0 0 1 43.904 71.483 Z', fill: '#2fb5a6' },
  { d: 'M38 38 L43.904 71.483 A34 34 0 0 1 4.000 38.000 Z', fill: '#ff7a70' },
  { d: 'M38 38 L4.000 38.000 A34 34 0 0 1 29.200 5.159 Z', fill: '#8e9bf0' },
];

// size: rendered width and height in pixels.
export default function Logo({ size = 38 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 76 76" aria-hidden="true" focusable="false">
      {SLICES.map((slice) => (
        <path key={slice.fill} d={slice.d} fill={slice.fill} />
      ))}
      {/* Outline around the whole pie. Its look comes from .logo-mark in styles.css. */}
      <circle cx="38" cy="38" r="34" />
    </svg>
  );
}
