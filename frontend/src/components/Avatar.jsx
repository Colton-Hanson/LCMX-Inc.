// Round avatar with the person's initials (two letters, like "CH" for "Colton H."), in one of five colors.
// The color comes from the INITIALS only, so the same person is the same color everywhere: "Johnson Davis",
// "Johnson D." and "Johnson D. (you)" are all "JD". The letters are decoration (aria-hidden); the name is always
// written next to it.
//   single  true for a group or an event: one letter only (the first letter of its name)
const COLORS = 5;

// "Colton H. (you)" -> "CH", "Bob" -> "B", "alice@example.com" -> "A". The "(you)" and "(2)" tags are ignored.
export function initialsOf(text, single = false) {
  const clean = String(text ?? '').replace(/\s*\((you|\d+)\)\s*$/i, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const first = (w) => Array.from(w).find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? Array.from(w)[0] ?? '';
  const letters = single ? [first(words[0] ?? '')] : words.slice(0, 2).map(first);
  return letters.join('').toUpperCase() || '?';
}

function colorFor(initials) {
  let hash = 7;
  for (const ch of initials) hash = (hash * 31 + ch.codePointAt(0)) % 100003;
  return (hash % COLORS) + 1;
}

// The color class for a name, for things that match an avatar (the share bar, the top-bar circle).
export const avatarClass = (text, single = false) => `av-${colorFor(initialsOf(text, single))}`;

export default function Avatar({ text, large = false, single = false }) {
  const initials = initialsOf(text, single);
  return (
    <span className={`av av-${colorFor(initials)}${large ? ' av--lg' : ''}${initials.length > 1 ? ' av--two' : ''}`} aria-hidden="true">
      {initials}
    </span>
  );
}
