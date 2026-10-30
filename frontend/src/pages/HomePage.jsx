import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import PendingInvites from '../components/PendingInvites.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getKnownGroups } from '../lib/groupCache.js';
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
// Shows the groups this browser knows about and the invitations waiting for an answer. Answering an invitation
// updates the page right away, so an accepted group shows up in "Your groups" without a refresh.
export default function HomePage() {
  usePageTitle('Home');
  const { profile } = useAuth();

  // WORKAROUND(no list routes): START. "Your groups" can't come from the server (no GET /groups), so it starts from the list this
  // browser remembers. Replace with a real request when that route exists. See lib/groupCache.js.
  const [groups, setGroups] = useState(() => getKnownGroups(profile.id));
  // WORKAROUND(no list routes): END

  return (
    <main className="page-wrap">
      <div>
        <h1>{greeting(profile)}</h1>
        <p className="text-body-secondary mt-1 mb-0">Here is what is happening across your groups.</p>
      </div>

      <section className="panel" aria-labelledby="groups-title">
        <div className="panel-head">
          <h2 id="groups-title">Your groups</h2>
          <Link className="link-strong" to="/groups">See all</Link>
        </div>
        {groups.length === 0 ? (
          <div className="d-flex flex-column align-items-start gap-3">
            <p className="text-body-secondary mb-0">You are not in any groups on this device yet. Groups you create or join show up here.</p>
            <Link className="btn btn-tint" to="/groups/new">Create group</Link>
          </div>
        ) : (
          <ul className="list-unstyled m-0 row-list">
            {groups.map((g) => (
              <li key={g.id}>
                <Link className="row-item" to={`/groups/${g.id}`} state={{ group: g }}>
                  <Avatar text={g.name} large />
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

      <PendingInvites showTitle={false} onJoined={setGroups} />
    </main>
  );
}
