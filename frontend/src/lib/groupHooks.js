import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../components/RequireAuth.jsx';
import { getMembers } from '../api/groups.js';
import { getKnownGroups, forgetGroup } from './groupCache.js';

// WORKAROUND(no list routes): this hook is part of the "my groups" workaround. There is no group-detail route (no GET /groups/{id}),
// so a group's name and type come from the router state or from this browser's saved list. See lib/groupCache.js.
// The group's name and type for the page the user is on. The page that sent them here passes the group along in
// the router state; otherwise the group is looked up in the list this browser remembers. Returns null if unknown.
export function useKnownGroup(groupId) {
  const { profile } = useAuth();
  const { state } = useLocation();
  if (state?.group?.id === groupId) return state.group;
  return getKnownGroups(profile.id).find((g) => g.id === groupId) ?? null;
}

// Loads the accepted members of a group.
//   status   'loading' | 'ready' | 'denied' (not a member, or no such group) | 'error' (could not load)
//   members  [{ user_id, email, is_admin }]
//   setMembers  lets a page update the list after a change (a removal)
//   reload      tries the request again
export function useGroupMembers(groupId) {
  const { profile, onExpired } = useAuth();
  const [status, setStatus] = useState('loading');
  const [members, setMembers] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the response if the page was closed first
    setStatus('loading');
    getMembers(groupId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setMembers(res.data);
        setStatus('ready');
      } else if (res.status === 401) {
        onExpired();
      } else if (res.status === 403 || res.status === 404) {
        // WORKAROUND(no list routes): START. The server says this user can't open the group, so drop it from this browser's saved list.
        forgetGroup(profile.id, groupId);
        // WORKAROUND(no list routes): END
        setStatus('denied');
      } else {
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, attempt, onExpired, profile.id]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, members, setMembers, reload };
}

// Turns the :groupId part of the address into a number, or null when it is not a whole number.
export function parseGroupId(raw) {
  return /^\d+$/.test(raw ?? '') ? Number(raw) : null;
}
