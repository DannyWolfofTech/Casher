/**
 * Server-side upload quota enforcement.
 *
 * The actual atomicity guarantee lives in the SQL function
 * `public.reserve_upload_slot`, which takes a row-level lock on the profile
 * before reading/incrementing the counter, and uses database time (now()) for
 * the calendar-month reset. This module is the transport/contract layer used
 * by the edge function and covered by tests.
 */

export interface ReservationRow {
  allowed: boolean;
  uploads_used: number;
  upload_limit: number | null; // null = unlimited
  tier: string;
  reason: string | null;
  period_start: string | null;
}

export interface QuotaClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

export interface ReservationResult {
  allowed: boolean;
  uploadsUsed: number;
  uploadLimit: number | null;
  tier: string;
  reason: string | null;
}

function firstRow(data: unknown): ReservationRow | null {
  if (Array.isArray(data)) return (data[0] as ReservationRow) ?? null;
  if (data && typeof data === "object") return data as ReservationRow;
  return null;
}

/** Reserve one upload slot. Throws on infrastructure errors. */
export async function reserveUploadSlot(
  client: QuotaClient,
  userId: string,
): Promise<ReservationResult> {
  const { data, error } = await client.rpc("reserve_upload_slot", { _user_id: userId });
  if (error) throw error;

  const row = firstRow(data);
  if (!row) throw new Error("reserve_upload_slot returned no row");

  return {
    allowed: !!row.allowed,
    uploadsUsed: Number(row.uploads_used ?? 0),
    uploadLimit: row.upload_limit === null || row.upload_limit === undefined
      ? null
      : Number(row.upload_limit),
    tier: String(row.tier ?? "free"),
    reason: row.reason ?? null,
  };
}

/**
 * Compensating action: give the slot back when the work after the reservation
 * failed. Never throws — a failed release must not mask the original error.
 */
export async function releaseUploadSlot(
  client: QuotaClient,
  userId: string,
): Promise<boolean> {
  try {
    const { error } = await client.rpc("release_upload_slot", { _user_id: userId });
    return !error;
  } catch {
    return false;
  }
}

export function quotaExceededMessage(result: ReservationResult): string {
  const limit = result.uploadLimit ?? 0;
  return `You've used your ${limit} free upload for this calendar month (${result.uploadsUsed}/${limit}). Upgrade to Pro or Premium for unlimited uploads, or wait until next month.`;
}
