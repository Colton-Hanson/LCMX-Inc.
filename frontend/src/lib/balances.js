// balances.js — turns the GET /balances reply into the rows and totals the Balances page shows.
// The reply has ids only, so the page passes in the emails and group names to put next to them.

import { toCents } from './splits.js';

// Label for a person who is no longer in the group.
export const FORMER_MEMBER = 'Former member';

// Biggest amount first, then by group, then by name.
const byAmount = (a, b) => b.cents - a.cents || a.groupId - b.groupId || a.name.localeCompare(b.name);

const sumCents = (rows) => rows.reduce((sum, row) => sum + row.cents, 0);

// The expenses behind one person's balance, seen from your side. Only expenses where one of you paid and the other
// has a share count. Returns { lines, netCents }:
//   lines     { id, title, cents, toYou } where toYou is true when the expense made them owe you
//   netCents  what they owe you (negative when you owe them), adding up every line
function expenseLines(expenses, myId, otherId) {
  const lines = [];
  expenses.forEach((e) => {
    const payer = e.paid_by;
    if (payer !== myId && payer !== otherId) return;
    const cents = toCents(e.shares?.[payer === myId ? otherId : myId]);
    if (cents > 0) lines.push({ id: e.id, title: e.description, cents, toYou: payer === myId });
  });
  const netCents = lines.reduce((sum, l) => sum + (l.toYou ? l.cents : -l.cents), 0);
  return { lines, netCents };
}

// The lines for a row: the ones that make up the balance first (biggest first), then the ones that reduce it
// (offset: true). Empty when they don't add up to the balance the server sent.
function rowLines(expenses, myId, otherId, owes, cents) {
  if (!expenses) return [];
  const { lines, netCents } = expenseLines(expenses, myId, otherId);
  if (netCents !== (owes ? -cents : cents)) return [];
  return lines
    .map((l) => ({ id: l.id, title: l.title, cents: l.cents, offset: l.toYou === owes }))
    .sort((a, b) => a.offset - b.offset || b.cents - a.cents || b.id - a.id);
}

// balances       the reply of GET /balances (only group_balances is used: one balance per person per group)
// emailsByGroup  { groupId: { userId: 'email' } } from each group's member list
// groupNames     { groupId: 'name' } for the groups this browser knows; others show as "Group 7"
// expensesByGroup  { groupId: [expense] } from GET /groups/{id}/expenses; a group left out gets rows without lines
// myId           your user id (to tell which expenses you paid)
// Returns { owedToYou, youOwe, owedTotal, oweTotal, hasRows }
//   owedToYou / youOwe  rows { key, groupId, groupName, userId, name, cents, lines }, biggest first
//   lines  the expenses behind the amount: { id, title, cents, offset }, offset = it reduces the amount
//   owedTotal / oweTotal  the two totals in cents
//   hasRows  false when the server sent no balances at all
export function buildBalances({ balances, emailsByGroup = {}, groupNames = {}, expensesByGroup = {}, myId }) {
  const list = balances?.group_balances ?? [];
  const owedToYou = [];
  const youOwe = [];

  list.forEach((b) => {
    const row = {
      key: `${b.group_id}-${b.other_user_id}`,
      groupId: b.group_id,
      groupName: groupNames[b.group_id] ?? `Group ${b.group_id}`,
      userId: b.other_user_id,
      name: emailsByGroup[b.group_id]?.[b.other_user_id] ?? FORMER_MEMBER,
    };
    const owed = toCents(b.owed_to_you) ?? 0; // what they owe you
    const owe = toCents(b.you_owe) ?? 0; // what you owe them
    const expenses = expensesByGroup[b.group_id];
    if (owed > 0) owedToYou.push({ ...row, cents: owed, lines: rowLines(expenses, myId, b.other_user_id, false, owed) });
    else if (owe > 0) youOwe.push({ ...row, cents: owe, lines: rowLines(expenses, myId, b.other_user_id, true, owe) });
  });

  owedToYou.sort(byAmount);
  youOwe.sort(byAmount);
  return { owedToYou, youOwe, owedTotal: sumCents(owedToYou), oweTotal: sumCents(youOwe), hasRows: list.length > 0 };
}
