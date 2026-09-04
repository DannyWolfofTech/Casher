/**
 * The server usage response is the authority. A missing response must never
 * look like an available allowance; the account view provides a retry action.
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
    return { tier, uploadsUsed: 0, canUpload: false };
  }
  const tier = String(usage.tier || fallbackTier || "free");
  const uploadsUsed = Number(usage.uploads_used ?? 0);
  const limit =
    usage.upload_limit === null || usage.upload_limit === undefined
      ? Infinity
      : Number(usage.upload_limit);
  return { tier, uploadsUsed, canUpload: uploadsUsed >= 0 && uploadsUsed < limit };
}
