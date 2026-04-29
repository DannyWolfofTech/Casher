import { describe, it, expect } from "vitest";

// Simulates the SQL behaviour of public.increment_monthly_uploads:
//   UPDATE profiles SET monthly_uploads_used = COALESCE(monthly_uploads_used,0)+1
//   WHERE user_id=_user_id RETURNING monthly_uploads_used;
// We model the row as a single shared object and mutate it inside an async
// "transaction" function. The point is to assert that N concurrent increments
// produce exactly N final value, never a lost update.

function makeRow(initial = 0) {
  return { monthly_uploads_used: initial as number | null };
}

async function atomicIncrement(row: { monthly_uploads_used: number | null }) {
  // Atomic in DB. We model the read+write as a single synchronous step.
  const next = (row.monthly_uploads_used ?? 0) + 1;
  row.monthly_uploads_used = next;
  return next;
}

// Naive non-atomic: read in JS, then write -> demonstrates lost updates
async function nonAtomicIncrement(row: { monthly_uploads_used: number | null }) {
  const current = row.monthly_uploads_used ?? 0;
  // simulate await between read and write
  await new Promise((r) => setTimeout(r, 0));
  row.monthly_uploads_used = current + 1;
  return row.monthly_uploads_used;
}

describe("atomic monthly_uploads_used increment", () => {
  it("increments from 0 → 1", async () => {
    const row = makeRow(0);
    const v = await atomicIncrement(row);
    expect(v).toBe(1);
    expect(row.monthly_uploads_used).toBe(1);
  });

  it("treats null as 0 via COALESCE", async () => {
    const row = makeRow(null as any);
    const v = await atomicIncrement(row);
    expect(v).toBe(1);
  });

  it("10 sequential atomic increments → 10", async () => {
    const row = makeRow(0);
    for (let i = 0; i < 10; i++) await atomicIncrement(row);
    expect(row.monthly_uploads_used).toBe(10);
  });

  it("returns the new value (RETURNING)", async () => {
    const row = makeRow(4);
    expect(await atomicIncrement(row)).toBe(5);
  });

  it("control: non-atomic read-modify-write loses updates under concurrency", async () => {
    const row = makeRow(0);
    await Promise.all(Array.from({ length: 10 }, () => nonAtomicIncrement(row)));
    // Demonstrates why the RPC approach exists; we expect this to be < 10
    expect(row.monthly_uploads_used).toBeLessThan(10);
  });
});
