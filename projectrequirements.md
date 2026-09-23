“Collaborative finance for people who actually share their lives.”

## Scope: “Shared Expense Management Tool”

- Shared and Personal Budgeting Application
- Receipt and Bill Upload
- Monthly User Metrics and Analysis
  - “Cole paid for 62% of [these shared expenses] this month, though your configured split is 50%.”
  - “You visited Starbucks 23 times this month, for an average of $195.50.”
- Log In / Register Page - Hash user passwords
- Automated Unit Testing
- Documentation
- Profile Page / Settings
- User friendly UI
- Does NOT enforce budgeting rules; that is up to the users.
- Does NOT access banks or process real money

## Requirements:

### Functional Requirements:

Users → Group → Expenses → Splits → Balances (→ Budgets → AI Analysis)

- Image recognition LLM collects receipt/expense data for PDF, images from camera, and JPEG
- LLM Functionality - Image reading (receipt based) + Itemization / output JSON
- Allow users to review and edit extracted data from LLM
- Analysis of Monthly budget and possibly offer advice or visualization of data
- Categories for budget and setting goals for users (and group as whole, as an idea?)
- Security features: HTTPS, password hashing, input validation, auth tokens, authorization checks, rate limiting, secrets management.
- Persistent user authentication so the user remains logged in after the page is closed, through securely stored authentication cookies with configurable expiration.
- Hash user passwords / PostgreSQL
- 1 CSS Framework
- Any Framework / Library
- Web applications should be able to be used on Phone or PC.
- Comments / emoji reactions to expenses (?)
- Notifications
- Activity history

#### Mechanics

- Adding expenses manually
- Settling debt: settle owed money / reset “amount owed to [user]” to zero.
- Add/remove users from group
- Types of group (roommate, romantic relationship, group outing, family, etc) to create
- “Events” where you choose ALL or pick users within group (not all members of a group will always be relevant in every event)
- Receipt → extracted items → user fixes mistakes → assigns items to people → app calculates everyone's share → save expense
- Set recurring payments (rent, utilities, other monthly bills)
- Delete uploaded receipts (?), keep extracted info (?); privacy concerns.

### Non-Functional Requirements:

- **Flexibility:** When financial decisions do not go as expected or planned, the entered data should never be irreversibly inaccurate. - Data can be edited by users
- **Ease of use:** On both PC and phone, low-friction reliable web design so that 90% of people would consistently use it.
  - Text and images resize smoothly, buttons are spaced enough apart for touchscreen use, menus reconfigure themselves on mobile, etc.
  - Takes a user less than 3 minutes to understand the site
- Users should feel confident their data is secure but also accessible enough so they actually want to use the app. User specific data should not be accessible by Admin.
- Usable by anyone
- Text must be readable and aligned - Must work with screen readers
- Pay attention to UI's negative space

## Constraints

- No CMS (WordPress, etc.)

## Stretch Goals:

- Persistent user authentication so the user remains logged in after the page is closed
- Web API for backend interactions
- Self-hosted auth for password reset
- ADA audit

## Testing for our functional requirements:

- LLM correctly identifies receipts/bill photos regardless of lighting for ease of use
- User authentication is continuous even after close
- Application passes security audit
- Application passes ADA audit
- Ensure site is not overloaded by multiple simultaneous users
- Persistent Unit testing for all site functionality using unittest (PyUnit)

## Users (Further specify reqs based on user):

- **Admin** - ability to bypass log in page, cannot access specific user data, give access to Commerce employees
- **Normal Users** - only access their own account and main site functionality, regular commerce bank customers
- **Guest Users** - Can only access login page

---

# Use Cases for Requirements

Cole, Mick, Xander, Lukas — 09/16/26

---

### Use Case Title:
Create Account / Login

**Actors:**
New or Returning Web User

**Preconditions:**
Web User is at the create account page or login page

**Postconditions:**
Account is created or user login is verified

**Basic Flow / Main Success Scenario:**
1. User begins to input email
2. System verifies email is valid upon entry
3. User is instructed to create a password in a hidden field with requirements underneath (8 characters, 1 Capital Letter, 1 Symbol, etc.)
4. System verifies password fits the requirements
5. User is instructed to re-enter proposed password to verify correctness
6. System verifies passwords match and confirms to user
7. User clicks create account and is brought to home page
8. System saves user details and hashes password into database

**Alternate Flow / Extensions:**
- If user already holds an account, they will be instructed to visit the login page
- On this page they will enter email and password in specified fields
- System will hash and verify correct account information matches a previously existing account
- If fails, user is instructed to register or reset password
- If login is successful user will reach the homepage

**Open Issues:**
- How to save user info for next login
- How to create password reset function

---

### Use Case Title:
Receipt Bill Upload

**Actors:**
Application User

**Preconditions:**
User begins with choosing image to upload

**Postconditions:**
Image is processed with LLM and LLM is able to parse the image, take information from receipt, and itemize specified item $ amounts, and display information in the dashboard for the user to see.

**Basic Flow / Main Success Scenario:**
1. User clicks upload button
2. Depending on the user's platform (phone/web browser), users can take pictures of receipts or upload from photos gallery.
3. If on a web browser, the user can upload images with system file explorer.
4. System status box opens up.
5. User chooses image or takes picture.
6. Once image is successfully uploaded it should show the user a green checkmark showing success.
7. After successful image upload, the application with then integrate LLM operations to parse through using an OCR image reader and pick out significant information (Store location, items bought, amounts for each time, and time/date)
8. LLM parsed info gets added to backend database for secure storage.
9. Once data is added to database, it will then reflect back to the front end UI so user can see data that has been uploaded.
10. The data should be structured JSON, but will be reflected in a React based UIX.

**Alternate Flow / Extensions:**
- If user uploads image, but image does not upload successfully, a red system error message should appear and say “image unsessfuly uploaded”.
- Error box should explain the error, and offer a solution based on what may be the reason.
- This could be, wrong image format, too large of an image, or corrupt file.
- The application should prompt the user to re-upload the image, possibly offering a solution if issue is easy fix such as “too large of file, please compress or resize image”.
- If image is successfully uploaded, but LLM is not able to successfully parse and read the image, an error box should appear stating said error in a clean concise way, and offer a solution.

**Open Issues:**
- What type of OCR image reader will be reading the images and grabbing what is important in many types of formats.

---

### Use Case Title:
Create split payment

**Actors:**
Application User

**Preconditions:**
User is at the splits page

**Postconditions:**
”Split” is created and preserved that contains subject of split (what the money's going towards), the amount owed by each person, and the frequency of payment.

**Basic Flow / Main Success Scenario:**
1. User selects New Split button
2. User presented fields for the new split
3. User enters split title
4. [4 - 7] in no particular order
   - User enters total amount
   - User adds group members to list of payers
   - User enters each payer's owed amount
   - User enters payment due date and/or frequency + starting date (similarly to something like google calendar repeated events)
5. User selects Create Split button
6. New split is created for the group

**Alternate Flow / Extensions:**
- If New Split prompt is cancelled, the process is terminated and the new split is lost.
- If user selects autosplit button, initiate autosplit use case.
- If user attempts to create new split when individual payments do not add up to split total, notify the user and do not create the split.

**Open Issues:**

---

### Use Case Title:
Create Group

**Actors:**
Web User

**Preconditions:**
User is logged in and on the Groups page

**Postconditions:**
New group is created with the user as a member

**Basic Flow / Main Success Scenario:**
1. User selects “Create Group” button
2. User enters group name
3. User selects group type (roommate, partner, group outing, family, etc)
4. User invites members by email or username
5. User selects Create button
6. System creates group and adds invited users as pending members
7. Invited users receive a notification to join

**Alternate Flow / Extensions:**
- If an invited user doesn't have an account, system sends an invite to register first
- If user cancels creation, group is not saved
- If an invited user declines, they are not added to the group

**Open Issues:**
- Does group type change what feats show up? (e.g. recurring rent only for “roommate” type)

---

### Use Case Title:
Add/Remove Group Member

**Actors:**
Web User (Group member)

**Preconditions:**
User is viewing an existing group's settings

**Postconditions:**
Member is added to or removed from the group

**Basic Flow / Main Success Scenario:**
1. User navigates to group settings
2. User selects “add member” and enteres email/username or selects a member to remove
3. System checks removed members balance
4. If balance is $0, system removes them immediately
5. If not, system warns the user before proceeding

**Alternate Flow / Extensions:**
- If a removed member has an unsettled balance, system requires settlement first or asks for explicit confirmation to remove anyway
- If user tries to remove themselves as the only admin, system prompts them to assign a new admin first

**Open Issues:**
- What happens to past expenses tied to a removed member - archived or still visible?
- Who has the permission to add/remove members - any member or only group admin?

---

### Use Case Title:
Create Event

**Actors:**
Web User

**Preconditions:**
User belongs to a group

**Postconditions:**
A scoped subset of the group is created for tracking expenses relevant to only some members

**Basic Flow / Main Success Scenario:**
1. User selects “New event” within a group
2. User enteres even name (e.g. Trip)
3. User selects “all members” or picks specific members
4. User selects Create Event
5. Expenses can now be tagged to this event instead of the whole group

**Alternate Flow / Extensions:**
- If user selects zero members, system blocks creation and prompts for at least one
- If cancelled, event is discarded

**Open Issues:**
- Does an event get its own balance view, or just filter the group's existing balance?
- Should events have an end date/archive state once the trip is over?

---

### Use Case Title:
Add expense manually

**Actors:**
Web User

**Preconditions:**
User is on the dashboard and bleongs to at least one group

**Postconditions:**
New expense is created and split assigned

**Basic Flow / Main Success Scenario:**
1. User selects add expense
2. User enteres title, total amt, and category
3. User selects which group the expense belongs to
4. User selects who paid
5. User selects which members are involved
6. User chooses split method (even, custom amount, percentage)
7. User selects save
8. System calculates each member's share and updates balances

**Alternate Flow / Extensions:**
- If cancelled partway, expense is discarded
- If custom split amounts don't add up to the total, system blocks save and notifies user
- If user has no groups yet, system prompts them to create or join one first

**Open Issues:**
- Should manually added expenses support attaching a recipe after the fact?
- How to handle an expense that spans more than one group?

---

### Use Case Title:
Review and Assign Extracted Receipt Data

**Actors:**
Web User

**Preconditions:**
Receipt has been uploaded and parsed by the LLM

**Postconditions:**
Extracted items are corrected and assigned to specific people; expense is saved with an accurate split

**Basic Flow / Main Success Scenario:**
1. System displays parsed receipt data (store, items, prices, date) in editable fields
2. User reviews each line item
3. User edits any incorrect name, price, or quantity
4. User aggisn each item to one or more people
5. System calculates each person's share from the assignments
6. User reviews the calculated split
7. User selects save expense
8. System stores the finalized expense and updates balances

**Alternate Flow / Extensions:**
- If an item is unassigned, system flags it and excludes it from the split until resolved
- If user cancels, extracted data is not saved

**Open Issues:**
- Should partial item assignment be allowed? (splitting one item across some but not all people)
- What happens to the receipt image once review is finished - keep or delete?

---

### Use Case Title:
Autosplit Expense

**Actors:**
Web User

**Preconditions:**
User is creating or editing a split and has selected members to include

**Postconditions:**
Total is divided evenly (or by a saved ratio) across selected members

**Basic Flow / Main Success Scenario:**
1. User selects autosplit while creating a split
2. System divides the total evenly across selected members
3. System displays the per-person amount
4. User reviews and confirms

**Alternate Flow / Extensions:**
- If the total doesn't divide evenly, system rounds and assigns leftover cents to one member, flagged as such
- If the group has a saved custom ratio, system uses that instead of an even split
- User can switch to manual and adjusts individual amounts after autosplitting

**Open Issues:**
- Should users be able to save a custom split ratio as the default for a group

---

### Use Case Title:
Settle Debt

**Actors:**
Web User

**Preconditions:**
User has an outstanding balance with another group member

**Postconditions:**
Balance is reset to zero (or reduced) and logged in activity history

**Basic Flow / Main Success Scenario:**
1. User navigates to Balances page
2. User selects the balance to settle
3. User selects “Settle Up”
4. System asks for confirmation (full or partial amount)
5. User confirms
6. System updates the balance
7. System logs the settlement for both users

**Alternate Flow / Extensions:**
- If a partial amount is settled, the remaining balance stays outstanding
- If cancelled, balance is unchanged

**Open Issues:**
- Since the app doesn't move real money, does settling just mean “mark as paid outside the app” - the UI language needs to make that clear
- Should the other person have to confirm the settlement too, or is it one sided?

---

### Use Case Title:
Set budget categories and goals

**Actors:**
Web user

**Preconditions:**
User is on the Budget page for a personal or group view

**Postconditions:**
Categories and spending goals are saved and tracked going forward

**Basic Flow / Main Success Scenario:**
1. User selects “set budget” for personal or group view
2. User creates or selects a category (food, rent, entertainment, etc.)
3. User enters a monthly goal for that category
4. User repeats for additional categories
5. User selects save
6. System tracks future expenses against each goal

**Alternate Flow / Extensions:**
- For a group budget, system asks whether the goal applies per-person or to the group total
- If a goal is editged mid-month, system needs a rule for weather that applies retroactively or only going forward

**Open Issues:**
- Per-person vs. shared group group goal - spec flags this as an open idea, needs decision
- What happens when a goal is exceeded - just a visual flag or notification too?

---

### Use Case Title:
View monthly analysis and metris

**Actors:**
Web user

**Preconditions:**
User has at least one month of expense history

**Postconditions:**
User sees a summary of spending behavior and balance patterns

**Basic Flow / Main Success Scenario:**
1. User navigates to analysis/insights page
2. System pulls the month's expense and split data
3. System generates metris (“Cole paid 62% of shred expenses this month vs. a 50% split,” “You visited starbucks 23 times, averaging $195.50”)
4. System displays a chart of spending by category alongside the metrics
5. User can select a different month or range to view

**Alternate Flow / Extensions:**
- If there isn't enough data yet (new user), system shows an empty state instead of a broken chart
- If user opts into “advice”, system surfaces a simple suggestion (e.g. “15% over your food budget this month”)

**Open Issues:**
- Does the “advice” come from the LLM interpreting the numbers, or from static rule-based thresholds?
- How far back does history go before storage/performance becomes a concern?

---

### Use Case Title:
Manage profile / settings

**Actors:**
Web user

**Preconditions:**
User is logged in

**Postconditions:**
Profile info and settings are updates

**Basic Flow / Main Success Scenario:**
1. User navigates to profile/settings
2. User edits fields (name, email, photo, notification prefs, default split ratio)
3. User selects save
4. System validates and confirms the update

**Alternate Flow / Extensions:**
- If email is changed, system requires re-verification before it takes effect
- If password is changed, system requires the current password first
- If validation fails, system shows an inline error and doesn't save

**Open Issues:**
- Should users be able to delete their account and what happens to their expense history if they do?

---

### Use Case Title:
Delete uploaded receipt

**Actors:**
Web user

**Preconditions:**
User has a receipt image attached to an existing expense

**Postconditions:**
Receipt image is deleted; itemized data stays unless the whole expense is also deleted

**Basic Flow / Main Success Scenario:**
1. User opens the expense with an attached receipt
2. User selects “delete receipt image”
3. System confirms, noting the extracted data will be kept
4. User confirms
5. System deletes the image but keeps the itemized expense

**Alternate Flow / Extensions:**
- Deleting the whole expense (not just the image) is a separate action with its own confirmation
- If deletion fails, system shows an error and keeps the image

**Open Issues:**
- How long are receipt images retained by default before a user deletes one, if at all
- Should there be an auto-purge policy (e.g. 30 days) instead of relying on manual deletion

---

### Use Case Title:
Admin login / access

**Actors:**
Admin (commerce employee)

**Preconditions:**
Admin has been granted access by the bank

**Postconditions:**
Admin reaches the admin dashboard without going through normal user auth, but cannot view or edit any individual user's private data

**Basic Flow / Main Success Scenario:**
1. Admin navigates to a separate admin login page (not the normal user login)
2. Admin enters admin credentials
3. System verifies credentials against the admin role table, not teh normal user table
4. Admin is brought to an admin dashboard showing site-level metrics only (uptime, error logs, total users, flagged issues, etc.)
5. Admin can grant or revoke admin access for other commerce employees from this dashboard

**Alternate Flow / Extensions:**
- If admin creds fail, admin is shown a generic log error (same wording as normal login, so no extra info is leaked about admin accounts existing)
- If admin attempts to navigate to a sepcifc user's account page or data, system blocks the request and logs the attempt
- If a non-admin account somehow reaches the admin page, access is denied and the attempt is logged

**Open Issues:**
- Is admin access role-based within commerce (e.g. read-only support staff vs someone who can revoke other admins) or is it one admin role?
- What exactly counts as “site-level” data an admin can see - do aggregate stas like “average number of groups per user” cross the line into user data, even without names attached
- How is the first admin account created/bootstrapped, since normal registration doesn't apply here

---

### Use Case Title:
Guest access

**Actors:**
Guest user (unauthenticated visitor)

**Preconditions:**
Visitor arrives at teh site without an existing session or account

**Postconditions:**
Visitor is restricted to the login/register page and cannot reach any app functionality

**Basic Flow / Main Success Scenario:**
1. Visitor navigates to the site url
2. System checks for a valid session/auth token
3. No valid session found, so system routes visitor to the login/register page
4. Visitor is shown the option log in or create an account
5. Any direct link to an internal page (dashboard, group, expense, etc.) redirects back to login if theres no valid session

**Alternate Flow / Extensions:**
- If a guest tries to access an internal URl directly (typing it in, old bookmark, etc.), system redirects to login rather than showing an error page that confirms the URl is real
- If a guest's session token exists but is expired, system treats them as a guest and redirects to login rather than throwing and error

**Open Issues:**
- Is there any content a guest should see before logging in (marketing/landing page, “what is this app” explainer) or is login literally the only thing rendered
- Should failed redirect attempts be rate-limited or logged as potential probing, given this is tied to a real bank


**Claude Sonnet 5 used to format this document for markdown on GitHub. No changes were made to the content by the model**