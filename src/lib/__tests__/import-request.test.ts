import { afterEach, describe, expect, it, vi } from 'vitest';
import { importRequest, ImportUnconfirmedError } from '../import-request';

afterEach(() => vi.useRealTimers());
describe('uncertain import responses', () => {
  it('ends a stalled request even if the transport ignores abort, without resubmitting', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    const submit = vi.fn((next: AbortSignal) => { signal = next; return new Promise(() => {}); });
    const outcome = expect(importRequest(submit)).rejects.toBeInstanceOf(ImportUnconfirmedError);
    await vi.advanceTimersByTimeAsync(60_001);
    await outcome;
    expect(signal!.aborted).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('returns the committed result and removes the deadline', async () => {
    vi.useFakeTimers();
    expect(await importRequest(() => Promise.resolve({ code: 'OK' }))).toEqual({ code: 'OK' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not retry transport errors or leave a running deadline', async () => {
    vi.useFakeTimers();
    const submit = vi.fn(() => Promise.reject(new Error('offline')));
    await expect(importRequest(submit)).rejects.toThrow('offline');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
