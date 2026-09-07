export interface DeletionBilling {
  verifyCustomer(userId: string, customerId: string): Promise<void>;
  expireCheckouts(customerId: string): Promise<void>;
  cancelSubscriptions(customerId: string): Promise<void>;
}
export interface DeletionStore {
  acquire(userId: string): Promise<{ code: string; lease?: string }>;
  customer(userId: string): Promise<string | null>;
  complete(userId: string, lease: string, customerId: string | null): Promise<void>;
  release(userId: string, lease: string): Promise<void>;
}
export class DeletionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export function verifyDeletionRequest(body: unknown, lastSignIn: string | undefined, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || (body as Record<string,unknown>).confirmation !== 'DELETE') {
    throw new DeletionError('Type DELETE to confirm account deletion.', 400);
  }
  const signedIn = Date.parse(lastSignIn || '');
  if (!Number.isFinite(signedIn) || signedIn > now + 30_000 || now - signedIn > 10 * 60_000) {
    throw new DeletionError('Sign in again, then return to Account to confirm deletion within 10 minutes.', 401);
  }
}
// Provider failures preserve the account and durable closing flag. Retrying continues
// the same operation; there is no path that deletes data while renewal can continue.
export async function deleteAccount(userId: string, store: DeletionStore, billing: DeletionBilling) {
  const lock = await store.acquire(userId);
  if (lock.code !== 'OK' || !lock.lease) throw new DeletionError(lock.code === 'RATE_LIMIT' ? 'Too many attempts. Try again in 10 minutes.' : 'Another account change is in progress. Try again shortly.', lock.code === 'RATE_LIMIT' ? 429 : 409);
  try {
    // Read after acquiring the lease: a checkout may have just created a customer.
    const customerId = await store.customer(userId);
    if (customerId) {
      await billing.verifyCustomer(userId, customerId);
      await billing.expireCheckouts(customerId);
      await billing.cancelSubscriptions(customerId);
    }
    await store.complete(userId, lock.lease, customerId);
  } finally { await store.release(userId, lock.lease); }
}
