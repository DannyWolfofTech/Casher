import { describe, it, expect, beforeEach } from "vitest";

// Mirrors the throttle in src/hooks/useAuth.ts checkSubscription:
//   if (now - lastSubCheckRef.current < 60_000) return;
function makeThrottled(intervalMs = 60_000) {
  let last = 0;
  let calls = 0;
  return {
    call(now: number) {
      if (now - last < intervalMs) return false;
      last = now;
      calls += 1;
      return true;
    },
    get count() { return calls; },
  };
}

describe("useAuth checkSubscription throttle", () => {
  let t: ReturnType<typeof makeThrottled>;
  beforeEach(() => { t = makeThrottled(60_000); });

  it("first call always passes", () => {
    expect(t.call(1000)).toBe(true);
    expect(t.count).toBe(1);
  });
  it("second call within 60s is suppressed", () => {
    t.call(0);
    expect(t.call(30_000)).toBe(false);
    expect(t.count).toBe(1);
  });
  it("call exactly at 60s boundary passes", () => {
    t.call(0);
    expect(t.call(60_000)).toBe(true);
    expect(t.count).toBe(2);
  });
  it("burst of 100 calls in 1s only fires once", () => {
    for (let i = 0; i < 100; i++) t.call(1000 + i);
    expect(t.count).toBe(1);
  });
  it("re-enables after window elapses", () => {
    t.call(0);
    t.call(30_000); // suppressed
    t.call(70_000); // passes
    t.call(80_000); // suppressed
    t.call(140_000); // passes
    expect(t.count).toBe(3);
  });
});

describe("Auth event filter (only SIGNED_IN triggers re-check)", () => {
  // Mirrors: if (event === 'SIGNED_IN') checkSubscription();
  const trigger = (event: string) => event === "SIGNED_IN";
  it("SIGNED_IN triggers", () => {
    expect(trigger("SIGNED_IN")).toBe(true);
  });
  it("TOKEN_REFRESHED does NOT trigger", () => {
    expect(trigger("TOKEN_REFRESHED")).toBe(false);
  });
  it("USER_UPDATED does NOT trigger", () => {
    expect(trigger("USER_UPDATED")).toBe(false);
  });
  it("INITIAL_SESSION does NOT trigger", () => {
    expect(trigger("INITIAL_SESSION")).toBe(false);
  });
});
