import { describe, expect, it } from "vitest";
import {
  applyCancellation,
  CANCELED_CATEGORY,
  findLinkedSubscription,
  nextTransactionCategory,
  normalizeName,
  summarizeSubscriptions,
  syncLinkedSubscriptionStatus,
  type LinkableSubscription,
} from "@/lib/subscription-link";

const subs: LinkableSubscription[] = [
  { id: "s1", service_name: "Netflix", amount: 10.99, status: "active", estimated_annual_cost: 131.88 },
  { id: "s2", service_name: "Spotify", amount: 9.99, status: "active", estimated_annual_cost: 119.88 },
  { id: "s3", service_name: "PureGym", amount: 24.99, status: "canceled", estimated_annual_cost: 299.88 },
];

describe("findLinkedSubscription", () => {
  it("matches on amount plus service name inside the description", () => {
    const match = findLinkedSubscription(
      { description: "NETFLIX.COM  LONDON", amount: -10.99 },
      subs,
    );
    expect(match?.id).toBe("s1");
  });

  it("ignores sign differences on the amount", () => {
    expect(findLinkedSubscription({ description: "Spotify UK", amount: 9.99 }, subs)?.id).toBe("s2");
  });

  it("returns null when the amount does not match", () => {
    expect(findLinkedSubscription({ description: "NETFLIX.COM", amount: -15.99 }, subs)).toBeNull();
  });

  it("returns null when the name does not match", () => {
    expect(findLinkedSubscription({ description: "Tesco Stores", amount: -10.99 }, subs)).toBeNull();
  });

  it("returns null when the match is ambiguous", () => {
    const ambiguous: LinkableSubscription[] = [
      { id: "a", service_name: "Prime", amount: 8.99 },
      { id: "b", service_name: "Prime", amount: 8.99 },
    ];
    expect(findLinkedSubscription({ description: "AMZN Prime", amount: 8.99 }, ambiguous)).toBeNull();
  });

  it("can match through the merchant field", () => {
    expect(
      findLinkedSubscription(
        { description: "DD 0293841", amount: 24.99, merchant: "PureGym Ltd" },
        subs,
      )?.id,
    ).toBe("s3");
  });

  it("normalises punctuation and casing", () => {
    expect(normalizeName("NETFLIX.COM*  LONDON")).toBe("netflix com london");
  });
});

describe("summarizeSubscriptions", () => {
  it("counts only active rows and sums their annual cost", () => {
    expect(summarizeSubscriptions(subs)).toEqual({
      subscriptionCount: 2,
      potentialSavings: 251.76,
    });
  });

  it("treats a missing status as active", () => {
    expect(summarizeSubscriptions([{ id: "x", service_name: "A", amount: 1 }]).subscriptionCount).toBe(1);
  });
});

describe("cancel toggle state mapping", () => {
  it("drops the subscription out of the active summary after cancelling", () => {
    const after = applyCancellation(subs, "s1", true);
    const summary = summarizeSubscriptions(after);
    expect(summary.subscriptionCount).toBe(1);
    expect(summary.potentialSavings).toBeCloseTo(119.88, 2);
  });

  it("restores it when uncancelled", () => {
    const restored = applyCancellation(applyCancellation(subs, "s1", true), "s1", false);
    expect(summarizeSubscriptions(restored).subscriptionCount).toBe(2);
  });

  it("leaves other rows untouched", () => {
    const after = applyCancellation(subs, "s1", true);
    expect(after.find((s) => s.id === "s2")?.status).toBe("active");
  });

  it("maps the transaction category for both directions", () => {
    expect(nextTransactionCategory(true)).toBe(CANCELED_CATEGORY);
    expect(nextTransactionCategory(false)).toBe("Subscription");
  });
});

describe("syncLinkedSubscriptionStatus", () => {
  const tx = { description: "NETFLIX.COM LONDON", amount: -10.99 };

  it("updates exactly the linked subscription", async () => {
    const calls: Array<[string, string]> = [];
    const result = await syncLinkedSubscriptionStatus(tx, true, {
      listSubscriptions: async () => subs,
      updateSubscriptionStatus: async (id, status) => {
        calls.push([id, status]);
      },
    });
    expect(result).toEqual({ linked: true, subscriptionId: "s1" });
    expect(calls).toEqual([["s1", "canceled"]]);
  });

  it("writes nothing when there is no unambiguous link", async () => {
    let wrote = false;
    const result = await syncLinkedSubscriptionStatus(
      { description: "Tesco Stores", amount: -42 },
      true,
      {
        listSubscriptions: async () => subs,
        updateSubscriptionStatus: async () => {
          wrote = true;
        },
      },
    );
    expect(result).toEqual({ linked: false });
    expect(wrote).toBe(false);
  });

  it("propagates a select error instead of reporting success", async () => {
    await expect(
      syncLinkedSubscriptionStatus(tx, true, {
        listSubscriptions: async () => {
          throw new Error("select failed");
        },
        updateSubscriptionStatus: async () => {},
      }),
    ).rejects.toThrow("select failed");
  });

  it("propagates an update error instead of reporting success", async () => {
    await expect(
      syncLinkedSubscriptionStatus(tx, false, {
        listSubscriptions: async () => subs,
        updateSubscriptionStatus: async () => {
          throw new Error("update failed");
        },
      }),
    ).rejects.toThrow("update failed");
  });

  it("uncancels with the active status", async () => {
    const calls: Array<[string, string]> = [];
    await syncLinkedSubscriptionStatus({ description: "Spotify", amount: 9.99 }, false, {
      listSubscriptions: async () => subs,
      updateSubscriptionStatus: async (id, status) => {
        calls.push([id, status]);
      },
    });
    expect(calls).toEqual([["s2", "active"]]);
  });
});
