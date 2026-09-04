import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { planCtaState, PREMIUM_PURCHASABLE } from "../pricing-cta";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Premium is coming soon and not purchasable", () => {
  it("never offers checkout on Premium", () => {
    expect(PREMIUM_PURCHASABLE).toBe(false);
    for (const [auth, tier] of [
      [false, null],
      [true, "free"],
      [true, "pro"],
    ] as const) {
      const cta = planCtaState("premium", auth, tier);
      expect(cta.action).toBe("none");
      expect(cta.disabled).toBe(true);
      expect(cta.labelKey).toBe("comingSoonShort");
    }
  });

  it("still shows Current plan to an existing Premium subscriber", () => {
    expect(planCtaState("premium", true, "premium").labelKey).toBe("currentPlan");
  });

  it("keeps Pro fully purchasable", () => {
    expect(planCtaState("pro", true, "free")).toEqual({
      labelKey: "upgradeNow",
      disabled: false,
      action: "checkout",
    });
  });
});

describe("launch copy accuracy", () => {
  it("does not describe the £9.99 plan as a free trial in any language", () => {
    const copy = read("src/contexts/LanguageContext.tsx");
    expect(copy).not.toMatch(/9[.,]99 free trial|prueba gratuita de £9|essai gratuit de 9,99|încercare gratuită de £9|kostenlosen Testversion|prova gratuita di £9|okresu próbnego za £9/);
  });

  it("uses a dynamic copyright year on the About page", () => {
    const about = read("src/pages/About.tsx");
    expect(about).toContain("new Date().getFullYear()");
    expect(about).not.toContain("&copy; 2025");
  });

  it("does not claim analytics cookies while no analytics is loaded", () => {
    const privacy = read("src/pages/Privacy.tsx");
    expect(privacy).not.toMatch(/analytics\s*\n?\s*cookies to improve/);
    expect(privacy).toContain("privacy@trycasher.com");
    expect(privacy).toMatch(/Last updated:<\/strong> \d{1,2} \w+ \d{4}/);
    const sources = ["src/main.tsx", "index.html"].map(read).join("\n");
    expect(sources).not.toMatch(/gtag|googletagmanager|plausible|posthog|mixpanel/i);
  });

  it("does not offer a fake bank-connect waitlist action", () => {
    const dashboard = read("src/pages/Dashboard.tsx");
    expect(dashboard).not.toContain('t("joinWaitlist")');
    expect(dashboard).toContain('t("bankConnectInDevelopment")');
  });

  it("renders a branded 404 with a working link home", () => {
    const notFound = read("src/pages/NotFound.tsx");
    expect(notFound).toContain('<Link to="/"');
    expect(notFound).toContain('alt="Casher"');
    expect(notFound).not.toContain("console.error");
  });

  it("keeps production checkout free of console logging", () => {
    const pricing = read("src/pages/Pricing.tsx");
    expect(pricing).not.toMatch(/console\.(log|error)/);
  });
});
