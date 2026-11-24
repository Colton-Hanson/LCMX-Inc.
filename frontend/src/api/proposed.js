// Backend calls for settling up, changing an expense and deleting a receipt picture.
// Routes: POST and GET /groups/{id}/settlements, PUT and DELETE /expenses/{id}, DELETE /receipts/{id}/picture.

import { API_PREFIX, request } from './http.js';

// True only when the server can't be reached, or says it can't do this (405, 501).
// Any other error (404, 403, 409, 422) has its own message from the server, so it is not "not available".
export function isNotAvailable(result) {
  if (!result || result.ok) return false;
  return Boolean(result.network) || result.status === 405 || result.status === 501;
}

// Records a payment made outside the app. paidBy and recipient are user ids, amount is a string like "12.50".
// 201: { id, group_id, paid_by, recipient, amount, recorded_by, settlement_time, remaining_debt }
export const recordSettlement = ({ groupId, paidBy, recipient, amount }) =>
  request('POST', `${API_PREFIX}/groups/${groupId}/settlements`, {
    paid_by: paidBy,
    recipient,
    amount: String(amount),
  });

// One group's settlements, newest first: [{ id, group_id, paid_by, recipient, amount, recorded_by, settlement_time }]
export const getGroupSettlements = (groupId) => request('GET', `${API_PREFIX}/groups/${groupId}/settlements`);

// Same body as creating an expense. The group can't change. eventId is optional.
export const updateExpense = (expenseId, { groupId, description, amount, paidBy, eventId, participantIds, splitMethod, splitValues }) =>
  request('PUT', `${API_PREFIX}/expenses/${expenseId}`, {
    group_id: groupId,
    description: String(description ?? '').trim(),
    amount: String(amount),
    paid_by: paidBy,
    event_id: eventId ?? null,
    participant_ids: participantIds,
    split_method: splitMethod,
    split_values: splitValues,
  });

// Deletes an expense. 200: { message, expense_id }
export const deleteExpense = (expenseId) => request('DELETE', `${API_PREFIX}/expenses/${expenseId}`);

// Deletes the saved picture and keeps the items. 200: { receipt_id, picture_deleted, expense_id }
export const deleteReceiptPicture = (receiptId) =>
  request('DELETE', `${API_PREFIX}/receipts/${encodeURIComponent(receiptId)}/picture`);
