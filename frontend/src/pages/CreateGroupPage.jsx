import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icons.jsx';
import InviteField from '../components/InviteField.jsx';
import Message from '../components/Message.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { createGroup, inviteMember } from '../api/groups.js';
import { rememberGroup } from '../lib/groupCache.js';
import { DEFAULT_GROUP_TYPE, GROUP_TYPES } from '../lib/groupTypes.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { validateGroupName, validateInviteEmail } from '../lib/validators.js';

// Sends the invitations one at a time and sorts the outcomes into messages for the group page.
// Returns [{ kind: 'ok' | 'warn' | 'error', text }]. Stops early (returns null) if the session ended.
async function sendInvites(groupId, emails) {
  const sent = [];
  const notices = [];
  for (const email of emails) {
    const res = await inviteMember(groupId, email);
    if (res.status === 401) return null;
    if (res.ok && res.data?.status === 'registration_required') {
      notices.push({ kind: 'warn', text: `${email} doesn’t have an account yet, so no invite was sent.` });
    } else if (res.ok) {
      sent.push(email);
    } else if (res.status === 409) {
      notices.push({ kind: 'warn', text: `${email} was already invited or is already a member.` });
    } else {
      notices.push({ kind: 'error', text: `We couldn’t invite ${email}. ${messageFromResult(res, 'Please try again from Group settings.')}` });
    }
  }
  if (sent.length > 0) {
    notices.unshift({ kind: 'ok', text: `Invite sent to ${sent.join(', ')}. They show as pending until they accept.` });
  }
  return notices;
}

// Create group screen: name, type, and an optional list of people to invite. Nothing is saved until
// "Create group" is pressed, so Cancel (a plain link back) leaves nothing behind.
export default function CreateGroupPage() {
  usePageTitle('Create group');
  const navigate = useNavigate();
  const { profile, onExpired } = useAuth();

  const [name, setName] = useState('');
  const [type, setType] = useState(DEFAULT_GROUP_TYPE);
  const [inviteInput, setInviteInput] = useState('');
  const [emails, setEmails] = useState([]); // people to invite once the group exists
  const [nameError, setNameError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focusTick, setFocusTick] = useState(0); // bumped when a submit is blocked, to focus the first invalid field
  const formRef = useRef(null);

  useEffect(() => {
    if (focusTick) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusTick]);

  // Checks the text in the invite box. Returns the cleaned email to add, or '' after setting an error.
  function checkInvite(raw) {
    const problem = validateInviteEmail(raw);
    if (problem) {
      setInviteError(problem);
      return '';
    }
    const email = raw.trim().toLowerCase();
    if (email === profile.email.toLowerCase()) {
      setInviteError('You are already in this group.');
      return '';
    }
    if (emails.includes(email)) {
      setInviteError('That email is already on the list.');
      return '';
    }
    return email;
  }

  function addInvite() {
    const email = checkInvite(inviteInput);
    if (!email) return;
    setEmails((list) => [...list, email]);
    setInviteInput('');
    setInviteError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    const problem = validateGroupName(name);
    setNameError(problem);
    // Text left in the invite box counts as someone to invite; a bad address stops the submit so it isn't lost.
    let toInvite = emails;
    if (inviteInput.trim()) {
      const email = checkInvite(inviteInput);
      if (!email) {
        setFocusTick((n) => n + 1);
        return;
      }
      toInvite = [...emails, email];
    }
    if (problem) {
      setFocusTick((n) => n + 1);
      return;
    }

    setSubmitting(true);
    const res = await createGroup({ name, groupType: type });
    if (res.status === 401) {
      onExpired();
      return;
    }
    if (!res.ok) {
      setSubmitting(false);
      setSubmitError(messageFromResult(res, 'We couldn’t create the group. Please check the details and try again.'));
      return;
    }

    const group = { id: res.data.id, name: res.data.name, type: res.data.group_type };
    // WORKAROUND(no list routes): START. The backend can't list "my groups", so remember this new group in this browser.
    // Without this line the group would be missing from the Home and Groups pages. See lib/groupCache.js.
    rememberGroup(profile.id, group);
    // WORKAROUND(no list routes): END
    const notices = await sendInvites(group.id, toInvite);
    if (notices === null) {
      onExpired();
      return;
    }
    navigate(`/groups/${group.id}`, { state: { group, notices } });
  }

  return (
    <main className="page-wrap page-wrap--narrow">
      <div>
        <Link className="back-link" to="/groups">← Groups</Link>
        <h1>Create group</h1>
      </div>

      <form className="panel" onSubmit={handleSubmit} noValidate aria-label="New group" ref={formRef}>
        <TextField
          label="Group name"
          value={name}
          onChange={setName}
          onBlur={() => name && setNameError(validateGroupName(name))}
          error={nameError}
          autoComplete="off"
        />

        <fieldset className="plain">
          <legend>Group type</legend>
          <div className="rad-group">
            {GROUP_TYPES.map((t) => (
              <label key={t.value} className="rad">
                <input type="radio" name="group-type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <InviteField
            label="Invite members by email"
            value={inviteInput}
            onChange={setInviteInput}
            onSubmit={addInvite}
            buttonLabel="Add"
            error={inviteError}
          />
          {emails.length > 0 && (
            <ul className="chip-list mt-3" aria-label="People you are inviting">
              {emails.map((email) => (
                <li key={email} className="chip chip--static">
                  <Avatar text={email} />
                  {email}
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Remove ${email} from the invite list`}
                    onClick={() => setEmails((list) => list.filter((x) => x !== email))}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Message kind="info">
          <p>
            You become the group’s admin. Everyone you invite shows as pending until they accept. If an email doesn’t have
            an account yet, no invite is sent to it.
          </p>
        </Message>

        {submitError && <Message kind="error" alert>{submitError}</Message>}

        <div className="btn-row">
          <button type="submit" className="btn btn-tint" disabled={submitting}>
            {submitting ? 'Creating group…' : 'Create group'}
          </button>
          <Link className="btn btn-ghost" to="/groups">Cancel</Link>
        </div>
      </form>
    </main>
  );
}
