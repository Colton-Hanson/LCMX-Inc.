// A group's default split: one per group, set in Group settings, even until someone changes it.
// The Add expense screen opens on it, and a person can still pick another split on each expense.
// Saved in localStorage as { method: 'even' | 'percentage', percents: { userId: basisPoints } }, 5000 = 50%.
// Storage can be blocked or empty, so every read and write is wrapped and the pages still work without it.

// =====================================================================================================
// WORKAROUND(no default split route)  --  START of the "default split" workaround
//
// THE PROBLEM
//   The database already has a column for this (user_groups.split_percentage, empty means even), but the backend has
//   no route that reads or saves it, and GET /groups/{id}/members does not send it.
//
// THE WORKAROUND (this file)
//   This browser keeps the default in localStorage, one entry per group.
//
// WHAT IT CANNOT DO (known limits, on purpose)
//   - It lives in ONE browser. Another member, another computer or cleared site data sees the group as even.
//   - Anyone in the group can change it for now.
//
// HOW TO REMOVE IT (when the backend can read and save split_percentage)
//   1. In api/groups.js add a request that saves the percentages, and read them from the members list.
//   2. SplitDefaultPanel.jsx and AddExpensePage.jsx: use those instead of getSplitDefault / saveSplitDefault.
//   3. Delete this file (search this repo for "WORKAROUND(no default split route)").
// =====================================================================================================

import { toBasisPoints } from './splits.js';

const keyFor = (groupId) => `splitDefault:${groupId}`;

export const EVEN_DEFAULT = { method: 'even', percents: {} };

const isDefault = (d) =>
  d &&
  (d.method === 'even' || d.method === 'percentage') &&
  d.percents &&
  typeof d.percents === 'object' &&
  Object.values(d.percents).every((n) => Number.isInteger(n) && n >= 0 && n <= 10000);

// The saved default for a group. Even when nothing is saved or storage is unavailable.
export function getSplitDefault(groupId) {
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(groupId)));
    return isDefault(saved) ? saved : EVEN_DEFAULT;
  } catch {
    return EVEN_DEFAULT;
  }
}

// Saves a group's default. Returns false when the browser would not store it.
export function saveSplitDefault(groupId, value) {
  try {
    localStorage.setItem(keyFor(groupId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

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

// WORKAROUND(no default split route)  --  END of the "default split" workaround (see the banner at the top of this file)
