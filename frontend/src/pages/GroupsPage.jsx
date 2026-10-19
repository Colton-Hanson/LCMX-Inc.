import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { useAuth } from '../components/RequireAuth.jsx';
import { getKnownGroups } from '../lib/groupCache.js';
import { typeLabel } from '../lib/groupTypes.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// Everyone you share expenses with: the groups this browser knows about, plus a way to create a new one.
// (The backend has no "list my groups" route yet, so the list comes from groups created or joined on this device.)
export default function GroupsPage() {
  usePageTitle('Groups');
  const { profile } = useAuth();
  // WORKAROUND(no list routes): START. The full list comes from this browser's saved list, not the server (no GET /groups).
  // So it is empty on a new browser or computer even for someone who is in groups. See lib/groupCache.js.
  const groups = getKnownGroups(profile.id);
  // WORKAROUND(no list routes): END

  return (
    <main className="page-wrap">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div>
          <h1>Groups</h1>
          <p className="text-body-secondary mt-1 mb-0">Everyone you share expenses with.</p>
        </div>
        <Link className="btn btn-tint" to="/groups/new">Create group</Link>
      </div>

      {groups.length === 0 ? (
        <section className="panel">
          <p className="text-body-secondary mb-0">
            No groups on this device yet. Create one, or accept an invitation on the Home page, and it shows up here.
          </p>
        </section>
      ) : (
        <ul className="group-grid" aria-label="Your groups">
          {groups.map((g) => (
            <li key={g.id}>
              <Link className="group-card" to={`/groups/${g.id}`} state={{ group: g }}>
                <span className="group-card-top">
                  <Avatar text={g.name} large />
                  <span className="pill">{typeLabel(g.type)}</span>
                </span>
                <span className="group-card-name">{g.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
