import { describe, it, expect } from "vitest";

// Mirrors the catch-block message resolution used in src/pages/Auth.tsx
function resolveAuthErrorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Network error. Please check your connection and try again.";
}

describe("Auth.tsx network error handling", () => {
  it("uses Error.message when an Error is thrown", () => {
    const err = new TypeError("Failed to fetch");
    expect(resolveAuthErrorMessage(err)).toBe("Failed to fetch");
  });
  it("falls back to friendly network message for non-Error throws", () => {
    expect(resolveAuthErrorMessage("boom")).toMatch(/network error/i);
    expect(resolveAuthErrorMessage(undefined)).toMatch(/network error/i);
    expect(resolveAuthErrorMessage(null)).toMatch(/network error/i);
    expect(resolveAuthErrorMessage({ random: 1 })).toMatch(/network error/i);
  });

  // Smoke-check that supabase auth call rejection is caught (simulate)
  it("a rejected promise is captured by try/catch", async () => {
    const fakeAuthCall = () => Promise.reject(new TypeError("Failed to fetch"));
    let caught: string | null = null;
    try {
      await fakeAuthCall();
    } catch (e) {
      caught = resolveAuthErrorMessage(e);
    }
    expect(caught).toBe("Failed to fetch");
  });
});
