export class ImportUnconfirmedError extends Error {
  constructor() {
    super('We could not confirm the import result. Check your connection and retry the same file; completed imports will not be duplicated.');
    this.name = 'ImportUnconfirmedError';
  }
}

// Unlike a read timeout, this does not mean the write failed. The server may
// have committed it already, so keep the selected file and never retry here.
export async function importRequest<T>(submit: (signal: AbortSignal) => PromiseLike<T>, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new ImportUnconfirmedError()); controller.abort(); }, timeoutMs);
      }),
      Promise.resolve().then(() => submit(controller.signal)),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
