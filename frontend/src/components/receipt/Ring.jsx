// Circle for upload progress. percent is 0 to 100.
const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Ring({ percent }) {
  return (
    <svg
      className="rc-ring"
      viewBox="0 0 36 36"
      role="progressbar"
      aria-label="Upload progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <circle className="track" cx="18" cy="18" r={RADIUS} />
      <circle
        className="bar"
        cx="18"
        cy="18"
        r={RADIUS}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
      />
    </svg>
  );
}
