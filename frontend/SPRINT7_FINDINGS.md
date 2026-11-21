# Sprint 7 Findings

## Summary for the team

**Tickets and routes**
- 136 Settle up: `POST` and `GET /groups/{id}/settlements`. Fields `paid_by`, `recipient`, `settlement_time`.
- 135 Edit and delete expense: `PUT` and `DELETE /expenses/{id}`. Admin only. `event_id` sent on add and edit.
- 137 Delete picture: `DELETE /receipts/{id}/picture`. Picture shown from `GET /receipts/{id}/picture`. "Picture removed" state on 404.
- 134 Review and assign: save goes to `POST /receipts/{id}/confirm`. Item edits use `PUT /receipts/{id}/items`. Polling stops at `confirmed`.
- Groups list and group default split now come from the server: `GET /groups`, `GET /groups/{id}`, `GET /groups/{id}/events`, and `GET` and `PUT /groups/{id}/split-default`. Nothing about groups is saved in the browser any more, so a new browser or profile shows the same groups. Percentages are sent in basis points (5000 = 50%).
- Balances layout (matches the dark mockup): one compact row per person with a one-line summary, starts closed. A caret on the row opens its expense list; one button above the list switches between Expand all and Collapse all. The pencil and trash icons are gone from the lines. Each line has a small underlined Edit link (admin only, same rule as before) that opens the edit screen. Delete is on the edit screen as Delete expense, with the same confirmation that says what is lost and the same server messages. Settlements still have no undo.
- Final acceptance pass: the delete confirmation also says what is kept; settlement history shows only payments you are part of (the server sends every payment in the group, so it is filtered in the app); the people picker is a grid of equal boxes (5 across, 2 on a phone) and long emails wrap instead of being cut off. Every screen was checked at 375 px wide (iPhone SE) with no sideways scrolling.
- Guessed routes are gone. `src/api/proposed.js` has the real paths. "Not available" now means only: no connection, 405, 501.

**Tests and build**
- Frontend: 35 files, 564 tests, all pass (the earlier Sprint 7 build had 524). Run with `npm test` from a terminal with an upper-case drive letter, together with the build.
- Production build: passes.
- Backend copy: 256 of 258 pass. The 2 misses check Unix file permissions, so they only fail on Windows.
- Reader: 32 tests pass (all reader and call-counter tests).
- Windows tip: run tests from a terminal whose folder path uses an upper-case drive letter. A lower-case drive letter breaks the matcher setup.

**Flows A to F (real backend copy, real browser)**
- A add, edit (with event), delete: all pass. Balances moved correctly and came back after delete. `135-apt-*`, `135-lake-*`.
- B settle up, part then rest, history, real server errors: all pass. `136-settle-*`, `136-balances-375`.
- C non-admin: no Edit or Delete, direct 403 message shown: pass. `135-details-not-admin-1280`, `135-edit-403-1280`.
- D upload, read, review, assign, confirm: pass. Shares matched to the cent. `134-*`.
- E delete picture: pass. Items kept, second delete gives 409, 409 while waiting. `137-*`.
- F edit or delete the receipt-linked expense: server 409 message shown: pass. `135-receipt-expense-*-409-1280`.
- Mobile: 320, 375, 1280 checked. No sideways scroll. One fix made (settle amount buttons at 320). `sweep-320-*`, `136-settle-dialog-fixed-*`.
- Screenshots are in `LCMX-Runtime\screenshots`.

**Receipt reader (stand-in, small hosted vision model, 88 receipts)**
- Overall: low effort 94.5%, medium effort 94.6%.
- Line items 94.1%, dollar amounts to the cent 94.8%, total 98.8%, tax 98.8%, store name 98.8%.
- Store location: low 88.2%, medium 90.6%. Date: low 95.3%, medium 96.5%.
- PDF 100%. JPG 93.5%. One long tilted receipt failed on both runs and pulls the numbers down.
- Speed per call, all files: low 3.04 seconds, medium 3.77 seconds average.
- Cost: low 0.0527 dollars total, medium 0.0605 dollars total. About 0.0006 to 0.0007 dollars per image.
- Medium costs about 15% more and takes about 24% longer, with no real accuracy gain.
- Output limit raised from 8192 to 64000 tokens (streaming call). The long tilted receipt (`r055`) is the one that cannot be trusted: on its own it read at 100% on low and on medium, but in the two full 88-receipt runs it failed again on both. It reads about half the time (2 of 4 tries), so the cut-off was not the whole story.
- Thinking off (low and medium effort, 64000 tokens, streaming): overall 83.5% and 87.2%, about 45% less time and 30% less money, but 4 receipts fail instead of 1, mostly long ones. Effort makes no real difference once thinking is off.
- Best setting for production: low effort, thinking on (the default), 64000 tokens, streaming, with the total check and one retry. It matches medium on accuracy (94.5%) at about 18% less time and 12% less cost. See "All six runs side by side".

**Files**
- Stage: everything under `frontend/` that `git status` lists (source, tests, `SPRINT7_FRONTEND_HANDOFF.md`, this file). `package.json` and `package-lock.json` were already modified before this work. Include them only if that change is wanted.
- Not part of the commit: `sprint7-verification/` (the review brief, the check guide and the screenshots zip). It stays on disk only and is listed in `frontend/.gitignore`.
- Do not stage: anything under `LCMX-Reader` or `LCMX-Runtime` (both are outside the repo).
- Nothing was committed, staged or pushed.

---

## Low versus medium effort

Same 88 receipts, same model, same scorer. Effort is sent explicitly in both runs.

| measure | low | medium |
|---|---|---|
| Overall | 94.5% | 94.6% |
| Line items (name, quantity, unit price, line total) | 94.1% | 94.1% |
| Dollar amounts to the cent | 94.8% | 94.8% |
| Store location | 88.2% | 90.6% |
| Total | 98.8% | 98.8% |
| Tax | 98.8% | 98.8% |
| Store name | 98.8% | 98.8% |
| Date | 95.3% | 96.5% |
| Tilted images (all checks / average per receipt) | 54.1% / 88.4% | 54.1% / 88.4% |
| Grocery receipts (all checks / average per receipt) | 71.1% / 90.0% | 71.1% / 90.0% |
| Average seconds per call (JPG / PDF / all) | 3.69 / 1.72 / 3.04 | 4.57 / 2.09 / 3.77 |
| Total seconds for the batch | 280.05 | 346.40 |
| Total cost | 0.0527 dollars | 0.0605 dollars |
| Average cost per image | 0.00060 dollars | 0.00069 dollars |

Prices used (official pricing page, prompts up to 100,000 tokens): 0.10 dollars per million input tokens, 0.50 dollars per million output tokens. Input tokens were the same in both runs (162,230). Output tokens: low 72,919, medium 88,483.

Calls: low 93, medium 93 (limit was 100 each). Four receipts needed a retry in each run. No API errors.

Speed split by format, per call:
- Low, JPG: average 3.69 seconds, fastest 0.64 seconds, slowest 26.14 seconds, total 228.51 seconds (62 calls).
- Low, PDF: average 1.72 seconds, fastest 0.70 seconds, slowest 3.86 seconds, total 51.54 seconds (30 calls).
- Medium, JPG: average 4.57 seconds, fastest 0.64 seconds, slowest 32.36 seconds, total 283.63 seconds (62 calls).
- Medium, PDF: average 2.09 seconds, fastest 0.69 seconds, slowest 4.05 seconds, total 62.77 seconds (30 calls).
- Short receipts take about 1 to 3 seconds. Receipts with 30 or more lines take 8 to 10 seconds.

Where the files are (all in `LCMX-Reader`, nothing was overwritten):
- Low run: `runs\usage.jsonl`, `runs\results.jsonl`, `runs\score-report-*.md`.
- Medium run: `runs\medium-20261119-085036\`.
- Side by side: `runs\compare-20261119-085711.md`.
- Cost per receipt is in each score report, in the "Cost per image" table.

## Low, medium, and low with thinking off

New run: same 88 receipts, low effort, thinking disabled, 64000 token limit, streaming call, its own folder (`LCMX-Reader/runs/low-nothink-20261119-091605`) and its own cap of 120 calls (101 used, counting one check call and four diagnosis calls). Disabled thinking works together with low effort: the check call returned no error.

Note on fairness: the low and medium columns come from the earlier runs (8192 token limit, plain calls). The 64000 limit only matters for the one receipt that was cut off (`r055`), which is shown separately below. Edit rate means the share of receipts a person would have to fix before saving: the receipt failed, or any checked field is wrong. The second edit rate ignores store location, because my test data counts the whole "Order #..., ships to" line for online orders.

| measure | low | medium | low, thinking off |
|---|---|---|---|
| Overall accuracy | 94.5% | 94.6% | 83.5% |
| Line items (all four fields) | 94.1% | 94.1% | 81.7% |
| Dollar amounts to the cent | 94.8% | 94.8% | 83.8% |
| Store location | 88.2% | 90.6% | 87.1% |
| Total | 98.8% | 98.8% | 95.3% |
| Tax | 98.8% | 98.8% | 96.5% |
| Store name | 98.8% | 98.8% | 95.3% |
| Date | 95.3% | 96.5% | 91.8% |
| Receipts read | 98.8% | 98.8% | 95.3% |
| Edit rate (receipts to fix) | 16.5% | 11.8% | 16.5% |
| Edit rate ignoring store location | 5.9% | 3.5% | 8.2% |
| Items to fix | 5.9% | 5.9% | 18.3% |
| Very long receipts (30+ lines), average per receipt | 85.4% | 85.5% | 56.9% |
| Average seconds per call (JPG / PDF / all) | 3.69 / 1.72 / 3.04 | 4.57 / 2.09 / 3.77 | 1.99 / 1.17 / 1.73 |
| Slowest call, seconds | 26.14 | 32.36 | 5.41 |
| Total seconds for the batch | 280.05 | 346.40 | 166.29 |
| Output tokens per receipt (average / most) | 829 / 13723 | 1005 / 16384 | 495 / 3568 |
| Total cost | 0.0527 dollars | 0.0605 dollars | 0.0387 dollars |
| Cost per receipt (average) | 0.00060 dollars | 0.00069 dollars | 0.00044 dollars |

Files: `LCMX-Reader/runs/compare-n-20261119-092022.md` (the side-by-side), the score report inside each run folder, and `usage.jsonl` / `results.jsonl` for the raw numbers. The low and medium reports used here were re-made with the edit-rate lines (new files, the first reports are kept).

What it shows:
- Thinking off is about 43% faster on average (1.73 seconds against 3.04 seconds per call), has a slowest call of 5.41 seconds against 26.14 seconds, uses about 40% fewer output tokens and costs about 27% less than low.
- It reads fewer receipts: 4 failed against 1 (the long tilted one) for low and medium. Items to fix go from 5.9% to 18.3%.
- It is fine for short receipts. All 28 PDFs still read at 100%. The loss is on long and crowded JPG receipts.
- Medium is still the most accurate, but only slightly better than low.

### The long receipt (r055) in every setting

| setting | reads? | calls (retries) | output tokens | seconds for the receipt | cost |
|---|---|---|---|---|---|
| low, 8192 limit | no (lines did not add up) | 2 (1) | 7384 + 6339 | 49.11 | 0.00772 dollars |
| medium, 8192 limit | no (reply cut off at the limit, twice) | 2 (1) | 8192 + 8192 | 64.61 | 0.0090 dollars |
| low, 64000 limit, streaming | yes, 100% | 2 (1) | 10526 + 7730 | 71.00 | 0.00999 dollars |
| medium, 64000 limit, streaming | yes, 100% | 2 (1) | 9852 + 12826 | 85.38 | 0.01220 dollars |
| low, thinking off, 64000 limit | no (lines did not add up) | 2 (1) | 1720 + 1724 | 10.42 | 0.00258 dollars |

Why thinking off fails on it: one extra diagnosis call showed a complete, valid reply (35 lines, stopped normally, 1724 tokens), with the total (202.70) and tax (8.26) right. The lines it read added up to 197.93 instead of the true 194.44, because on the tilted image several prices were matched with the wrong item. The total check rejected it, which is the right outcome. So it is not a cut-off and not bad JSON: it is the lines not adding up to the total.

### The other three receipts that failed with thinking off

One diagnosis call each (no thinking, low effort):
- `r007` and `r031` (34 and 33 line receipts): complete and correct totals, but the reader treated the number at the end of a name (for example "DESK LAMP 2", which is part of the name in my test data) as a quantity of 2 while keeping the single price. Quantity times price then did not equal the line total, so the check rejected it. With thinking on, the reader kept the name whole. This is partly a test-data artifact (names ending in a number), but real receipts have names like that too.
- `r026` (7-line utility receipt, rotated): one rent line was read twice, so the lines added up to 13200.65 instead of 7400.65. The total was right; the check rejected it.
- In all three the check caught the mistake and nothing wrong was saved.

## All six runs side by side

Three new full runs were added on Nov 19, each with freshly uploaded receipts, its own folder and its own call cap of 120: **low, 64000** (thinking on, default), **medium, 64000** (thinking on, default) and **medium, thinking off, 64000**. Streaming calls in all three. The first low and medium runs used the old 8192 limit and plain calls, and the "low, thinking off" run is the one from the section above.

| measure | low (old 8192) | medium (old 8192) | low, thinking off | low, 64000 | medium, 64000 | medium, thinking off |
|---|---|---|---|---|---|---|
| Overall accuracy | 94.5% | 94.6% | 83.5% | 94.5% | 94.5% | 87.2% |
| Line items | 94.1% | 94.1% | 81.7% | 94.1% | 94.1% | 86.0% |
| Dollar amounts to the cent | 94.8% | 94.8% | 83.8% | 94.8% | 94.8% | 87.4% |
| Store location | 88.2% | 90.6% | 87.1% | 88.2% | 88.2% | 87.1% |
| Total | 98.8% | 98.8% | 95.3% | 98.8% | 98.8% | 95.3% |
| Tax | 98.8% | 98.8% | 96.5% | 98.8% | 98.8% | 96.5% |
| Store name | 98.8% | 98.8% | 95.3% | 98.8% | 98.8% | 95.3% |
| Date | 95.3% | 96.5% | 91.8% | 95.3% | 96.5% | 91.8% |
| Receipts read | 98.8% | 98.8% | 95.3% | 98.8% | 98.8% | 95.3% |
| Edit rate (receipts to fix) | 16.5% | 11.8% | 16.5% | 16.5% | 14.1% | 16.5% |
| Edit rate ignoring store location | 5.9% | 3.5% | 8.2% | 5.9% | 3.5% | 8.2% |
| Items to fix | 5.9% | 5.9% | 18.3% | 5.9% | 5.9% | 14.0% |
| Very long receipts, average per receipt | 85.4% | 85.5% | 56.9% | 85.4% | 85.4% | 71.2% |
| Average seconds per call (JPG / PDF / all) | 3.69 / 1.72 / 3.04 | 4.57 / 2.09 / 3.77 | 1.99 / 1.17 / 1.73 | 3.97 / 1.71 / 3.24 | 4.80 / 2.14 / 3.93 | 2.00 / 1.17 / 1.74 |
| Slowest call, seconds | 26.14 | 32.36 | 5.41 | 36.62 | 45.78 | 5.45 |
| Total seconds for the batch | 280.05 | 346.40 | 166.29 | 301.49 | 361.61 | 166.81 |
| Output tokens per receipt (average / most) | 829 / 13723 | 1005 / 16384 | 495 / 3568 | 884 / 17078 | 1070 / 21998 | 496 / 3568 |
| Total cost | 0.0527 dollars | 0.0605 dollars | 0.0387 dollars | 0.0553 dollars | 0.0633 dollars | 0.0386 dollars |
| Cost per receipt (average) | 0.00060 dollars | 0.00069 dollars | 0.00044 dollars | 0.00063 dollars | 0.00072 dollars | 0.00044 dollars |
| Live calls (retries) | 93 (5) | 93 (4) | 97 (8) | 93 (5) | 92 (4) | 96 (8) |

Files (all in `LCMX-Reader/runs`, nothing overwritten): `compare-n-20261119-093953.md` (this table), `low-64k-20261119-092447`, `medium-64k-20261119-093000`, `medium-nothink-64k-20261119-093641` (each with its score report, usage and results files and worker log). Cost per receipt, one by one, is in each score report under "Cost per image".

What the new runs show:
- Same settings give the same answers: low 8192 and low 64000 are both 94.5% overall, and medium 8192 and medium 64000 are 94.6% and 94.5%. The runs are repeatable. The 64000 limit only costs a little more time and tokens.
- The failures with thinking off were `r007`, `r026`, `r031`, `r055` for low and `r007`, `r016`, `r026`, `r055` for medium. Medium effort without thinking tokens is the same as low (same tokens, same cost and time), so effort does nothing once thinking is off. The small accuracy difference between those two runs is a different set of failed receipts.
- With thinking on, medium fixes about 2 more receipts than low (edit rate ignoring location 3.5% against 5.9%) but takes 21% longer and costs 14% more.

### The long receipt (r055) across the new runs
| run | reads? | output tokens | seconds for the receipt | cost |
|---|---|---|---|---|
| low, 64000, full run | no, after 1 retry (both replies ended normally, lines did not add up) | 7468 + 9610 | 65.19 | 0.00940 dollars |
| medium, 64000, full run | no, after 1 retry (same cause) | 12223 + 9775 | 81.50 | 0.01186 dollars |
| medium, thinking off, 64000 | no, after 1 retry (same cause) | 1724 + 1724 | 10.39 | 0.00258 dollars |

Together with the earlier single-receipt re-reads (low and medium both read it after one retry), `r055` reads in 2 of 4 tries with thinking on and in 0 of 3 with thinking off. It is a tilted 35-line receipt, so this is a photo-quality problem more than a setting. None of these tries were cut off. The total check rejected every wrong reading, so no wrong data was saved.

### Best setting for production
**Low effort, thinking on (the default), 64000 token limit, streaming call, with the total check and one retry.**
- It is as accurate as medium on this test set (94.5% overall, 98.8% on total and tax, 100% on PDFs) and uses about 18% less time per call (3.24 seconds against 3.93 seconds) and about 12% less money (0.00063 dollars against 0.00072 dollars per receipt).
- Medium finds about 2 more receipts of 85 and costs more time and money for it. That is not worth it by default. If a team wants fewer fixes at any cost, medium is the second choice.
- Thinking off uses about 45% less time and 30% less money, but it fails on long and crowded JPG receipts (4 failures instead of 1, and 14 to 18% of items need a fix instead of 6%). Not a good default.
- Keep the 64000 limit with streaming. It removes cut-off failures at almost no cost, and the call needs streaming at that size.
- Keep the total check and the one retry. They stopped every wrong reading from being saved.
- Worth trying next (not tested): read once with thinking off, and only retry with thinking on when the total check fails. Short receipts would take about 1.7 seconds and long ones would get the careful read.
- Ask people to photograph long receipts straight on. That is the one case none of the settings handles well.

---

## Findings

### Why tilted and grocery scored low
- Cause: one receipt. `r055` is a grocery receipt with 35 lines, photographed at a tilt. It failed in both runs and holds about 150 of the checks in those two groups.
- The scoring made it look worse. The group tables pool every check, so one long failed receipt outweighs many short good ones. The report now also shows the average per receipt: tilted 88.4%, grocery 90.0%. The other 8 tilted and 9 grocery receipts were read at or near 100%.
- The test image is hard but realistic. Rotating a tall receipt moves the price column down relative to the names, and weighed lines print the price on the next line. That makes it easy to pair a price with the wrong item.
- Update (later, see "All six runs side by side"): `r055` read in those small re-reads but failed again in both full 64000 runs, so it reads about half the time. Earlier update: after raising the output limit to 64000 tokens and switching to the streaming call, `r055` was re-read as two new small runs (new receipts 179 and 180, own folders, earlier runs untouched). It reads on both, 35 of 35 items, 100% of 145 checks, total 202.70 and tax 8.26 exactly right. Both passes needed the one retry: the first reply did not pass the total check, the second did.
  - Low: 2 calls, 42.95 and 27.97 seconds (71.00 seconds for the receipt), 10526 and 7730 output tokens, cost 0.00999 dollars.
  - Medium: 2 calls, 37.51 and 47.77 seconds (85.38 seconds for the receipt), 9852 and 12826 output tokens, cost 0.01220 dollars.
  - Why medium failed before: the reply needs about 8000 to 13000 output tokens on this receipt, so the old 8192 limit cut it off. Why low failed before: the lines did not add up to the total; the retry fixes that more often than not, but it is not guaranteed.
  - A 35-line receipt costs about 1 cent and takes over a minute, against about 0.06 cents and 1 to 3 seconds for a short one.
  - Files: `LCMX-Reader/runs/r055-low-20261119-090318` and `LCMX-Reader/runs/r055-medium-20261119-090318` (usage, results, score-one.md, worker log).
- Verdict: mostly the scoring weighting plus one hard test image. The reader's mistake is limited to that one receipt, and its total check stopped wrong data from being saved.
- The two runs failed for different reasons. Low: the lines did not add up to the total. Medium: the reply hit the 8192 output-token limit twice (about 32 seconds each). Both are fixed or reduced by the 64000 limit, see the update above.

### Limitations
- Discounts and coupons are read, used in the total check, and not saved. The backend has no place for a negative line, so saved items add up to more than was paid.
- Weighed or fractional quantities (for example 1.37 lb at 0.59) are saved as quantity 1 at the printed line total, with the weight kept in the item name. The backend needs a whole quantity and an exact line total.
- Tax, tip, fees, subtotal and total are read and checked but not saved. The backend has no columns for them.
- Gas receipts: price per gallon has 3 decimals, so the line is saved as quantity 1 at the line total.
- A receipt photo cannot be attached to a hand-entered expense in the app. The backend has an attach route, but no ticket asks for a button.
- Store location for online orders is read as the city only. The "Order #..., ships to" line is not treated as an address.
- A date like 05-11-2026 is ambiguous (day-month or month-day). The reader chose month-day.
- Very long receipts (30+ lines) are slow, and a tilted photo of one can fail.
- Edit and delete are admin only for now. The payer or creator rule is behind `PAYER_AND_CREATOR_MAY_CHANGE` in `src/lib/expensePermissions.js`.
- Test data was drawn, not photographed. Real photos will vary more.

### Backend suggestions
- Seed script: it creates expenses and shares but never the balance rows, so Balances shows nothing for the starter data. Fix: call the same function the expense route uses (`update_balances`). A fixed copy and a diff are in `LCMX-Runtime\seed-fix`.
- The expense list has no "added by" field and no flag for a receipt-linked expense. Adding them would let the UI hide Edit and Delete ahead of time. Today the server's 409 message shows instead.
- Edit and delete are admin only. If the plan is payer or creator too, the rule needs widening.
- Add a place to store discounts, tax, tip and total on a receipt. That would remove most reader workarounds.
- Allow decimal quantities and 3-decimal unit prices on items, or add a "weight" field.
- Add a reader trigger. Receipts stay at `uploaded` forever until something reads them. The stand-in reader writes through the backend models for now.
- The reader should not retry a "not a receipt" answer (three bad inputs each cost two calls).
- Done in the stand-in reader: output limit raised to 64000 tokens with a streaming call. Keep it when the reader becomes part of the backend. A 35-line receipt used up to 12826 output tokens.
- Backend tests need a second database named `shared_expense_sprint4_test`, created and migrated first. The README does not say so.
- Two receipt upload tests check Unix file permissions and fail on Windows.
- Settlements: there is no edit or undo route. A mistaken payment cannot be reversed. This is a Sprint 8 item.
- Receipt reading is not started automatically. Nothing in the backend sends an uploaded receipt to the reader yet, so a receipt stays at `uploaded` until a reader is run by hand.
- The stand-in reader lives in the `temporary-reader` folder at the top of the repo. Delete that folder when the real reader is built into the backend.
- Settlement history rows could list the expenses each payment covered (the mockup shows this).

### Problems hit and how they were fixed
- Hundreds of tests failed with "Invalid Chai property". Cause: running from a path with a lower-case drive letter made the test runner load its library twice. Fix: run from a path with an upper-case drive letter. No code change.
- Backend tests errored on a missing database. Fix: created and migrated `shared_expense_sprint4_test` in the throwaway container.
- Balances for starter data were wrong. Cause: the seed script (see above). Fix: fixed copy in the runtime folder only. Checked against a separate total worked out from the expenses.
- Expense lines disappeared from Balances after any settlement. Cause: the lines were hidden when they did not add up to the server balance. Fix: lines stay, with the note "Settlements are included in the balance."
- The browser extension timed out on the mockup pages. Fix: used Playwright installed inside the runtime folder.
- Settle amount buttons wrapped unevenly at 320 wide. Fix: they now stretch to full even rows on a narrow phone, same on desktop.
- Items added in review kept no id after saving and would have been added twice on the next save. Fix: ids are refreshed from each items save reply.
- A network failure used to show "could not reach the server" in the settle, delete and edit dialogs. It now shows the calm "not available" note, as asked. Real 403, 404, 409 and 422 show the server's message.
- The reader upload script failed on a missing HTTP library. Fix: used the one installed with the reader's own SDK.
- Scoring treated "CRÈME BRÛLÉE" and "CREME BRULEE" as different. Fix: accents count as the plain letter.
- Several flow scripts failed on selectors that matched more than one element (item picker label, "Already added to the group" shown twice for sighted and screen reader users). Fixed in the scripts. No app change.
- Running the extra 409 check left receipt 90 waiting. The medium run read it normally.
