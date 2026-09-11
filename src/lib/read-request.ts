export class ReadTimeoutError extends Error {
  constructor() { super('The request took too long. Check your connection and try again.'); this.name = 'ReadTimeoutError'; }
}

// Bound reads even when a transport ignores cancellation. This is deliberately
// not used for writes: timing out a write does not establish whether it committed.
export async function readRequest<T>(read: (signal: AbortSignal) => PromiseLike<T>, parent?: AbortSignal, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        const stop = (reason: unknown) => { reject(reason); controller.abort(reason); };
        onAbort = () => stop(parent?.reason ?? new DOMException('Aborted', 'AbortError'));
        if (parent?.aborted) { onAbort(); return; }
        parent?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => stop(new ReadTimeoutError()), timeoutMs);
      }),
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return read(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) parent?.removeEventListener('abort', onAbort);
  }
}

export const retryRead = (failureCount: number, error: unknown) => failureCount < 1 && !(error instanceof ReadTimeoutError);
