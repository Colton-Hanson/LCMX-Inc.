// Backend calls for expenses and balances. Pages import these small functions and never call fetch directly.
// Every function resolves to { ok, status, data?, network? } (see http.js).
//
// Routes used:
//   POST /expenses   GET /groups/{id}/expenses   GET /balances

import { API_PREFIX, request } from './http.js';

// Saves one expense for a group and splits it between the people in participantIds.
//   amount        the total as a dollar string with 2 decimals, like "10.00"
//   paidBy        user id of the person who paid (must be an accepted member; they need not be in the split)
//   participantIds  user ids who share the expense. The order matters: leftover cents go to the first ones.
//   splitMethod   'even' | 'custom' | 'percentage'
//   splitValues   { userId: "amount" or "percent" } for custom and percentage; leave out for even
// Success is 201 with { id, group_id, description, amount, paid_by, created_at, shares, rounding_adjusted_member_ids }
// where shares is { userId: "3.34" }. A 422 carries data.detail as a plain sentence for a split that does not add up.
export const createExpense = ({ groupId, description, amount, paidBy, participantIds, splitMethod, splitValues }) =>
  request('POST', `${API_PREFIX}/expenses`, {
    group_id: groupId,
    description: String(description ?? '').trim(),
    amount: String(amount),
    paid_by: paidBy,
    participant_ids: participantIds,
    split_method: splitMethod,
    split_values: splitValues,
  });

// A group's expenses, newest first: [{ id, group_id, description, amount, paid_by, created_at, shares }].
// Accepted members only; anyone else gets a 403.
export const getGroupExpenses = (groupId) => request('GET', `${API_PREFIX}/groups/${groupId}/expenses`);

// The signed-in user's balances: { group_balances, overall_balances, total_net }.
//   group_balances    [{ group_id, other_user_id, net_amount, you_owe, owed_to_you }]
//   overall_balances  [{ other_user_id, net_amount, you_owe, owed_to_you }]
// Amounts are dollar strings. A positive net_amount means that person owes YOU; negative means you owe them.
// The replies hold ids only (no names or emails).
export const getBalances = () => request('GET', `${API_PREFIX}/balances`);
