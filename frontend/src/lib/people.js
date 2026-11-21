// Short names for people, so screens aren't full of long emails.
//   "Alice Rivera" -> "Alice R."     "Alice" -> "Alice"
//   no name: the start of the email is used, "alice.rivera@x.com" -> "Alice R.", "alice@x.com" -> "Alice"

// A word typed all in one case ("alice", "ALICE") becomes "Alice". Mixed case ("McKie") is left alone.
function tidy(word) {
  const letters = word.replace(/[^\p{L}]/gu, '');
  const oneCase = letters === letters.toLowerCase() || letters === letters.toUpperCase();
  return oneCase ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word;
}

export function personLabel({ name, email } = {}) {
  let words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    const local = String(email ?? '').split('@')[0];
    words = local.split(/[._+-]+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  }
  if (words.length === 0) return 'Member';
  const first = tidy(words[0]);
  if (words.length === 1) return first;
  const initial = Array.from(words[words.length - 1])[0].toUpperCase();
  return `${first} ${initial}.`;
}

// Labels for a list of members [{ user_id, name, email }] as { userId: label }.
// If two people would get the same label, the later ones get a number: "Alice R.", "Alice R. (2)".
// The email is still one tap away on the screen, so they can be told apart.
export function labelsFor(members) {
  const labels = {};
  const seen = {};
  [...(members ?? [])]
    .sort((a, b) => a.user_id - b.user_id)
    .forEach((m) => {
      const base = personLabel(m);
      seen[base] = (seen[base] ?? 0) + 1;
      labels[m.user_id] = seen[base] === 1 ? base : `${base} (${seen[base]})`;
    });
  return labels;
}
