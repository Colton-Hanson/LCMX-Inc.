# Sprint 7 Frontend Handoff

Small things we could use from the back end are listed in `BACKEND_NOTES.md`.

## How to run it

You need Node.js 20 or newer. The backend must already be running (see the main README).

### The frontend

Open a terminal in the `frontend/` folder and run:

```
npm install     # one time
npm run dev     # starts the app at http://localhost:5173
npm test        # runs the automated tests
npm run build   # only needed for deployment
```

Two Windows tips:
- If PowerShell blocks `npm`, type `npm.cmd` instead.
- Run the tests from a terminal whose folder path starts with an upper-case drive letter (`C:\...`, not `c:\...`). Otherwise hundreds of tests can fail with "Invalid Chai property".

### The temporary receipt reader

Only needed to read receipts you upload. Without it, an upload stays at "uploaded". It lives in the `temporary-reader` folder at the top of the repo, and it needs Python 3.12.

1. Double-click `temporary-reader\Start_Receipt_Reader.bat`.
2. The first time only: wait about a minute while it sets itself up, then paste the API key you were given. It saves the key in `temporary-reader\.env`. Git ignores that file. Never commit it.
3. Leave the window open. Close it to stop the reader.
4. Upload a receipt in the app. Within a few seconds it goes from "uploaded" to "reading" to "read", and the review screen opens.

Good to know:
- The key stops working on Nov 23.
- The reader never changes the backend. It only reads `backend/.env` to find the database.
- Delete the whole `temporary-reader` folder when the real reader is built into the backend.
- Its own tests (no network): run `.venv\Scripts\python.exe -m pytest` from that folder.

## Done

- SCRUM-136 Settle up: on the Balances screen, using the real settlement routes.
- SCRUM-137 Delete receipt picture: on the receipt status and review screens, using the real picture routes.
- SCRUM-135 Edit and delete expense: from the group page and the Balances screen, using the real expense routes.
- SCRUM-134 Check and assign (receipt review): saves through the real confirm route.
- Groups list and group default split: read from the server (no browser storage).
- Balances page: compact rows that start closed, with Expand all and Collapse all.

## What was built

- **Settle up (136):** Pay and Mark received open a dialog (full or part, then confirm). History merges every group, newest first. Lines stay after a settlement. The top card shows the full amount owed to you this month (still owed plus what was paid to you this month, from the settlements the server lists) and how much of it has come in. A pill on a row comes only from the server: green "Payment received" when the payer recorded it, yellow "Received (manual)" when you recorded the full payment yourself (`recorded_by` is you). A part payment you recorded, where the person still owes more, shows no pill, only "Mark received" (that pill is switched off by `SHOW_MANUAL_PILL_ON_PARTIAL` in `BalancesPage.jsx`, and the code is kept). The green paid message has a grey X to close it. The backend has no settlement undo or confirm field, so a recorded payment canâ€™t be undone and nothing is kept in the browser. Clicking the dark area outside a dialog closes it, like Cancel.
- **Names, dates and order:** people show as a short name ("Alice R.", or the start of the email when no name is set). A tap on the name shows the email, a second tap hides it. Balances rows are newest first (the later of the person's newest expense and your newest payment with them) and show a small grey day under the amount (Today, Yesterday, Nov 20). Each expense line shows its day when a row is opened. "+N more" opens the same list as the caret. Dialogs open centred. The receipt reading screen says "Items subtotal", because only the items are saved. The group page and the New event page use the same short names. Avatars show two initials ("CH") and one stable colour per person, taken from the initials, so a person is the same colour everywhere (a group or event avatar shows one letter). Group settings, Settings and invites still show full emails.
- **Receipt picture (137):** the real picture shows under the slip, or "Picture removed". Pressing the picture opens it in a pop-up (`PictureViewer.jsx`) with zoom buttons (100% to 400%), + and - keys, a Fit button, and a double click that zooms in on the spot you clicked (a second double click goes back to fit). With a mouse you can drag it around; on a phone you scroll it by finger. Delete is for the uploader or an admin, once the receipt is not uploaded or reading.
- **Edit and delete expense (135):** admin only, as the server allows (switch: `PAYER_AND_CREATOR_MAY_CHANGE` in `src/lib/expensePermissions.js`). Server 403 and 409 messages show. Event is sent on add and edit. On Balances each expense line has an underlined Edit link; Delete expense is on the edit screen and asks first.
- **Groups and default split:** Home, Groups, Add expense, the receipt screens and Balances read `GET /groups`. A group page opened without its name asks `GET /groups/{id}`. The default split loads from and saves to `/groups/{id}/split-default`; if it can't be loaded, Add expense starts on an even split.
- **Balances layout:** every row starts closed with a one-line summary. The caret on the row opens it, and one button switches between Expand all and Collapse all. While a row is open the grey summary line is hidden. Expand all sits small in the top-right corner. The minus-amount note and the settlements note stay.
- **Check and assign (134):** fix items, pick who shares each, optional event, then Save confirms the receipt with cent-exact shares. A confirmed receipt shows "Already added to the group". Items are labelled "Item #1, #2, â€¦". The people picker has one Everyone/None button (it says None while everyone is in) and is 5 boxes across on wide screens, 3 up to 900 px and 2 up to 560 px, so a name always sits beside its avatar.
- **Group page events:** every event shows the pie logo, a "Split between N people" caret (closed by default) that lists each person with their share of the event's expenses, and the expenses that carry that event's id ("No expenses yet" when none). It uses only `GET /groups/{id}/events` (`member_ids`) and `GET /groups/{id}/expenses` (`event_id`, `shares`). The backend does not check that people on an event expense are members of the event, so an expense can include someone outside it. That person is listed after the members, marked "not in this event", so the shares add up to the expense totals. Each event expense line also says who paid. Recent expenses and Events each have a small Expand all / Collapse all button, and Events has a smaller New event button.
- **Add expense and Settings (fix round):** the "Who is in this expense?" box is a button: tap it to take everyone out, or put everyone in. Choosing "No event" keeps whoever is picked; only a real event changes the split. Settings has a "â† Home" link. The split bar shows every person's colour.

## Routes used

All paths go through the dev proxy at `/api`. Money is sent as a string like `"12.50"`.

| Screen | Call | Route |
|---|---|---|
| Settle dialog | Record a payment | `POST /groups/{id}/settlements` with `paid_by`, `recipient`, `amount` |
| Settlement history | List payments (one call per group) | `GET /groups/{id}/settlements` giving `id`, `group_id`, `paid_by`, `recipient`, `amount`, `recorded_by`, `settlement_time` |
| Home, Groups, Add expense, receipt screens, Balances | My groups | `GET /groups` giving `id`, `name`, `group_type`, `created_by`, `members` |
| Group page, receipt review | One group (name and type) | `GET /groups/{id}` |
| Group page, Add expense | A group's events | `GET /groups/{id}/events` |
| Group settings, Add expense | Read and save the default split | `GET` and `PUT /groups/{id}/split-default` with `method` (`even` or `percentage`) and `percents` in basis points |
| Add expense | Save | `POST /expenses` with `group_id`, `description`, `amount`, `paid_by`, `event_id`, `participant_ids`, `split_method`, `split_values` |
| Edit expense | Save the edit | `PUT /expenses/{id}`, same body (the group can't change) |
| Delete expense | Delete | `DELETE /expenses/{id}` |
| Review | Save item changes | `PUT /receipts/{id}/items` (items with an `id` are kept, no `id` is new, left out is removed) |
| Review | Save as an expense | `POST /receipts/{id}/confirm` with `paid_by`, `description`, optional `event_id`, `assignments: [{ item_id, shares: [{ user_id, amount }] }]` |
| Status and review | Show the picture | `GET /receipts/{id}/picture` (404 when removed) |
| Status and review | Delete the picture | `DELETE /receipts/{id}/picture` |

"Not available yet" now shows only when the server can't be reached or answers 405 or 501. Every other error shows the server's message.

## See every state

http://localhost:5173/dev/sprint7-preview shows every screen and state with sample data. It only works with `npm run dev` and is not in the production build.

## Still open on the backend

Each of these was checked against the backend code (`GET /groups/{id}/expenses`, `expense_mutations.py`, `receipts.py`, `settlements.py`).

- **No receipt flag or "added by" on the expense list.** `GET /groups/{id}/expenses` returns only `id`, `group_id`, `description`, `amount`, `paid_by`, `event_id`, `created_at` and `shares`. The expense table has no "added by" column. The link exists in the database (`Receipt.expense_id`) but the list does not send it, so the frontend can't hide Edit and Delete for scanned expenses ahead of time or find the receipt picture or items for one. The server's 409 message shows instead.
- **Scanned expenses can't be edited or deleted.** Edit returns 409 "edit its items through receipt review" (review closes after confirm) and delete returns 409 "detach the receipt first". There is no detach route. `POST /receipts/{id}/attach` exists but is not used, because nothing gives the frontend a receipt id for an expense.
- **Edit and delete are admin only.** The backend marks this as a temporary rule until the team decides the real edit policy. The frontend follows whatever the server returns (switch: `PAYER_AND_CREATOR_MAY_CHANGE`).
- **Receipt reading is not started automatically.** Nothing in the backend sends an uploaded receipt to the reader, so a real upload stays at `uploaded` until a reader is run (the backend handoff says the same). The stand-in reader is in the `temporary-reader` folder at the top of the repo and will be deleted when the real reader is built into the backend.
- **Settlements have no edit or undo route** (only `POST` and `GET`), so a mistaken payment can't be reversed.

## Tests

37 test files, 587 tests, all pass. The production build passes. A real-browser accessibility scan (axe) after the fix round was clean on Settings, the group page, Add expense and Balances at 375 px and 428 px wide, with no sideways scrolling. The Sprint 7 files are `settleUp`, `deletePicture`, `expenseEditDelete`, `receiptReview`, `avatar`, `people`, `rowOrder` and `peopleGrid`, plus updates to `balances`, `balancesLib`, `addExpense`, `createGroup`, `invites`, `splitDefault`, `splitDefaultPanel`, `expensesApi`, `receiptScreens` and `useReceiptStatus`.

Also walked in a real browser against a copy of the iteration 7 backend, all passing: A add, edit (with event) and delete an expense; B settle up (part, then the rest, history, server errors); C a plain member sees no Edit or Delete, and a direct 403 shows the server message; D upload, read, review, assign and confirm; E delete the picture (items stay, 409 while waiting); F edit or delete the receipt-linked expense (server 409). Details and screenshot names are in `SPRINT7_FINDINGS.md`.
