import { afterEach, expect, it, vi } from 'vitest';
import { readRequest, ReadTimeoutError, retryRead } from '../read-request';

afterEach(() => vi.useRealTimers());

it('releases a stalled read, cancels its transport, and does not retry the timeout', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const pending = readRequest(s => { signal = s; return new Promise(() => {}); });
  const result = expect(pending).rejects.toBeInstanceOf(ReadTimeoutError);
  await vi.advanceTimersByTimeAsync(15_000);
  await result;
  expect(signal?.aborted).toBe(true);
  expect(retryRead(0, new ReadTimeoutError())).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels when the page stops using the query and never starts an already cancelled read', async () => {
  const parent = new AbortController();
  const read = vi.fn(() => Promise.resolve('data'));
  parent.abort();
  await expect(readRequest(read, parent.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(read).not.toHaveBeenCalled();
  const active = new AbortController();
  let signal: AbortSignal | undefined;
  const pending = readRequest(s => { signal = s; return new Promise(() => {}); }, active.signal);
  await Promise.resolve();
  active.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(signal?.aborted).toBe(true);
});

it('preserves results and errors and clears deadlines on early completion', async () => {
  vi.useFakeTimers();
  await expect(readRequest(() => Promise.resolve(['a', 'b']))).resolves.toEqual(['a', 'b']);
  const failure = new Error('Read failed');
  await expect(readRequest(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(retryRead(0, failure)).toBe(true);
  expect(retryRead(1, failure)).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
