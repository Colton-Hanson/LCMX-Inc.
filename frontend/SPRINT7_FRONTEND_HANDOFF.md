# Sprint 7 Frontend Handoff

## Done

- SCRUM-136 Settle up: on the Balances screen, using the real settlement routes.
- SCRUM-137 Delete receipt picture: on the receipt status and review screens, using the real picture routes.
- SCRUM-135 Edit and delete expense: from the group page and the Balances screen, using the real expense routes.
- SCRUM-134 Check and assign (receipt review): saves through the real confirm route.

## What was built

- **Settle up (136):** Pay and Mark received open a dialog (full or part, then confirm). History merges every group, newest first. Lines stay after a settlement.
- **Receipt picture (137):** the real picture shows under the slip, or "Picture removed". Delete is for the uploader or an admin, once the receipt is not uploaded or reading.
- **Edit and delete expense (135):** admin only, as the server allows (switch: `PAYER_AND_CREATOR_MAY_CHANGE` in `src/lib/expensePermissions.js`). Server 403 and 409 messages show. Event is sent on add and edit.
- **Check and assign (134):** fix items, pick who shares each, optional event, then Save confirms the receipt with cent-exact shares. A confirmed receipt shows "Already added to the group".

## Routes used

All paths go through the dev proxy at `/api`. Money is sent as a string like `"12.50"`.

| Screen | Call | Route |
|---|---|---|
| Settle dialog | Record a payment | `POST /groups/{id}/settlements` with `paid_by`, `recipient`, `amount` |
| Settlement history | List payments (one call per group) | `GET /groups/{id}/settlements` giving `id`, `group_id`, `paid_by`, `recipient`, `amount`, `recorded_by`, `settlement_time` |
| Add expense | Save | `POST /expenses` with `group_id`, `description`, `amount`, `paid_by`, `event_id`, `participant_ids`, `split_method`, `split_values` |
| Edit expense | Save the edit | `PUT /expenses/{id}`, same body (the group can't change) |
| Delete expense | Delete | `DELETE /expenses/{id}` |
| Review | Save item changes | `PUT /receipts/{id}/items` (items with an `id` are kept, no `id` is new, left out is removed) |
| Review | Save as an expense | `POST /receipts/{id}/confirm` with `paid_by`, `description`, optional `event_id`, `assignments: [{ item_id, shares: [{ user_id, amount }] }]` |
| Status and review | Show the picture | `GET /receipts/{id}/picture` (404 when removed) |
| Status and review | Delete the picture | `DELETE /receipts/{id}/picture` |

"Not available yet" now shows only when the server can't be reached or answers 405 or 501. Every other error shows the server's message.

## How to run it

From the `frontend/` folder:

```
npm install
npm test
npm run dev
npm run build
```

On Windows, run the tests from a terminal whose folder path uses an upper-case drive letter. A lower-case drive letter can make the test runner load its matcher library twice, and then hundreds of tests fail with "Invalid Chai property".

## See every state

http://localhost:5173/dev/sprint7-preview shows every screen and state with sample data. It only works with `npm run dev` and is not in the production build.

## Still open on the backend

- The expense list has no "added by" field and no flag for a receipt-linked expense, so the frontend can't hide Edit and Delete for those ahead of time. The server's 409 message shows instead.
- Edit and delete are admin only for now.
- Nothing reads receipts yet, so a real upload stays at `uploaded` until a reader exists.

## Tests

32 test files, 524 tests, all pass. The production build passes. The Sprint 7 files are `settleUp`, `deletePicture`, `expenseEditDelete` and `receiptReview`, plus updates to `balances`, `balancesLib`, `addExpense`, `expensesApi`, `receiptScreens` and `useReceiptStatus`.

Also walked in a real browser against a copy of the iteration 7 backend, all passing: A add, edit (with event) and delete an expense; B settle up (part, then the rest, history, server errors); C a plain member sees no Edit or Delete, and a direct 403 shows the server message; D upload, read, review, assign and confirm; E delete the picture (items stay, 409 while waiting); F edit or delete the receipt-linked expense (server 409). Details and screenshot names are in `SPRINT7_FINDINGS.md`.
