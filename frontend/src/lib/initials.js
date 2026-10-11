// Letters shown in the round avatar: the first letter of the first two words of the name
// ("Cole Hanson" -> "CH"), one letter for a single word, or the email's first letter when there is no name.
export function initialsFor(name, email) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words.slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase();
  }
  return Array.from((email ?? '').trim())[0]?.toUpperCase() ?? '?';
}
