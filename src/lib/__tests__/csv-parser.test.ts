import { describe, it, expect } from "vitest";
// Imports the REAL shared module used by the process-csv edge function.
import {
  buildSubscriptions,
  dedupKey,
  findHeaderRow,
  IMPORT_VERSION,
  legacyDedupKey,
  parseAmount,
  parseTransactionsCsv,
  parseUkDate,
  resolveAmount,
  splitCsvRows,
  normalizeDescription,
} from "../../../supabase/functions/_shared/csv-parser";

type ParseFailureResult = Extract<ReturnType<typeof parseTransactionsCsv>, { ok: false }>;

/**
 * Narrow a parse result to its failure branch, throwing if it unexpectedly
 * succeeded. The cast is explicit because the preview typechecker does not
 * narrow the union through the `throw` above.
 */
function failure(result: ReturnType<typeof parseTransactionsCsv>): ParseFailureResult {
  if (result.ok) throw new Error("expected parse failure");
  return result as ParseFailureResult;
}


describe("splitCsvRows", () => {
  it("handles quoted fields, escaped quotes and CRLF", () => {
    const rows = splitCsvRows('a,b\r\n"x,1","he said ""hi"""\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x,1", 'he said "hi"'],
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(splitCsvRows("\uFEFFDate,Amount\n01/01/2024,5")[0][0]).toBe("Date");
  });

  it("drops fully blank lines", () => {
    expect(splitCsvRows("a,b\n\n\nc,d")).toHaveLength(2);
  });
});

describe("parseUkDate", () => {
  it("parses DD/MM/YYYY as UK order", () => {
    expect(parseUkDate("03/04/2024")).toBe("2024-04-03");
  });

  it("accepts - and . separators and 2-digit years", () => {
    expect(parseUkDate("03-04-24")).toBe("2024-04-03");
    expect(parseUkDate("03.04.1999")).toBe("1999-04-03");
    expect(parseUkDate("03/04/85")).toBe("1985-04-03");
  });

  it("passes ISO dates through", () => {
    expect(parseUkDate("2024-04-03")).toBe("2024-04-03");
  });

  it("truncates date-times without timezone shifting", () => {
    expect(parseUkDate("2024-04-03T23:45:00Z")).toBe("2024-04-03");
    expect(parseUkDate("03/04/2024 23:45")).toBe("2024-04-03");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseUkDate("31/02/2024")).toBeNull();
    expect(parseUkDate("32/01/2024")).toBeNull();
    expect(parseUkDate("01/13/2024")).toBeNull();
    expect(parseUkDate("not a date")).toBeNull();
    expect(parseUkDate("")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(parseUkDate("29/02/2024")).toBe("2024-02-29");
    expect(parseUkDate("29/02/2023")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("preserves the negative sign", () => {
    expect(parseAmount("-12.99")).toBe(-12.99);
    expect(parseAmount("£-12.99")).toBe(-12.99);
  });

  it("treats parentheses as negative", () => {
    expect(parseAmount("(1,234.56)")).toBeCloseTo(-1234.56, 2);
  });

  it("handles UK and European separators", () => {
    expect(parseAmount("1,234.56")).toBeCloseTo(1234.56, 2);
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56, 2);
    expect(parseAmount("1,50")).toBeCloseTo(1.5, 2);
    expect(parseAmount("1,500")).toBeCloseTo(1500, 2);
  });

  it("handles CR / DR suffixes", () => {
    expect(parseAmount("25.00 DR")).toBe(-25);
    expect(parseAmount("25.00 CR")).toBe(25);
  });

  it("returns NaN for unusable input", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("abc")).toBeNaN();
    expect(parseAmount(null)).toBeNaN();
  });
});

describe("findHeaderRow", () => {
  it("skips preamble rows before the real header", () => {
    const rows = splitCsvRows(
      "My Bank Ltd\nStatement for account 1234\n\nDate,Description,Amount\n01/01/2024,Tesco,-10.00",
    );
    const header = findHeaderRow(rows);
    expect(header).not.toBeNull();
    expect(header!.columns.date).toBe("Date");
    expect(header!.columns.amount).toBe("Amount");
  });

  it("detects separate debit/credit columns", () => {
    const rows = splitCsvRows("Date,Description,Paid out,Paid in\n01/01/2024,X,10.00,");
    const header = findHeaderRow(rows);
    expect(header!.columns.debit).toBe("Paid out");
    expect(header!.columns.credit).toBe("Paid in");
  });

  it("returns null when required columns are absent", () => {
    expect(findHeaderRow(splitCsvRows("Foo,Bar\n1,2"))).toBeNull();
  });
});

describe("resolveAmount", () => {
  it("makes debit columns negative and credit columns positive", () => {
    expect(resolveAmount("", "10.00", "", "")).toEqual({ amount: -10, direction: "debit" });
    expect(resolveAmount("", "", "10.00", "")).toEqual({ amount: 10, direction: "credit" });
  });

  it("uses a type column to disambiguate an unsigned amount", () => {
    expect(resolveAmount("10.00", "", "", "DR")).toEqual({ amount: -10, direction: "debit" });
    expect(resolveAmount("10.00", "", "", "Credit")).toEqual({ amount: 10, direction: "credit" });
  });

  it("falls back to the amount's own sign", () => {
    expect(resolveAmount("-10.00", "", "", "")).toEqual({ amount: -10, direction: "debit" });
    expect(resolveAmount("10.00", "", "", "")).toEqual({ amount: 10, direction: "credit" });
  });

  it("rejects zero and unreadable amounts", () => {
    expect(resolveAmount("0", "", "", "")).toBeNull();
    expect(resolveAmount("", "", "", "")).toBeNull();
  });
});

describe("parseTransactionsCsv", () => {
  const csv = [
    "Date,Description,Amount",
    "01/03/2024,NETFLIX.COM,-10.99",
    "02/03/2024,Salary ACME,2500.00",
    "03/03/2024,Tesco Stores,-42.10",
    "01/03/2024,NETFLIX.COM,-10.99",
    "bad-date,Broken row,-1.00",
    "05/03/2024,,-1.00",
  ].join("\n");

  const result = parseTransactionsCsv(csv);

  it("succeeds and keeps signed amounts", () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const netflix = result.transactions.find((t) => t.description === "NETFLIX.COM")!;
    expect(netflix.amount).toBe(-10.99);
    expect(netflix.direction).toBe("debit");
    const salary = result.transactions.find((t) => t.description === "Salary ACME")!;
    expect(salary.amount).toBe(2500);
    expect(salary.direction).toBe("credit");
  });

  it("preserves identical-looking purchases within the same file", () => {
    if (!result.ok) return;
    expect(result.duplicatesInFile).toBe(1);
    expect(result.transactions.filter((t) => t.description === "NETFLIX.COM")).toHaveLength(2);
  });

  it("reports skipped rows with reasons instead of failing", () => {
    if (!result.ok) return;
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped[0].reason).toMatch(/date/i);
    expect(result.skipped[1].reason).toMatch(/description/i);
  });

  it("never marks a credit as a subscription", () => {
    const credits = parseTransactionsCsv(
      "Date,Description,Amount\n01/03/2024,Netflix refund monthly,25.00",
    );
    expect(credits.ok).toBe(true);
    if (!credits.ok) return;
    expect(credits.transactions[0].direction).toBe("credit");
    expect(credits.transactions[0].isSubscription).toBe(false);
  });

  it("fails with MISSING_COLUMNS when headers are unrecognisable", () => {
    const r = parseTransactionsCsv("Foo,Bar\n1,2");
    expect(r.ok).toBe(false);
    expect(failure(r).code).toBe("MISSING_COLUMNS");
  });

  it("fails with EMPTY_FILE for blank input", () => {
    const r = parseTransactionsCsv("   ");
    expect(r.ok).toBe(false);
    expect(failure(r).code).toBe("EMPTY_FILE");
  });

  it("fails with NO_VALID_ROWS when every row is unusable", () => {
    const r = parseTransactionsCsv("Date,Description,Amount\nzz,,\nyy,,");
    expect(r.ok).toBe(false);
    expect(failure(r).code).toBe("NO_VALID_ROWS");
  });

  it("fails with TOO_MANY_ROWS past the limit", () => {
    const many = ["Date,Description,Amount"]
      .concat(Array.from({ length: 5 }, (_, i) => `0${i + 1}/03/2024,Row ${i},-1.00`))
      .join("\n");
    const r = parseTransactionsCsv(many, { maxRows: 3 });
    expect(r.ok).toBe(false);
    expect(failure(r).code).toBe("TOO_MANY_ROWS");
  });
});

describe("dedupe keys", () => {
  it("sign-preserving key separates a debit from a credit", () => {
    expect(dedupKey("2024-03-01", "Netflix", -10.99))
      .not.toBe(dedupKey("2024-03-01", "Netflix", 10.99));
  });

  it("legacy key collapses sign, matching pre-v2 stored rows", () => {
    expect(legacyDedupKey("2024-03-01", "Netflix", -10.99))
      .toBe(legacyDedupKey("2024-03-01", "Netflix", 10.99));
  });

  it("normalises description whitespace and case", () => {
    expect(normalizeDescription("  NETFLIX   COM ")).toBe("netflix com");
    expect(dedupKey("2024-03-01", "  NETFLIX  COM ", -1))
      .toBe(dedupKey("2024-03-01", "netflix com", -1));
  });
});

describe("buildSubscriptions", () => {
  it("only derives subscriptions from debits and dedupes by merchant", () => {
    const parsed = parseTransactionsCsv(
      [
        "Date,Description,Amount",
        "01/03/2024,Netflix subscription,-10.99",
        "01/04/2024,Netflix subscription,-10.99",
        "02/03/2024,Gym refund membership,45.00",
      ].join("\n"),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const subs = buildSubscriptions(parsed.transactions);
    expect(subs.size).toBe(1);
    const [sub] = [...subs.values()];
    expect(sub.amount).toBe(10.99);
    expect(sub.estimated_annual_cost).toBeCloseTo(10.99 * 12, 2);
  });

  it("uses annual pricing when the description says so", () => {
    const parsed = parseTransactionsCsv(
      "Date,Description,Amount\n01/03/2024,Acme annual membership,-120.00",
    );
    if (!parsed.ok) throw new Error("expected parse success");
    const [sub] = [...buildSubscriptions(parsed.transactions).values()];
    expect(sub.frequency).toBe("annual");
    expect(sub.estimated_annual_cost).toBe(120);
  });
});

describe("import version", () => {
  it("is 2 — the signed cash-flow format", () => {
    expect(IMPORT_VERSION).toBe(2);
  });
});
