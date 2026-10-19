// Round avatar with one letter, in one of five colors chosen from the text so the same person or group
// always gets the same color. The letter is decoration (aria-hidden); the name is always written next to it.
const COLORS = 5;

function colorFor(text) {
  let sum = 0;
  for (const ch of text) sum += ch.codePointAt(0);
  return (sum % COLORS) + 1;
}

export default function Avatar({ text, large = false }) {
  const value = String(text ?? '').trim();
  const letter = Array.from(value)[0]?.toUpperCase() ?? '?';
  return (
    <span className={`av av-${colorFor(value)}${large ? ' av--lg' : ''}`} aria-hidden="true">
      {letter}
    </span>
  );
}
