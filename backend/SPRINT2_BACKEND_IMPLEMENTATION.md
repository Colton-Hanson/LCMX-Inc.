# Sprint 2 Backend — Implementation Overview

**AI-generated documentation. This is intentionally exhaustive, and realistically nobody will need even 10% of it. It’s here for reference if something breaks, needs to be revisited, or someone wants to know exactly how the Sprint 2 backend was implemented..**  

## Purpose

This file documents what I implemented for Sprint 2, how the backend pieces work, and the reasoning/flow behind each feature. 

For concise integration information intended for the whole team, see:

```text
SPRINT2_BACKEND_TEAM_HANDOFF.md
```

---

# 1. Starting Point

The backend already had the Sprint 1 authentication flow:

```text
register
login
/auth/me
logout
```

The initial login implementation used a token-only approach.

Sprint 2 required adding:

```text
persistent sessions
guest / expired-session handling
profile settings
password changes
email-change verification
```

I also integrated the updated database migrations and aligned the backend with the updated user/session schema.

---

# 2. Database Integration

The backend originally only had the initial migration.

The newer migrations existed under the database starter work, so I copied the Sprint 2 migration chain into:

```text
backend/alembic/versions/
```

Integrated migrations:

```text
0d8b78f76546_finalize_users_table.py
6b9df60eb339_extend_users_table.py
55028eca7b5c_add_split_percentage_to_usergroup_table.py
33f0a4e926d7_adding_session_table.py
91acb19563fb_added_name_column_to_user_table.py
```

The local database successfully upgraded to:

```text
91acb19563fb (head)
```

## Migration correction

The original `0d8...` migration attempted to:

```text
add password_hash as NOT NULL
drop password
```

That is unsafe for an already-populated database because the new non-null column has no value for existing rows.

I changed the backend copy to rename:

```text
password
→
password_hash
```

instead.

That preserves the existing password hashes and avoids unnecessary data loss.

---

# 3. Model Integration

I updated the backend models only for schema changes that had matching migrations.

## User

The backend now uses fields including:

```text
id
name
email
password_hash
created_at
photo_url
notification preference fields
email_verified
pending_email
```

## UserSession

Added a server-side session model with:

```text
id
user_id
token_hash
created_at
expires_at
revoked
```

## UserGroup

Added:

```text
split_percentage NUMERIC(5,2)
```

I did not copy unrelated future model changes that did not have matching migrations.

---

# 4. Persistent Session Architecture

## Goal

The user should remain logged in through a persistent cookie, while the server must still be able to invalidate that login.

The final architecture is:

```text
LOGIN
  ↓
verify password
  ↓
generate random raw token
  ↓
SHA-256(token)
  ↓
store hash in PostgreSQL
  ↓
put raw token in HttpOnly browser cookie
```

On an authenticated request:

```text
browser cookie
  ↓
hash cookie value
  ↓
query sessions table
  ↓
does row exist?
is revoked = false?
is expires_at in the future?
  ↓
load user
```

This gives the server control over active sessions.

A token can exist in a browser and still be invalid because the corresponding DB session may be revoked or expired.

---

# 5. Session Token Security

The raw session token is generated with:

```python
secrets.token_urlsafe(32)
```

The database does not store that raw token.

It stores:

```text
SHA-256(raw token)
```

The browser receives the raw value in:

```text
access_token
```

with an HttpOnly cookie.

This means a database leak by itself does not reveal the usable browser session token.

---

# 6. Session Expiration

Session expiration is configurable with:

```env
SESSION_EXPIRE_HOURS=168
```

Current default:

```text
168 hours = 7 days
```

Manual database verification showed a created session expiring exactly seven days later.

The cookie also receives a matching `max_age`.

---

# 7. Logout Flow

Logout performs two operations:

```text
database:
session.revoked = true

browser:
delete access_token cookie
```

The important part is the database revocation.

Even if an old cookie value remained somewhere, the backend would reject it because the corresponding session is revoked.

---

# 8. Guest / Expired Session Handling

A shared authentication dependency handles protected routes.

Invalid auth states all collapse into the same result:

```text
no cookie
invalid token
unknown session
revoked session
expired session
        ↓
401 Authentication required
```

The backend deliberately does not return highly specific messages such as:

```text
"Your token was revoked"
"That internal page exists"
"Your session expired"
```

The frontend simply sees an unauthenticated response and can redirect to login.

## Manual expired-session verification

I created a valid session and manually changed its `expires_at` value in PostgreSQL to a time in the past.

The session still had:

```text
revoked = false
```

but `/auth/me` correctly rejected it because expiration is independently checked.

---

# 9. Password Change

Added:

```text
POST /auth/change-password
```

Flow:

```text
authenticated user
  ↓
submit current password + new password
  ↓
verify current password
  ↓
hash new password
  ↓
save password_hash
  ↓
revoke every active session for that user
  ↓
user must log in again
```

Revoking all sessions is intentional.

If another device or browser had an authenticated session, a password change invalidates it too.

Manual verification confirmed:

```text
correct current password → success
old password afterward → rejected
new password afterward → accepted
existing session afterward → rejected
```

---

# 10. Password Policy

The frontend currently defines:

```text
at least 8 characters
at least 1 uppercase letter
at least 1 symbol
```

I mirrored those rules on the backend.

This is important because browser validation can always be bypassed.

The backend applies this policy to:

```text
registration
password change
```

It does not apply it during login.

Login only verifies the submitted password against the stored hash.

---

# 11. Email Normalization

Registration and login originally compared the email as entered.

That creates a risk of treating capitalization variants differently.

I added normalization:

```text
strip()
lower()
```

Flow:

```text
CaseTest@Example.com
  ↓
casetest@example.com
  ↓
database
```

This is used for:

```text
registration
login
email-change request
```

Manual verification confirmed that differently-capitalized versions resolve to the same account.

---

# 12. Profile Read / Update

Added:

```text
GET /profile
PATCH /profile
```

Current supported profile values include:

```text
name
photo_url
notification preferences
```

The PATCH implementation uses only fields actually sent by the client.

Conceptually:

```text
request contains only name
  ↓
change only name
  ↓
leave all omitted fields untouched
```

This prevents a partial update from accidentally blanking unrelated settings.

---

# 13. Profile Validation

## Name

Whitespace-only names are rejected.

Example:

```text
"     "
```

does not count as a valid name.

## Photo path

The DB stores a relative path rather than a machine-specific absolute filesystem path.

Valid shape:

```text
uploads/profile123.jpg
```

Invalid example:

```text
/Users/lv/picture.jpg
```

Path traversal such as `..` is also rejected.

Actual multipart image-upload handling is still future work.

---

# 14. Default Split Ratio Issue

The requirement wording describes a profile-level:

```text
default split ratio
```

The actual DB migration added:

```text
user_groups.split_percentage
```

That represents:

```text
one user's percentage inside one group
```

not:

```text
one global default stored on the user
```

I did not create a second conflicting representation.

This remains a team-level requirement/schema interpretation decision.

---

# 15. Email Change Verification

Email changes are intentionally separate from normal profile PATCH.

The user cannot directly overwrite:

```text
users.email
```

through `/profile`.

Instead:

```text
POST /profile/email-change
```

starts the change.

Flow:

```text
current email = old@example.com

request:
new@example.com
  ↓
normalize new address
  ↓
check not already used
  ↓
store pending_email = new@example.com
  ↓
keep email = old@example.com
  ↓
create short-lived verification token
```

The user's real login email does not change yet.

---

# 16. Email Verification Token

Email verification uses a separate signed token from login sessions.

This was intentional.

The login `sessions` table has no token-purpose field, so storing email-verification tokens there could blur two completely different security purposes.

The verification token contains information including:

```text
user ID
pending email
purpose = email_change
expiration
```

It uses:

```env
EMAIL_VERIFICATION_SECRET
EMAIL_VERIFICATION_EXPIRE_MINUTES
```

Current default expiration:

```text
30 minutes
```

---

# 17. Email Confirmation

Added:

```text
POST /profile/email-change/confirm
```

Flow:

```text
verification token
  ↓
verify signature
verify expiration
verify purpose
extract user ID
extract pending email
  ↓
load user
  ↓
confirm token email still matches pending_email
  ↓
check email uniqueness AGAIN
  ↓
email = pending_email
pending_email = NULL
email_verified = true
```

The second uniqueness check is important because another account could claim the address after the first request but before confirmation.

Manual verification confirmed the full pending-email-to-confirmed-email state transition.

---

# 18. Development Email Limitation

No SMTP/email delivery provider is currently configured.

For development, the request endpoint returns the verification token so the confirmation path can be exercised manually.

That is not intended as production behavior.

Future production behavior:

```text
generate token
  ↓
email link/token to pending address
  ↓
do not expose token in API response
```

---

# 19. Seed Data Cleanup

The seed script was updated for the renamed field:

```text
password
→
password_hash
```

I also changed seed users to run their development passwords through the same real password hashing function used by registration.

That avoids storing fake strings that only look like hashes.

---

# 20. Existing Automated Tests

The existing backend test suite currently contains six tests.

After Sprint 2 changes:

```text
6 passed
```

A test fixture initially failed because:

1. the old test password no longer satisfied the strengthened password policy
2. session rows introduced a foreign-key dependency when deleting the test user

The fixture was updated so:

- test password satisfies the real policy
- test sessions are deleted before deleting the test user

The final regression suite is green.

---

# 21. Developer Verification Performed

In addition to the existing automated suite, I manually checked:

```text
database migration to head
session creation
token hash storage
7-day expiration
logout revocation
revoked-session rejection
expired-session rejection
generic 401 response
password change
old/new password behavior
session revocation after password change
profile GET
profile PATCH
name validation
photo-path validation
email pending state
email confirmation
email_verified state
weak password rejection
case-insensitive email behavior
```

These checks were useful during implementation, but some should still be converted into automated regression tests.

---

# 22. Files Added / Modified

Major backend areas touched during Sprint 2 include:

```text
app/api/dependencies.py
app/api/routes/auth.py
app/api/routes/profile.py
app/core/security.py
app/main.py
app/schemas/auth.py
app/schemas/profile.py
models.py
seed.py
tests/test_auth.py
.env.example
.gitignore
alembic/versions/*
```

---

# 23. Environment Configuration

Development configuration uses:

```env
DATABASE_URL=...
SESSION_EXPIRE_HOURS=168
COOKIE_SECURE=false
EMAIL_VERIFICATION_SECRET=...
EMAIL_VERIFICATION_EXPIRE_MINUTES=30
```

Important distinction:

```text
COOKIE_SECURE=false
```

is for local HTTP development.

Production HTTPS should use:

```text
COOKIE_SECURE=true
```

---

# 24. Final Sprint 2 Backend State

Functionally implemented:

```text
IT2-1 Persistent sessions        ✅
IT2-2 Guest/expired handling     ✅
IT2-3 Profile update             ✅*
IT2-4 Password change            ✅
IT2-5 Email verification         ✅*
```

Caveats:

```text
* default split ratio needs team/schema clarification
* verification logic exists, actual email delivery does not
* actual profile image upload does not yet exist
```

Current regression result:

```text
6 passed
```
