import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import PendingInvites from '../components/PendingInvites.jsx';
import ScanDialog from '../components/receipt/ScanDialog.jsx';
import '../receipt.css';
import { useAuth } from '../components/RequireAuth.jsx';
import Message from '../components/Message.jsx';
import { useMyGroups } from '../lib/groupHooks.js';
import { typeLabel } from '../lib/groupTypes.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// "Good morning, <first name>": the first word of the profile name, or the start of the email when there is no name.
function greeting(profile) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const first = (profile.name ?? '').trim().split(/\s+/)[0] || profile.email.split('@')[0];
  return `Good ${part}, ${first}`;
}

// Page shown after signing in. The login check and top bar come from RequireAuth.
// Shows your groups (from the server) and the invitations waiting for an answer. Accepting an invitation
// loads the groups again, so the new group shows up in "Your groups" without a refresh.
export default function HomePage() {
  usePageTitle('Home');
  const { profile } = useAuth();
  const { status, groups, reload } = useMyGroups();
  const [scanOpen, setScanOpen] = useState(false); // the "Scan a receipt" pop-up

  return (
    <main className="page-wrap rc-home">
      <div>
        <h1>{greeting(profile)}</h1>
        <p className="text-body-secondary mt-1 mb-0">Here is what is happening across your groups.</p>
      </div>

      <section className="panel rc-col" aria-labelledby="add-title">
        <h2 id="add-title">Add an expense</h2>
        <div className="rc-paths">
          <button className="rc-path pri" type="button" aria-haspopup="dialog" onClick={() => setScanOpen(true)}>
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
            <span><span className="t">Scan a receipt</span><span className="d">Take a photo or upload one. We itemize it, you check it.</span></span>
          </button>
          <Link className="rc-path" to="/expenses/new">
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
            <span><span className="t">Enter by hand</span><span className="d mute">Title, amount, who is in, and how to split it.</span></span>
          </Link>
        </div>
      </section>
      {scanOpen && <ScanDialog groups={groups} onClose={() => setScanOpen(false)} />}

      <section className="panel rc-col" aria-labelledby="groups-title">
        <div className="panel-head">
          <h2 id="groups-title">Your groups</h2>
          <Link className="link-strong" to="/groups">See all</Link>
        </div>
        {status === 'loading' && <p className="text-body-secondary mb-0" role="status">Loading your groups…</p>}
        {status === 'error' && (
          <div className="d-flex flex-column align-items-start gap-3">
            <Message kind="error" alert>We couldn’t load your groups. Check your connection and try again.</Message>
            <button type="button" className="btn btn-ghost" onClick={reload}>Try again</button>
          </div>
        )}
        {status === 'ready' && groups.length === 0 && (
          <div className="d-flex flex-column align-items-start gap-3">
            <p className="text-body-secondary mb-0">You are not in any groups yet. Groups you create or join show up here.</p>
            <Link className="btn btn-tint" to="/groups/new">Create group</Link>
          </div>
        )}
        {status === 'ready' && groups.length > 0 && (
          <ul className="list-unstyled m-0 row-list">
            {groups.map((g) => (
              <li key={g.id}>
                <Link className="row-item" to={`/groups/${g.id}`} state={{ group: g }}>
                  <Avatar text={g.name} large single />
                  <span className="row-grow">
                    <span className="row-title">{g.name}</span>
                    <span className="pill">{typeLabel(g.type)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PendingInvites showTitle={false} onJoined={reload} />
    </main>
  );
}
