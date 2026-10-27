// expensesApi.test.js — checks that expenses.js sends exactly what the backend expects.
// `fetch` is replaced with a fake that records what it was asked to send, so no server is needed. Run with: npm test

import { vi } from 'vitest';
import { createExpense, getGroupExpenses, getBalances } from '../src/api/expenses.js';

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

describe('expenses.js sends the routes the backend expects', () => {
  it('createExpense POSTs the expense to /api/expenses (even split sends no split_values)', async () => {
    const saved = { id: 3, group_id: 4, description: 'Groceries', amount: '10.00', shares: { 1: '3.34', 2: '3.33', 3: '3.33' } };
    fetchMock.mockResolvedValue(fakeResponse(201, saved));
    const result = await createExpense({
      groupId: 4,
      description: '  Groceries  ',
      amount: '10.00',
      paidBy: 1,
      participantIds: [1, 2, 3],
      splitMethod: 'even',
    });
    const [url, options] = lastCall();
    expect(url).toBe('/api/expenses');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(options.body)).toEqual({
      group_id: 4,
      description: 'Groceries',
      amount: '10.00',
      paid_by: 1,
      participant_ids: [1, 2, 3],
      split_method: 'even',
    });
    expect(result).toEqual({ ok: true, status: 201, data: saved });
  });

  it('createExpense sends split_values for a custom split', async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, {}));
    await createExpense({
      groupId: 4,
      description: 'Rent',
      amount: '100.00',
      paidBy: 2,
      participantIds: [1, 2],
      splitMethod: 'custom',
      splitValues: { 1: '60.00', 2: '40.00' },
    });
    const body = JSON.parse(lastCall()[1].body);
    expect(body.split_method).toBe('custom');
    expect(body.split_values).toEqual({ 1: '60.00', 2: '40.00' });
    expect(body.paid_by).toBe(2);
  });

  it('createExpense passes the backend sentence through on a 422', async () => {
    fetchMock.mockResolvedValue(fakeResponse(422, { detail: 'Custom amounts must equal the expense total.' }));
    const result = await createExpense({
      groupId: 4,
      description: 'Rent',
      amount: '100.00',
      paidBy: 1,
      participantIds: [1, 2],
      splitMethod: 'custom',
      splitValues: { 1: '60.00', 2: '30.00' },
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
    expect(result.data.detail).toBe('Custom amounts must equal the expense total.');
  });

  it('getGroupExpenses GETs /api/groups/{id}/expenses with no body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, []));
    const result = await getGroupExpenses(4);
    const [url, options] = lastCall();
    expect(url).toBe('/api/groups/4/expenses');
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('getBalances GETs /api/balances with no body', async () => {
    const data = { group_balances: [], overall_balances: [], total_net: '0.00' };
    fetchMock.mockResolvedValue(fakeResponse(200, data));
    const result = await getBalances();
    const [url, options] = lastCall();
    expect(url).toBe('/api/balances');
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
    expect(result.data).toEqual(data);
  });

  it('reports a network failure instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await getBalances();
    expect(result).toEqual({ ok: false, status: 0, network: true });
  });
});
