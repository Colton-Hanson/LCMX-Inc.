// api.test.js — checks that auth.js sends exactly what Lukas's backend expects.
// `fetch` (the browser's network call) is replaced with a fake that records what it was asked to send,
// so no server is needed. Run with: npm test

import { vi } from 'vitest';
import { registerUser, loginUser, getCurrentUser, logoutUser } from '../src/api/auth.js';

// Builds a fake fetch response like the real one: has .ok, .status and a .json() method.
function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: body === undefined ? () => Promise.reject(new Error('no body')) : () => Promise.resolve(body),
  };
}

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(); // a fake fetch that remembers its calls
  vi.stubGlobal('fetch', fetchMock); // swap it in for the real one during the test
});
afterEach(() => vi.unstubAllGlobals()); // put the real fetch back

describe('auth.js talks to the real backend routes', () => {
  it('registerUser POSTs { email, password } to /api/auth/register and nothing else', async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, { id: 1, email: 'cole@umkc.edu' }));
    const result = await registerUser({ email: 'cole@umkc.edu', password: 'Abcdefg!', confirm: 'Abcdefg!' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/register'); // the proxy turns this into /auth/register on the backend
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include'); // keeps the session cookie
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ email: 'cole@umkc.edu', password: 'Abcdefg!' }); // no "confirm" field sent
    expect(result).toEqual({ ok: true, status: 201, data: { id: 1, email: 'cole@umkc.edu' } });
  });

  it('trims and lowercases emails so one person cannot get two accounts', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, {}));
    await loginUser({ email: '  Cole@UMKC.edu ', password: 'Abcdefg!' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toBe('cole@umkc.edu');
    await registerUser({ email: 'COLE@umkc.EDU', password: 'Abcdefg!' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).email).toBe('cole@umkc.edu');
  });

  it('loginUser POSTs to /api/auth/login', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { message: 'Login successful' }));
    await loginUser({ email: 'cole@umkc.edu', password: 'Abcdefg!' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('getCurrentUser GETs /api/auth/me with the cookie and no body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { id: 1, email: 'cole@umkc.edu' }));
    await getCurrentUser();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
    expect(options.body).toBeUndefined();
  });

  it('logoutUser POSTs to /api/auth/logout', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { message: 'Logout successful' }));
    await logoutUser();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('reports HTTP errors with their status instead of throwing', async () => {
    fetchMock.mockResolvedValue(fakeResponse(401, { detail: 'Invalid email or password.' }));
    const result = await loginUser({ email: 'a@b.co', password: 'x' });
    expect(result).toEqual({ ok: false, status: 401, data: { detail: 'Invalid email or password.' } });
  });

  it('survives a response with no JSON body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(500, undefined)); // .json() rejects
    const result = await loginUser({ email: 'a@b.co', password: 'x' });
    expect(result).toEqual({ ok: false, status: 500, data: null });
  });

  it('flags network failures (server not running) separately', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await loginUser({ email: 'a@b.co', password: 'x' });
    expect(result).toEqual({ ok: false, status: 0, network: true });
  });
});
