import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../components/RequireAuth.jsx';
import { getGroup, getMembers, getMyGroups, getSplitDefault } from '../api/groups.js';
import { EVEN_DEFAULT } from './splitDefault.js';

// The server sends group_type; the pages use { id, name, type }.
const toGroup = (g) => ({ id: g.id, name: g.name, type: g.group_type });

// The groups the signed-in user belongs to (GET /groups).
//   status  'loading' | 'ready' | 'error'
//   groups  [{ id, name, type }]
//   reload  asks the server again (after joining a group, or for a "Try again" button)
export function useMyGroups() {
  const { onExpired } = useAuth();
  const [state, setState] = useState({ status: 'loading', groups: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the reply if the page was closed first
    getMyGroups().then((res) => {
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (!res.ok || !Array.isArray(res.data)) return setState({ status: 'error', groups: [] });
      setState({ status: 'ready', groups: res.data.map(toGroup) });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, onExpired]);

  const reload = useCallback(() => {
    setState((s) => (s.status === 'error' ? { ...s, status: 'loading' } : s));
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}

// The group's name and type for the page the user is on. The page that sent them here passes the group along in
// the router state; otherwise it is asked from the server (GET /groups/{id}). Returns null until it is known.
export function useKnownGroup(groupId) {
  const { onExpired } = useAuth();
  const { state } = useLocation();
  const fromState = state?.group?.id === groupId ? state.group : null;
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (fromState) return undefined;
    let cancelled = false;
    getGroup(groupId).then((res) => {
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (res.ok && res.data) setFetched(toGroup(res.data));
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, Boolean(fromState), onExpired]); // eslint-disable-line react-hooks/exhaustive-deps

  return fromState ?? (fetched?.id === groupId ? fetched : null);
}

// The group's default split from the server. Pass enabled = false to skip the request (an even split is returned).
//   status  'loading' | 'ready' | 'error'
//   saved   { method, percents }  (even while loading or after an error)
//   reload  asks again
export function useSplitDefault(groupId, enabled = true) {
  const { onExpired } = useAuth();
  const [state, setState] = useState({ status: enabled ? 'loading' : 'ready', saved: EVEN_DEFAULT });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getSplitDefault(groupId).then((res) => {
      if (cancelled) return;
      if (res.status === 401) return onExpired();
      if (!res.ok || !res.data?.method) return setState({ status: 'error', saved: EVEN_DEFAULT });
      setState({ status: 'ready', saved: { method: res.data.method, percents: res.data.percents ?? {} } });
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, enabled, attempt, onExpired]);

  const reload = useCallback(() => {
    setState({ status: 'loading', saved: EVEN_DEFAULT });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}

// Loads the accepted members of a group.
//   status   'loading' | 'ready' | 'denied' (not a member, or no such group) | 'error' (could not load)
//   members  [{ user_id, email, is_admin }]
//   setMembers  lets a page update the list after a change (a removal)
//   reload      tries the request again
export function useGroupMembers(groupId) {
  const { onExpired } = useAuth();
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
        setStatus('denied');
      } else {
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, attempt, onExpired]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, members, setMembers, reload };
}

// Turns the :groupId part of the address into a number, or null when it is not a whole number.
export function parseGroupId(raw) {
  return /^\d+$/.test(raw ?? '') ? Number(raw) : null;
}
