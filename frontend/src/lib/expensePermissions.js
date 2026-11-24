// Who may edit or delete an expense. Today the server only lets a group admin do it (403 for anyone else).
// If the server later also lets the payer or the person who added it, switch this to true.
export const PAYER_AND_CREATOR_MAY_CHANGE = false;

// created_by is read when the server sends it.
export function canChangeExpense({ expense, myId, isAdmin = false }) {
  if (!expense || myId == null) return false;
  if (isAdmin) return true;
  if (!PAYER_AND_CREATOR_MAY_CHANGE) return false;
  return expense.paid_by === myId || (expense.created_by != null && expense.created_by === myId);
}

// The line shown to people who can't change an expense.
export const CHANGE_RULE_TEXT = PAYER_AND_CREATOR_MAY_CHANGE
  ? 'Only the person who paid, the person who added it, or a group admin can change this expense.'
  : 'Only a group admin can change this expense.';
