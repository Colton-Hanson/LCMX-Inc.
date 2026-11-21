# Back end: ideas that could help (Sprint 7)

The front end now uses every Sprint 7 route. These are small things I think would make the app better. Most helpful first.

1. **Tax, tip and the final total are not saved.** The reader finds them, but only the items are saved, so the review screen shows the items total, not what was paid. Examples: $50.05 shown, $64.52 on the receipt; a diner receipt with items $46.54, tax $3.84 and total and balance due $50.38 shows only $46.54. Receipts name these lines in different ways (Subtotal, Total Tax, Total, Order Balance Due, Gratuity). I think saving subtotal, tax, tip and total on the receipt, and returning them in `GET /receipts/{id}`, should fix this.
2. **An expense has no link to its receipt in the list.** `GET /groups/{id}/expenses` has no receipt id. The link is in the database (`Receipt.expense_id`), but the list does not send it. I believe adding a `receipt_id` (or null) to each expense would let the front end show the picture on an expense and tell scanned expenses from typed ones. It would also let the small receipt slip in an expense's details show the scanned items instead of only the expense title. The attach route (`POST /receipts/{id}/attach`) is not used yet for the same reason.
3. **Scanned expenses are stuck.** Editing one says to use receipt review, and deleting one says to detach the receipt first. But review closes after saving, and there is no detach route. I think adding a detach route, or allowing edit and delete on these expenses, should fix it.
4. **Who can edit or delete an expense.** Today only a group admin can (the code calls this a temporary rule). I believe the team agreed the payer, the creator and an admin should. Sending `created_by` on expenses should let the front end follow that with one line changed.
5. **Readings that look wrong cannot be marked.** For red boxes on the review screen, I think either a flag on each item or both readers' values (when they disagree) would be enough.
6. **Old pictures.** As far as I can tell, the 7-day cleanup for pictures nobody saved is not built yet. I think a scheduled clean-up job would cover it.
7. **`GET /users` needs no login.** It lists every user's id and email. I think it could need a login, or be removed if nothing uses it.
8. **Small ones.**
    - The seed script does not give users names (only people who set one in Settings have one). The front end then shows the start of the email, like "Bob". I think adding names to the seed would make demos look better.
    - Pictures of seeded receipts return 409, I think because the files are not in the upload folder.

Already available, so nothing needed here: balances rows include each expense with its date, so the front end can sort rows by date on its own.
