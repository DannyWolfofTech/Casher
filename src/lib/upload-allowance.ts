/**
 * Upload allowance resolution shared by the auth hook and its tests.
 *
 * The server (get_upload_usage) is the authority. When a tier change lands
 * before the usage RPC has been re-read, paid tiers are optimistically treated
 * as upload-capable so the UI is never stuck disabled after an upgrade; the
 * next RPC result reconciles it.
 */

export const PAID_TIERS = ["pro", "premium"] as const;

export interface UploadUsage {
  uploads_used: number;
  upload_limit: number | null;
  tier: string;
}

export interface UploadAllowance {
  tier: string;
  uploadsUsed: number;
  canUpload: boolean;
}

export function isPaidTier(tier: string | null | undefined): boolean {
  return (PAID_TIERS as readonly string[]).includes(String(tier ?? "").toLowerCase());
}

/** Limit for a tier when the server has not answered yet. */
export function fallbackLimitForTier(tier: string | null | undefined): number {
  return isPaidTier(tier) ? Infinity : 1;
}

/** Resolve allowance from a server usage row, optionally overriding the tier. */
export function resolveUploadAllowance(
  usage: UploadUsage | null | undefined,
  fallbackTier?: string | null,
): UploadAllowance {
  if (!usage) {
    const tier = String(fallbackTier ?? "free");
    return { tier, uploadsUsed: 0, canUpload: true };
  }
  const tier = String(usage.tier || fallbackTier || "free");
  const uploadsUsed = Number(usage.uploads_used ?? 0);
  const limit =
    usage.upload_limit === null || usage.upload_limit === undefined
      ? Infinity
      : Number(usage.upload_limit);
  // A paid tier reported by Stripe outranks a stale free-tier limit row.
  const effectiveLimit = isPaidTier(fallbackTier) && limit <= 1 ? Infinity : limit;
  return { tier, uploadsUsed, canUpload: uploadsUsed < effectiveLimit };
}
