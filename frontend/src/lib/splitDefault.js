// Helpers for a group's default split (the data itself comes from the backend, see api/groups.js).
// A default is { method: 'even' | 'percentage', percents: { userId: basisPoints } }, 5000 = 50%.

import { toBasisPoints } from './splits.js';

export const EVEN_DEFAULT = { method: 'even', percents: {} };

// Equal percentages for these people in basis points; the first people get the extra basis points.
function equalBasisPoints(ids) {
  const base = Math.floor(10000 / ids.length);
  const left = 10000 % ids.length;
  return Object.fromEntries(ids.map((id, i) => [id, base + (i < left ? 1 : 0)]));
}

// The percentages (basis points, adding up to 10000) to start an expense on for the people in it.
// Uses the group's saved percentages scaled to just these people; equal when the group is even, when someone has
// no saved percentage, or when the saved ones are all zero.
export function defaultBasisPoints(saved, ids) {
  if (ids.length === 0) return {};
  const weights = ids.map((id) => saved.percents[id]);
  const usable = saved.method === 'percentage' && weights.every(Number.isInteger) && weights.some((w) => w > 0);
  if (!usable) return equalBasisPoints(ids);

  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((w * 10000) / sum));
  const left = 10000 - out.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, rest: (w * 10000) % sum }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  order.slice(0, left).forEach(({ i }) => {
    out[i] += 1;
  });
  return Object.fromEntries(ids.map((id, i) => [id, out[i]]));
}

// Checks what was typed for each person in the default split.
//   texts  { userId: 'text' } (blank counts as 0)
// Returns { valid, basisPoints, invalidIds, difference, message }
//   basisPoints  { userId: number } for the people whose text could be read
//   difference   basis points still to assign (negative = over 100%)
export function checkPercents(ids, texts) {
  const basisPoints = {};
  const invalidIds = [];
  ids.forEach((id) => {
    const text = String(texts[id] ?? '').trim();
    const value = text === '' ? 0 : toBasisPoints(text);
    if (value === null) invalidIds.push(id);
    else basisPoints[id] = value;
  });
  const difference = 10000 - Object.values(basisPoints).reduce((a, b) => a + b, 0);
  let message = '';
  if (invalidIds.length) message = 'Enter each percentage as a number from 0 to 100.';
  else if (difference > 0) message = `${(difference / 100).toFixed(2)}% left to assign.`;
  else if (difference < 0) message = `${(-difference / 100).toFixed(2)}% over 100%.`;
  return { valid: !invalidIds.length && difference === 0, basisPoints, invalidIds, difference, message };
}
