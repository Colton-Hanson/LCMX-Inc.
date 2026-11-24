// Receipt calls to the backend. Pages use these instead of fetch.
// Routes: POST /receipts, GET /receipts/{id}, PUT /receipts/{id}/items, POST /receipts/{id}/confirm, GET /receipts/{id}/picture.

import { API_PREFIX, request } from './http.js';

const RECEIPTS_PATH = `${API_PREFIX}/receipts`;

// Uploads the file. Uses XMLHttpRequest because fetch can't show upload progress.
// onProgress gets 0 to 100. Returns { promise, abort }.
// No Content-Type on purpose, the browser adds it.
export function uploadReceipt({ groupId, file, onProgress }) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve) => {
    xhr.open('POST', RECEIPTS_PATH);
    xhr.withCredentials = true; // keeps the login cookie
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // no data came back, leave it null
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, network: true });
    xhr.onabort = () => resolve({ ok: false, status: 0, aborted: true });
    const form = new FormData();
    form.append('group_id', String(groupId));
    form.append('file', file);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

// Gets one receipt and its status.
export const getReceipt = (receiptId) => request('GET', `${RECEIPTS_PATH}/${encodeURIComponent(receiptId)}`);

// Replaces the whole item list. items: [{ id, name, quantity, unit_price }]. Only works while the receipt is read and not saved yet.
// Items with an id are kept, items without one are new, and items left out are removed.
// The reply is the receipt with its items (and their new ids).
export const saveReceiptItems = (receiptId, items) =>
  request('PUT', `${RECEIPTS_PATH}/${encodeURIComponent(receiptId)}/items`, { items });

// Saves the receipt as an expense. body: { paid_by, description, event_id?, assignments: [{ item_id, shares: [{ user_id, amount }] }] }
// Amounts are strings like "3.50". Each item's shares must add up to its line total. Items left out of assignments are not added.
// 201: { receipt_id, expense_id, status: 'confirmed', amount, shares, excluded_item_ids }
export const confirmReceipt = (receiptId, body) =>
  request('POST', `${RECEIPTS_PATH}/${encodeURIComponent(receiptId)}/confirm`, body);

// The picture is a logged-in stream: GET it with the cookie. 404 means it was removed.
// Resolves to { ok: true, status, blob } or { ok: false, status, data?, network? }.
export async function getReceiptPicture(receiptId) {
  let res;
  try {
    res = await fetch(`${RECEIPTS_PATH}/${encodeURIComponent(receiptId)}/picture`, { credentials: 'include' });
  } catch {
    return { ok: false, status: 0, network: true };
  }
  if (res.ok) return { ok: true, status: res.status, blob: await res.blob() };
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body, leave it null
  }
  return { ok: false, status: res.status, data };
}
