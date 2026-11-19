# Iteration 7 — Backend Handoff

**Branch:** `lukas-it7` (pending merge into `main`)  
**Backend tests:** 258 passed, 1 existing Starlette/httpx deprecation warning (November 16, 2026)  
**Required Alembic revision:** `7f31b2e4c9a0`  
**Integration status:** Backend endpoints implemented and tested locally against PostgreSQL; browser-to-backend and live AI extraction flow not yet verified.

## Ready for integration

| Area | Endpoints | Behavior |
|---|---|---|
| Receipt item correction | `PUT /receipts/{id}/items` | Replace the complete item list; existing item `id` retains it, missing `id` adds an item, omitted existing items are removed. Available while receipt is `read` and not yet confirmed. |
| Receipt confirmation | `POST /receipts/{id}/confirm` | Accepts payer, description, optional event, and per-item assignments; creates expense, splits, balances, and assignments together in one DB transaction. Unassigned items are excluded. |
| Expense changes | `PUT /expenses/{id}`, `DELETE /expenses/{id}` | Edit/delete manually entered expenses and adjust balances atomically. Editing and deletion currently require group admin; linked receipt expenses are blocked. |
| Settlements | `POST /groups/{id}/settlements`, `GET /groups/{id}/settlements` | Record full or partial repayment, update outstanding balance, and retrieve repayment history. Prevents overpayment. |
| Receipt management | `POST /receipts/{id}/attach`, `DELETE /receipts/{id}/picture`, `GET /receipts/{id}/picture` | Attach a receipt to an eligible same-group expense; delete the private image while retaining extracted items and expenses; retrieve the image through authenticated access. |
| Event association | `POST /expenses`, `PUT /expenses/{id}`, `GET /groups/{id}/expenses` | Optional `event_id` supported and returned; event must belong to the expense's group. |

**Existing APIs available from Sprint 5:** `GET /groups`, `GET /groups/{id}`, `GET /groups/{id}/events`, `GET/PUT /groups/{id}/split-default`.

## Key request contracts

FastAPI paths above have **no `/api` prefix**. The existing Vite proxy exposes them to React under `/api/...`. Authentication uses the existing session cookie. Monetary amounts are decimal strings such as `"12.50"`.

**Receipt item correction** (full replacement list):

```json
{
  "items": [
    {"id": 7, "name": "Milk", "quantity": 2, "unit_price": "3.50"},
    {"name": "Bread", "quantity": 1, "unit_price": "4.25"}
  ]
}
```

**Receipt confirmation** (shares for each included item total its line amount):

```json
{
  "description": "Groceries",
  "paid_by": 1,
  "event_id": null,
  "assignments": [
    {"item_id": 7, "shares": [
      {"user_id": 1, "amount": "3.50"},
      {"user_id": 2, "amount": "3.50"}
    ]}
  ]
}
```

**Record a settlement:**

```json
{"paid_by": 2, "recipient": 1, "amount": "20.00"}
```

Detailed schemas and response shapes are available through FastAPI's generated OpenAPI documentation.

## Relevant backend behavior and open decisions

- **Receipt processing:** Upload currently persists status `uploaded`; automatic dispatch to the AI reader is not yet wired. The receipt status progression is `uploaded` → `reading` → `read` / `failed`.
- **Post-confirmation correction:** The current API prevents editing receipt items or the linked expense after confirmation, to avoid inconsistent records. The project requirements call for financial records to remain correctable, but do not specify the post-confirmation procedure.
- **Authorization (provisional):** Expense edit/delete is admin-only. Settlement recording allows either party or a group admin. Receipt image actions allow the uploader or group admin.
- **Receipt pictures:** Confirmation currently retains the picture; `DELETE /receipts/{id}/picture` removes it separately without deleting extracted data. Whether pictures should instead be deleted automatically at confirmation remains a policy decision.
- **Settlements and balances:** Settlement entries record payments made outside the app; the app never transfers money. After a settlement, the remaining balance need not equal the sum of expense contributions alone; repayment history accounts for the difference. Editing/deleting expenses after repayments was covered by integration tests. There is currently no settlement edit/undo endpoint.
- **Filesystem recovery:** Picture deletion attempts to recover from normal file-operation failures, but process-crash recovery is not guaranteed.

## Validation and migration

- Local run: `python -m pytest -q` → **258 passed**, 1 deprecation warning.
- Tests cover receipt review/confirmation, transactional balance changes, full/partial settlements, expense changes after settlement, event scoping, and private-picture access.
- Database schema includes the Sprint 7 migrations and the corrective migration at head `7f31b2e4c9a0` (`alembic upgrade head`). The corrective migration makes `receipts.file_path` nullable so pictures can be deleted without losing item data, permits receipt statuses `confirmed` and `abandoned`, and enforces uniqueness of `(receipt_item_id, user_id)` rather than either column alone on `item_assignments`.
- End-to-end browser/AI integration is outside the scope of this local backend test result.
