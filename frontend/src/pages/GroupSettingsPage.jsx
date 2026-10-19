import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Dialog from '../components/Dialog.jsx';
import InviteField from '../components/InviteField.jsx';
import Message from '../components/Message.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { inviteMember, removeMember } from '../api/groups.js';
import { parseGroupId, useGroupMembers, useKnownGroup } from '../lib/groupHooks.js';
import { messageFromResult } from '../lib/apiErrors.js';
import { usePageTitle } from '../lib/usePageTitle.js';
import { validateInviteEmail } from '../lib/validators.js';

export default function GroupSettingsPage() {
  const groupId = parseGroupId(useParams().groupId);
  if (groupId === null) {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Link className="back-link" to="/groups">← Groups</Link>
        <Message kind="error" alert>That group address isn’t valid.</Message>
      </main>
    );
  }
  return <Settings groupId={groupId} />;
}

// Dollar amount for the balance warning. The backend sends the balance as a plain number (dollars is assumed).
const money = (n) => `$${Math.abs(Number(n)).toFixed(2)}`;

// Group settings: who is in the group and what each person's role is, adding people, and removing people.
function Settings({ groupId }) {
  usePageTitle('Group settings');
  const { profile, onExpired } = useAuth();
  const group = useKnownGroup(groupId);
  const { status, members, setMembers, reload } = useGroupMembers(groupId);

  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitedNow, setInvitedNow] = useState([]); // emails invited during this visit, shown as Pending
  const [removing, setRemoving] = useState(null); // user id being removed
  const [warn, setWarn] = useState(null); // { member, balance } while the balance warning is open
  const [message, setMessage] = useState(null); // { kind, text } confirmation or notice
  const [error, setError] = useState('');
  const messageRef = useRef(null);

  // After a change the button the user pressed may be gone, so move focus to the message.
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const groupName = group?.name ?? 'this group';
  const me = members.find((m) => m.user_id === profile.id);
  const isAdmin = Boolean(me?.is_admin);

  async function addMember() {
    setMessage(null);
    setError('');
    const problem = validateInviteEmail(inviteInput);
    setInviteError(problem);
    if (problem) return;
    const email = inviteInput.trim().toLowerCase();
    if (members.some((m) => m.email.toLowerCase() === email) || invitedNow.includes(email)) {
      setInviteError('That person is already in the group or has been invited.');
      return;
    }

    setInviting(true);
    const res = await inviteMember(groupId, email);
    setInviting(false);
    if (res.status === 401) {
      onExpired();
      return;
    }
    if (res.ok && res.data?.status === 'registration_required') {
      setInviteInput('');
      setMessage({ kind: 'warn', text: `${email} doesn’t have an account yet, so no invite was sent.` });
    } else if (res.ok) {
      setInviteInput('');
      setInvitedNow((list) => [...list, email]);
      setMessage({ kind: 'ok', text: `Invite sent to ${email}. They show as pending until they accept.` });
    } else {
      setError(messageFromResult(res, 'We couldn’t send that invite. Please try again.'));
    }
  }

  // Removes a member. A first try without confirm may come back as a balance warning; "Remove anyway" retries with confirm.
  async function remove(member, confirm = false) {
    setMessage(null);
    setError('');
    setRemoving(member.user_id);
    const res = await removeMember(groupId, member.user_id, confirm);
    setRemoving(null);
    if (res.status === 401) {
      onExpired();
      return;
    }
    if (res.ok) {
      setWarn(null);
      setMembers((list) => list.filter((m) => m.user_id !== member.user_id));
      setMessage({ kind: 'ok', text: `${member.email} was removed from ${groupName}.` });
    } else if (res.status === 409 && res.data?.detail?.confirmation_required) {
      setWarn({ member, balance: res.data.detail.balance });
    } else {
      setWarn(null);
      setError(messageFromResult(res, 'We couldn’t remove that member. Please try again.'));
    }
  }

  if (status === 'denied') {
    return (
      <main className="page-wrap page-wrap--narrow">
        <Link className="back-link" to="/groups">← Groups</Link>
        <Message kind="error" alert>You can’t open this group’s settings. The group may not exist, or you may not be an accepted member.</Message>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <div>
        <Link className="back-link" to={`/groups/${groupId}`} state={{ group }}>← {group?.name ?? 'Group'}</Link>
        <h1>Group settings</h1>
      </div>

      {message && (
        <Message kind={message.kind} boxRef={messageRef} tabIndex={-1}>
          {message.text}
        </Message>
      )}
      {error && <Message kind="error" alert>{error}</Message>}

      <section className="panel" aria-labelledby="members-title">
        <h2 id="members-title">Members</h2>

        {status === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading members…</p>}
        {status === 'error' && (
          <>
            <Message kind="error" alert>We couldn’t load the members. Check your connection and try again.</Message>
            <div>
              <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
            </div>
          </>
        )}

        {status === 'ready' && (
          <>
            <ul className="list-unstyled m-0">
              {members.map((m) => {
                const isMe = m.user_id === profile.id;
                return (
                  <li key={m.user_id} className="row-item">
                    <Avatar text={m.email} large />
                    <span className="row-grow">
                      <span className="row-title">{m.email}</span>
                      {isMe && <span className="row-sub">You</span>}
                    </span>
                    <span className={`pill${m.is_admin ? ' pill--primary' : ''}`}>{m.is_admin ? 'Admin' : 'Member'}</span>
                    {isAdmin && !isMe && (
                      <span className="btn-row">
                        {!m.is_admin && (
                          <button type="button" className="btn btn-ghost btn-s" disabled aria-describedby="admin-note" aria-label={`Make ${m.email} the admin`}>
                            Make admin
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-s"
                          aria-label={`Remove ${m.email} from ${groupName}`}
                          disabled={removing !== null}
                          onClick={() => remove(m)}
                        >
                          Remove
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
              {invitedNow.map((email) => (
                <li key={email} className="row-item">
                  <Avatar text={email} large />
                  <span className="row-grow">
                    <span className="row-title">{email}</span>
                    <span className="row-sub">Waiting for them to accept</span>
                  </span>
                  <span className="pill">Pending</span>
                </li>
              ))}
            </ul>

            {isAdmin ? (
              <p id="admin-note" className="text-body-secondary small mb-0">
                Making someone else the admin isn’t available yet. It will be turned on once the backend supports it.
              </p>
            ) : (
              <p className="text-body-secondary small mb-0">Only the group’s admin can remove members.</p>
            )}

            <div className="border-top pt-3">
              <InviteField
                label="Add a member by email"
                value={inviteInput}
                onChange={setInviteInput}
                onSubmit={addMember}
                buttonLabel={inviting ? 'Adding…' : 'Add member'}
                buttonKind="tint"
                busy={inviting}
                error={inviteError}
                hint="They show as pending until they accept."
              />
            </div>
          </>
        )}
      </section>

      {warn && (
        <Dialog title={`Remove ${warn.member.email}?`} onClose={() => setWarn(null)}>
          <Message kind="warn">
            {warn.member.email} has an unsettled balance of {money(warn.balance)} in this group.
          </Message>
          <p>Remove them anyway, or cancel and settle up first.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-danger-outline" disabled={removing !== null} onClick={() => remove(warn.member, true)}>
              Remove anyway
            </button>
            <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setWarn(null)}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
