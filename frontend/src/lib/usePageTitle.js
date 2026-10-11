import { useEffect } from 'react';

const APP_NAME = 'Shared Expense Management Tool';

// Sets the browser tab title for the current page ("Settings – Shared Expense Management Tool").
// Screen readers announce the title when a page opens, so each page needs its own.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} – ${APP_NAME}`;
  }, [title]);
}
