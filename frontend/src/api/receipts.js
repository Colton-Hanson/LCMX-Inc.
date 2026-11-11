// Receipt calls to the backend. Pages use these instead of fetch.
// Routes: POST /receipts and GET /receipts/{id}.

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
