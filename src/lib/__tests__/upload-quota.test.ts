import { describe, it, expect, vi } from "vitest";
import {
  quotaExceededMessage,
  releaseUploadSlot,
  reserveUploadSlot,
  type QuotaClient,
} from "../../../supabase/functions/_shared/quota";

/**
 * Simulates public.reserve_upload_slot: a single serialised counter guarded by
 * a row lock, so concurrent callers can never both consume the last slot.
 */
function makeFakeDb(opts: { tier?: string; used?: number; limit?: number | null } = {}) {
  const state = {
    tier: opts.tier ?? "free",
    used: opts.used ?? 0,
    limit: opts.limit === undefined ? 1 : opts.limit,
  };
  let lock: Promise<unknown> = Promise.resolve();
  const calls: string[] = [];

  // Serialise like a row lock does.
  const withLock = <T>(fn: () => T): Promise<T> => {
    const next = lock.then(() => new Promise<T>((r) => setTimeout(() => r(fn()), 1)));
    lock = next.catch(() => undefined);
    return next;
  };

  const client: QuotaClient = {
    rpc: async (fn, args) => {
      calls.push(fn);
      if (fn === "reserve_upload_slot") {
        return withLock(() => {
          const unlimited = state.limit === null;
          if (!unlimited && state.used >= (state.limit as number)) {
            return {
              data: [{
                allowed: false,
                uploads_used: state.used,
                upload_limit: state.limit,
                tier: state.tier,
                reason: "quota_exceeded",
                period_start: "2026-04-01",
              }],
              error: null,
            };
          }
          state.used += 1;
          return {
            data: [{
              allowed: true,
              uploads_used: state.used,
              upload_limit: state.limit,
              tier: state.tier,
              reason: null,
              period_start: "2026-04-01",
            }],
            error: null,
          };
        });
      }
      if (fn === "release_upload_slot") {
        return withLock(() => {
          state.used = Math.max(0, state.used - 1);
          return { data: null, error: null };
        });
      }
      throw new Error(`unexpected rpc ${fn} ${JSON.stringify(args)}`);
    },
  };

  return { client, state, calls };
}

describe("reserveUploadSlot", () => {
  it("allows the first upload for a free user and reports usage", async () => {
    const { client } = makeFakeDb();
    const r = await reserveUploadSlot(client, "u1");
    expect(r).toEqual({
      allowed: true,
      uploadsUsed: 1,
      uploadLimit: 1,
      tier: "free",
      reason: null,
    });
  });

  it("refuses the second upload for a free user", async () => {
    const { client } = makeFakeDb();
    await reserveUploadSlot(client, "u1");
    const second = await reserveUploadSlot(client, "u1");
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe("quota_exceeded");
    expect(second.uploadsUsed).toBe(1);
  });

  it("treats a null limit as unlimited for paid tiers", async () => {
    const { client, state } = makeFakeDb({ tier: "pro", limit: null });
    for (let i = 0; i < 5; i++) {
      const r = await reserveUploadSlot(client, "u1");
      expect(r.allowed).toBe(true);
      expect(r.uploadLimit).toBeNull();
    }
    expect(state.used).toBe(5);
  });

  it("is concurrency-safe: parallel calls cannot both take the last slot", async () => {
    const { client, state } = makeFakeDb({ limit: 1 });
    const results = await Promise.all([
      reserveUploadSlot(client, "u1"),
      reserveUploadSlot(client, "u1"),
      reserveUploadSlot(client, "u1"),
    ]);
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
    expect(state.used).toBe(1);
  });

  it("accepts a bare object row as well as an array", async () => {
    const client: QuotaClient = {
      rpc: async () => ({
        data: { allowed: true, uploads_used: 3, upload_limit: 10, tier: "pro", reason: null },
        error: null,
      }),
    };
    const r = await reserveUploadSlot(client, "u1");
    expect(r.uploadsUsed).toBe(3);
    expect(r.uploadLimit).toBe(10);
  });

  it("throws on an RPC error so the caller can fail closed", async () => {
    const client: QuotaClient = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    };
    await expect(reserveUploadSlot(client, "u1")).rejects.toBeTruthy();
  });

  it("throws when the RPC returns no row", async () => {
    const client: QuotaClient = { rpc: async () => ({ data: [], error: null }) };
    await expect(reserveUploadSlot(client, "u1")).rejects.toThrow(/no row/i);
  });
});

describe("releaseUploadSlot", () => {
  it("returns the slot so a failed import does not burn the quota", async () => {
    const { client, state } = makeFakeDb({ limit: 1 });
    await reserveUploadSlot(client, "u1");
    expect(state.used).toBe(1);

    await releaseUploadSlot(client, "u1");
    expect(state.used).toBe(0);

    const retry = await reserveUploadSlot(client, "u1");
    expect(retry.allowed).toBe(true);
  });

  it("never throws when the release itself fails", async () => {
    const rejecting: QuotaClient = {
      rpc: vi.fn().mockRejectedValue(new Error("network down")),
    };
    await expect(releaseUploadSlot(rejecting, "u1")).resolves.toBe(false);

    const erroring: QuotaClient = {
      rpc: async () => ({ data: null, error: { message: "nope" } }),
    };
    await expect(releaseUploadSlot(erroring, "u1")).resolves.toBe(false);
  });
});

describe("quotaExceededMessage", () => {
  it("names the limit and points at the upgrade path", () => {
    const msg = quotaExceededMessage({
      allowed: false,
      uploadsUsed: 1,
      uploadLimit: 1,
      tier: "free",
      reason: "quota_exceeded",
    });
    expect(msg).toMatch(/1\/1/);
    expect(msg).toMatch(/Pro or Premium/);
  });
});
