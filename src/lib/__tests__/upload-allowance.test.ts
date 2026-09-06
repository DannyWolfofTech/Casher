import { describe, expect, it } from "vitest";
import {
  fallbackLimitForTier,
  isPaidTier,
  resolveUploadAllowance,
} from "@/lib/upload-allowance";

describe("upload allowance", () => {
  it("recognises paid tiers", () => {
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("Premium")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier(undefined)).toBe(false);
  });

  it("uses an unlimited fallback limit for paid tiers", () => {
    expect(fallbackLimitForTier("pro")).toBe(Infinity);
    expect(fallbackLimitForTier("free")).toBe(1);
  });

  it("blocks a free user who already used their upload", () => {
    const a = resolveUploadAllowance({ uploads_used: 1, upload_limit: 1, tier: "free" });
    expect(a.canUpload).toBe(false);
    expect(a.uploadsUsed).toBe(1);
  });

  it("keeps the server allowance authoritative until the upgrade is confirmed", () => {
    const a = resolveUploadAllowance({ uploads_used: 1, upload_limit: 1, tier: "free" }, "pro");
    expect(a.canUpload).toBe(false);
  });

  it("reconciles with the server once it reports the paid tier", () => {
    const a = resolveUploadAllowance({ uploads_used: 4, upload_limit: null, tier: "pro" }, "pro");
    expect(a.tier).toBe("pro");
    expect(a.canUpload).toBe(true);
  });

  it("falls back safely when the server returns nothing", () => {
    expect(resolveUploadAllowance(null, "pro")).toEqual({ tier: "pro", uploadsUsed: 0, canUpload: false });
  });
});
