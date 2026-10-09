# Sprint 2 Backend — Team Handoff

## Purpose

This file contains the Sprint 2 backend information the rest of the team needs in order to integrate, test, review, and merge the backend work.

## Backend Status

Implemented:

- IT2-1 persistent database-backed sessions
- IT2-2 guest / invalid / revoked / expired-session handling
- IT2-3 profile read/update
- IT2-4 password change
- IT2-5 email-change verification flow
- backend password-policy enforcement
- backend email normalization
- Sprint 2 database migration integration

Current backend regression result:

```text
6 passed
```

---

## API Routes

Existing auth routes:

```text
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/logout
```

New Sprint 2 routes:

```text
POST  /auth/change-password

GET   /profile
PATCH /profile

POST  /profile/email-change
POST  /profile/email-change/confirm
```

---

## Frontend Integration Notes

The existing frontend authentication contract remains compatible.

### Login

```text
POST /auth/login
```

On success:

- backend creates a server-side session
- browser receives an HttpOnly `access_token` cookie
- frontend can call `/auth/me` to resolve the current user

### Protected routes

If authentication fails, backend returns:

```text
401 Unauthorized
```

with:

```json
{
  "detail": "Authentication required."
}
```

This same response is used for:

- no session cookie
- invalid token
- unknown token
- revoked session
- expired session

The frontend should treat `401` as unauthenticated and redirect to `/login`.

### Password change

```text
POST /auth/change-password
```

A successful password change revokes all active sessions for that user.

Expected frontend behavior after success:

- treat the user as logged out
- redirect to login
- require the new password

### Profile

```text
GET /profile
PATCH /profile
```

Current editable profile fields:

- name
- photo path
- notification preferences

Email is intentionally not directly editable through `PATCH /profile`.

### Email change

```text
POST /profile/email-change
POST /profile/email-change/confirm
```

The old email remains active until verification succeeds.

Development behavior currently returns the verification token in the API response because no email provider has been selected yet.

That token should eventually be delivered through email instead.

---

## Password Rules

Backend now enforces the same currently-defined rules as the frontend:

```text
minimum 8 characters
at least 1 uppercase letter
at least 1 symbol
```

These rules apply to:

- registration
- password change

Login does not re-check complexity.

---

## Email Normalization

Registration, login, and email-change requests normalize email addresses by:

```text
trim whitespace
convert to lowercase
```

Example:

```text
CaseTest@Example.com
CASETEST@EXAMPLE.COM
casetest@example.com
```

are treated as the same account address.

---

## Session Architecture

Login sessions are now server-side database sessions.

Database table:

```text
sessions
```

Relevant fields:

```text
id
user_id
token_hash
created_at
expires_at
revoked
```

Important security behavior:

- browser receives the raw random session token
- database stores only its SHA-256 hash
- auth succeeds only if the matching session:
  - exists
  - is not revoked
  - is not expired

Logout sets:

```text
revoked = true
```

and deletes the browser cookie.

---

## Environment Variables

Expected local environment variables:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:YOUR_PORT/shared_expense_dev

SESSION_EXPIRE_HOURS=168
COOKIE_SECURE=false

EMAIL_VERIFICATION_SECRET=YOUR_SECRET_KEY
EMAIL_VERIFICATION_EXPIRE_MINUTES=30
```

Production notes:

- `.env` must remain private
- `COOKIE_SECURE=true` should be used with HTTPS
- production should use a strong unique email-verification secret

---

## Database / Migration Notes

The backend now includes these Sprint 2 migration files:

```text
0d8b78f76546_finalize_users_table.py
6b9df60eb339_extend_users_table.py
55028eca7b5c_add_split_percentage_to_usergroup_table.py
33f0a4e926d7_adding_session_table.py
91acb19563fb_added_name_column_to_user_table.py
```

Local migration state was successfully upgraded to:

```text
91acb19563fb (head)
```

### Important migration review item

The backend copy of:

```text
0d8b78f76546_finalize_users_table.py
```

was adjusted so the existing `users.password` column is renamed to `password_hash`.

This avoids creating a new non-null column and then dropping the old password field.

The team should review this during merge so there is one agreed canonical migration history.

---

## Profile / Database Caveat: Split Ratio

The requirements describe a "default split ratio" as a profile setting.

The current database design stores:

```text
user_groups.split_percentage
```

That makes split percentage specific to a user inside a group rather than a single global profile value.

Current backend implementation does not invent a second global split-ratio field.

Team decision needed:

```text
Option A: global user default
Option B: per-group split percentage
```

The current database supports Option B.

---

## Profile Image Caveat

Current profile handling validates/stores a relative path such as:

```text
uploads/profile123.jpg
```

Actual multipart image upload handling has not been implemented yet.

`uploads/` should remain ignored by Git.

---

## Email Delivery Caveat

The email-change verification logic is implemented.

Actual email delivery is not.

Current development behavior returns the verification token from the request endpoint so the flow can be tested.

Before production:

- choose an email/SMTP provider
- email the verification link/token
- stop returning the token in the API response

---

## Developer Verification Already Completed

These behaviors were manually verified during implementation:

- valid database-backed login session creation
- SHA-256 session hash stored instead of raw token
- 7-day expiration created from configuration
- logout revokes session
- revoked session rejected
- expired session rejected
- generic 401 returned for expired auth
- password change requires current password
- password change updates the stored hash
- password change revokes active sessions
- old password stops working
- new password works
- profile GET works
- profile PATCH works
- blank name rejected
- unsafe photo path rejected
- email change stores `pending_email`
- old email remains active before verification
- valid verification token promotes pending email
- `pending_email` clears after confirmation
- `email_verified` becomes true
- weak registration password rejected
- email case normalization works
- backend regression suite passes: 6/6

These were developer checks, not a complete formal automated test suite.

---

## Xander — Formal Testing Still Worth Adding

The following cases were not fully covered by the existing six automated tests and are the most useful additions.

### Sessions

- browser-close persistence
- random/malformed cookie value
- unknown session token
- explicit revoked-session automated case
- explicit expired-session automated case
- cookie deletion behavior after logout
- session hash stored rather than raw token

### Password change

- wrong current password
- weak new password
- all sessions revoked
- unauthenticated password-change request

### Profile

- unauthenticated GET/PATCH
- PATCH omitted fields remain unchanged
- notification preference persistence
- valid upload-relative path
- invalid path traversal attempts

### Email change

- unauthenticated request
- same email rejected
- email already owned by another account
- malformed verification token
- expired verification token
- wrong token purpose
- stale token after `pending_email` changes
- email becomes taken between request and confirmation
- successful confirmation clears pending state

Existing regression tests should continue to run alongside these.

---

## Seed Data

Seed users now use the real backend password hashing function rather than fake placeholder hashes.

Development-only seed passwords should never be treated as production credentials.

---

## Merge Checklist

Before merging the backend branch:

- review the modified `0d8...` migration with the database owner
- confirm split-ratio interpretation
- confirm frontend handling for password-change logout
- confirm frontend handling for email verification flow
- confirm `.env` is not staged
- keep `uploads/` ignored
- run backend tests
- run Alembic upgrade on a clean/local development database
