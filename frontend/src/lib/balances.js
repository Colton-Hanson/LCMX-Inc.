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
// (offset: true). settled is true when the expenses alone don't add up to the balance the server sent,
// which is what happens after a settlement. The lines still show and the balance stays the server's number.
function rowLines(expenses, myId, otherId, owes, cents) {
  if (!expenses) return { lines: [], settled: false };
  const { lines, netCents } = expenseLines(expenses, myId, otherId);
  const sorted = lines
    .map((l) => ({ id: l.id, title: l.title, cents: l.cents, offset: l.toYou === owes }))
    .sort((a, b) => a.offset - b.offset || b.cents - a.cents || b.id - a.id);
  return { lines: sorted, settled: sorted.length > 0 && netCents !== (owes ? -cents : cents) };
}

// balances       the reply of GET /balances (only group_balances is used: one balance per person per group)
// emailsByGroup  { groupId: { userId: 'email' } } from each group's member list
// groupNames     { groupId: 'name' } for the groups this browser knows; others show as "Group 7"
// expensesByGroup  { groupId: [expense] } from GET /groups/{id}/expenses; a group left out gets rows without lines
// myId           your user id (to tell which expenses you paid)
// Returns { owedToYou, youOwe, paidUp, owedTotal, oweTotal, hasRows }
//   paidUp  rows where nothing is owed either way (cents 0, no lines)
//   owedToYou / youOwe  rows { key, groupId, groupName, userId, name, cents, lines }, biggest first
//   lines  the expenses behind the amount: { id, title, cents, offset }, offset = it reduces the amount
//   settled  true when the lines don't add up to the amount because settlements are included in it
//   owedTotal / oweTotal  the two totals in cents
//   hasRows  false when the server sent no balances at all
export function buildBalances({ balances, emailsByGroup = {}, groupNames = {}, expensesByGroup = {}, myId }) {
  const list = balances?.group_balances ?? [];
  const owedToYou = [];
  const youOwe = [];
  const paidUp = [];

  list.forEach((b) => {
    const row = {
      key: `${b.group_id}-${b.other_user_id}`,
      groupId: b.group_id,
      groupName: b.group_name ?? groupNames[b.group_id] ?? `Group ${b.group_id}`,
      userId: b.other_user_id,
      name: emailsByGroup[b.group_id]?.[b.other_user_id] ?? FORMER_MEMBER,
    };
    const owed = toCents(b.owed_to_you) ?? 0; // what they owe you
    const owe = toCents(b.you_owe) ?? 0; // what you owe them
    const expenses = expensesByGroup[b.group_id];
    if (owed > 0) owedToYou.push({ ...row, cents: owed, ...rowLines(expenses, myId, b.other_user_id, false, owed) });
    else if (owe > 0) youOwe.push({ ...row, cents: owe, ...rowLines(expenses, myId, b.other_user_id, true, owe) });
    else paidUp.push({ ...row, cents: 0, lines: [], settled: false });
  });

  owedToYou.sort(byAmount);
  youOwe.sort(byAmount);
  paidUp.sort(byAmount);
  return { owedToYou, youOwe, paidUp, owedTotal: sumCents(owedToYou), oweTotal: sumCents(youOwe), hasRows: list.length > 0 };
}
