// Tests for the hook that checks a receipt until it's read. The API is mocked and the clock is fake.

import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import * as receiptsApi from '../src/api/receipts.js';
import { useReceiptStatus, POLL_MS, SLOW_AFTER_SECONDS } from '../src/lib/useReceiptStatus.js';
import { ok, fail, network } from './helpers.jsx';

vi.mock('../src/api/receipts.js');

const uploaded = { id: 9, group_id: 1, status: 'uploaded', items: [] };
const read = {
  id: 9,
  group_id: 1,
  status: 'read',
  store: 'Corner Market',
  receipt_date: '2026-10-03',
  items: [{ name: 'Milk', quantity: 1, unit_price: '3.50', line_total: '3.50' }],
};

// Moves the fake clock forward and lets requests finish.
const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useReceiptStatus', () => {
  it('checks right away, keeps checking every couple of seconds, and stops once the receipt is read', async () => {
    receiptsApi.getReceipt
      .mockResolvedValueOnce(ok(uploaded))
      .mockResolvedValueOnce(ok(uploaded))
      .mockResolvedValue(ok(read));
    const { result } = renderHook(() => useReceiptStatus(9));

    await tick(0);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(1);
    expect(receiptsApi.getReceipt).toHaveBeenCalledWith(9);
    expect(result.current.state).toBe('waiting');

    await tick(POLL_MS);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('waiting');

    await tick(POLL_MS);
    expect(result.current.state).toBe('read');
    expect(result.current.receipt.store).toBe('Corner Market');

    await tick(POLL_MS * 5);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(3); // no more checks once it's read
  });

  it('stops with the failed state when the server could not read the receipt', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok({ ...uploaded, status: 'failed' }));
    const { result } = renderHook(() => useReceiptStatus(9));
    await tick(0);
    expect(result.current.state).toBe('failed');
    await tick(POLL_MS * 3);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(1);
  });

  it('does not change the screen after one failed check, and tries again', async () => {
    receiptsApi.getReceipt.mockResolvedValueOnce(network).mockResolvedValue(ok(read));
    const { result } = renderHook(() => useReceiptStatus(9));
    await tick(0);
    expect(result.current.state).toBe('waiting');
    expect(result.current.problem).toBe(false);
    await tick(POLL_MS);
    expect(result.current.state).toBe('read');
  });

  it('shows the connection notice after three failed checks in a row, and clears it when a check works', async () => {
    receiptsApi.getReceipt
      .mockResolvedValueOnce(network)
      .mockResolvedValueOnce(fail(500, { detail: 'Boom' }))
      .mockResolvedValueOnce(network)
      .mockResolvedValue(ok(uploaded));
    const { result } = renderHook(() => useReceiptStatus(9));
    await tick(0);
    await tick(POLL_MS);
    expect(result.current.problem).toBe(false);
    await tick(POLL_MS);
    expect(result.current.problem).toBe(true);
    expect(result.current.state).toBe('waiting');
    await tick(POLL_MS);
    expect(result.current.problem).toBe(false);
  });

  it('calls onMissing and stops when the receipt cannot be found', async () => {
    receiptsApi.getReceipt.mockResolvedValue(fail(404, { detail: 'Receipt not found.' }));
    const onMissing = vi.fn();
    renderHook(() => useReceiptStatus(9, undefined, onMissing));
    await tick(0);
    expect(onMissing).toHaveBeenCalledTimes(1);
    await tick(POLL_MS * 3);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(1);
  });

  it('does nothing while paused with a null receipt id', async () => {
    const { result } = renderHook(() => useReceiptStatus(null));
    await tick(POLL_MS * 3);
    expect(receiptsApi.getReceipt).not.toHaveBeenCalled();
    expect(result.current.elapsed).toBe(0);
  });

  it('calls onExpired and stops when the session has ended', async () => {
    receiptsApi.getReceipt.mockResolvedValue(fail(401, { detail: 'Not authenticated' }));
    const onExpired = vi.fn();
    renderHook(() => useReceiptStatus(9, onExpired));
    await tick(0);
    expect(onExpired).toHaveBeenCalledTimes(1);
    await tick(POLL_MS * 3);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(1);
  });

  it('counts the seconds and raises the slow flag after the limit', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok(uploaded));
    const { result } = renderHook(() => useReceiptStatus(9));
    await tick(5000);
    expect(result.current.elapsed).toBe(5);
    expect(result.current.slow).toBe(false);
    await tick((SLOW_AFTER_SECONDS - 5) * 1000);
    expect(result.current.slow).toBe(true);
  });

  it('stops checking when the screen is left', async () => {
    receiptsApi.getReceipt.mockResolvedValue(ok(uploaded));
    const { unmount } = renderHook(() => useReceiptStatus(9));
    await tick(0);
    unmount();
    await tick(POLL_MS * 5);
    expect(receiptsApi.getReceipt).toHaveBeenCalledTimes(1);
  });
});
