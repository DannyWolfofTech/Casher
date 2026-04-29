import { describe, it, expect } from "vitest";

// Re-implementations mirroring supabase/functions/process-csv/index.ts
// Keep these in sync with that file.
function parseUkDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = iso[1], m = iso[2].padStart(2, "0"), d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const uk = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (uk) {
    let [, d, m, y] = uk;
    if (y.length === 2) y = (parseInt(y, 10) >= 70 ? "19" : "20") + y;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    const dn = parseInt(dd, 10), mn = parseInt(mm, 10);
    if (dn < 1 || dn > 31 || mn < 1 || mn > 12) return null;
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

function parseAmount(input: string): number {
  if (!input) return NaN;
  let s = String(input).trim();
  s = s.replace(/[£$€\s]/g, "");
  const negParen = /^\((.*)\)$/.exec(s);
  if (negParen) s = "-" + negParen[1];
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0] + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  }
  s = s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function normalizeDescription(d: string): string {
  return (d || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const dedupKey = (date: string, desc: string, amt: number | string) =>
  `${date}|${normalizeDescription(String(desc))}|${Math.abs(Number(amt)).toFixed(2)}`;

describe("parseUkDate", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseUkDate("15/03/2024")).toBe("2024-03-15");
  });
  it("parses single-digit DD/M/YYYY", () => {
    expect(parseUkDate("5/3/2024")).toBe("2024-03-05");
  });
  it("parses DD-MM-YYYY", () => {
    expect(parseUkDate("15-03-2024")).toBe("2024-03-15");
  });
  it("passes through ISO YYYY-MM-DD", () => {
    expect(parseUkDate("2024-03-15")).toBe("2024-03-15");
  });
  it("treats 13/01/2024 as Jan 13 (UK), NOT US Mar 13", () => {
    expect(parseUkDate("13/01/2024")).toBe("2024-01-13");
  });
  it("rejects month > 12", () => {
    expect(parseUkDate("15/13/2024")).toBeNull();
  });
  it("rejects garbage", () => {
    expect(parseUkDate("not a date")).toBeNull();
    expect(parseUkDate("")).toBeNull();
  });
  it("expands 2-digit year, 70+ → 19xx else 20xx", () => {
    expect(parseUkDate("01/01/85")).toBe("1985-01-01");
    expect(parseUkDate("01/01/24")).toBe("2024-01-01");
  });
});

describe("parseAmount", () => {
  it("parses plain number", () => {
    expect(parseAmount("12.34")).toBeCloseTo(12.34);
  });
  it("strips £ symbol", () => {
    expect(parseAmount("£1,234.56")).toBeCloseTo(1234.56);
  });
  it("handles European 1.234,56 → 1234.56", () => {
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56);
  });
  it("handles single comma decimal 12,50", () => {
    expect(parseAmount("12,50")).toBeCloseTo(12.5);
  });
  it("handles thousands-only commas 1,234,567", () => {
    expect(parseAmount("1,234,567")).toBe(1234567);
  });
  it("treats parentheses as negative", () => {
    expect(parseAmount("(45.00)")).toBe(-45);
  });
  it("returns NaN for empty", () => {
    expect(Number.isNaN(parseAmount(""))).toBe(true);
  });
  it("strips $ and €", () => {
    expect(parseAmount("$10.00")).toBe(10);
    expect(parseAmount("€7,50")).toBeCloseTo(7.5);
  });
});

describe("CSV dedup normalization", () => {
  it("identical rows produce identical keys", () => {
    expect(dedupKey("2024-03-15", "Netflix.com", 9.99)).toBe(
      dedupKey("2024-03-15", "Netflix.com", 9.99)
    );
  });
  it("case + whitespace insensitive on description", () => {
    expect(dedupKey("2024-03-15", "  NETFLIX.COM  ", 9.99)).toBe(
      dedupKey("2024-03-15", "netflix.com", 9.99)
    );
  });
  it("collapses internal whitespace", () => {
    expect(dedupKey("2024-03-15", "Tesco   Store  1234", 12)).toBe(
      dedupKey("2024-03-15", "tesco store 1234", 12)
    );
  });
  it("absolute value: -9.99 == 9.99", () => {
    expect(dedupKey("2024-03-15", "x", -9.99)).toBe(dedupKey("2024-03-15", "x", 9.99));
  });
  it("rounds to 2dp so 9.990001 == 9.99", () => {
    expect(dedupKey("2024-03-15", "x", 9.990001)).toBe(dedupKey("2024-03-15", "x", 9.99));
  });
  it("different amounts → different keys", () => {
    expect(dedupKey("2024-03-15", "x", 9.99)).not.toBe(dedupKey("2024-03-15", "x", 10.99));
  });
});

describe("Subscription price-update logic", () => {
  const shouldUpdate = (existing: number, incoming: number) =>
    Math.abs(Number(existing) - Number(incoming)) > 0.005;

  it("updates when price increases", () => {
    expect(shouldUpdate(9.99, 12.99)).toBe(true);
  });
  it("updates when price drops", () => {
    expect(shouldUpdate(14.99, 9.99)).toBe(true);
  });
  it("ignores rounding noise <= 0.005", () => {
    expect(shouldUpdate(9.99, 9.991)).toBe(false);
    expect(shouldUpdate(9.99, 9.99)).toBe(false);
  });
  it("updates even on small but real change > 0.005", () => {
    expect(shouldUpdate(9.99, 9.9999)).toBe(true);
  });
});
