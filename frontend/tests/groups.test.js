// groups.test.js — checks that groups.js sends exactly what the backend expects.
// `fetch` is replaced with a fake that records what it was asked to send, so no server is needed. Run with: npm test

import { vi } from 'vitest';
import {
  createGroup,
  inviteMember,
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  getMembers,
  removeMember,
  createEvent,
  reassignAdmin,
} from '../src/api/groups.js';

function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: body === undefined ? () => Promise.reject(new Error('no body')) : () => Promise.resolve(body),
  };
}

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => fetchMock.mock.calls[0];

describe('groups.js sends the routes the backend expects', () => {
  it('createGroup POSTs { name, group_type } to /api/groups', async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, { id: 5, name: 'Trip', group_type: 'outing', created_by: 1 }));
    const result = await createGroup({ name: '  Trip  ', groupType: 'outing' });
    const [url, options] = lastCall();
    expect(url).toBe('/api/groups');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(options.body)).toEqual({ name: 'Trip', group_type: 'outing' });
    expect(result).toEqual({ ok: true, status: 201, data: { id: 5, name: 'Trip', group_type: 'outing', created_by: 1 } });
  });

  it('inviteMember POSTs only the trimmed, lowercase email', async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, { status: 'pending' }));
    await inviteMember(5, '  Maya@Example.COM ');
    const [url, options] = lastCall();
    expect(url).toBe('/api/groups/5/invitations');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ email: 'maya@example.com' });
  });

  it('getPendingInvitations GETs /api/groups/invitations/pending', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, []));
    await getPendingInvitations();
    const [url, options] = lastCall();
    expect(url).toBe('/api/groups/invitations/pending');
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
  });

  it('acceptInvitation and declineInvitation POST with no body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { message: 'ok' }));
    await acceptInvitation(7);
    await declineInvitation(8);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/7/invitations/accept');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/groups/8/invitations/decline');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('getMembers GETs /api/groups/{id}/members', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, []));
    await getMembers(5);
    expect(lastCall()[0]).toBe('/api/groups/5/members');
  });

  it('removeMember DELETEs the member, and adds ?confirm=true only when confirmed', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { message: 'done' }));
    await removeMember(5, 12);
    await removeMember(5, 12, true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/5/members/12');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/groups/5/members/12?confirm=true');
  });

  it('createEvent POSTs exactly { name, group_id, member_ids } to /api/events', async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, { id: 1, group_id: 5, name: 'Dinner', member_ids: [12, 14] }));
    await createEvent({ name: ' Dinner ', groupId: 5, memberIds: [12, 14] });
    const [url, options] = lastCall();
    expect(url).toBe('/api/events');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: 'Dinner', group_id: 5, member_ids: [12, 14] });
  });

  it('reports a failed response with its status and body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(409, { detail: 'This user has already been invited or is a member.' }));
    const result = await inviteMember(5, 'a@b.co');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.data.detail).toMatch(/already been invited/);
  });

  it('reports network: true when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    expect(await getMembers(5)).toEqual({ ok: false, status: 0, network: true });
  });

  it('reassignAdmin is a placeholder that never calls the backend', async () => {
    const result = await reassignAdmin(5, 12);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
