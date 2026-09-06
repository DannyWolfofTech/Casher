import { describe, expect, it } from "vitest";
import {
  buildTransactionsCsv,
  escapeCsvCell,
  exportFileName,
  isFormulaLike,
  toCsvRow,
} from "@/lib/csv-export";

describe("escapeCsvCell", () => {
  it("quotes plain values", () => {
    expect(escapeCsvCell("Netflix")).toBe('"Netflix"');
  });

  it("escapes embedded quotes", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("keeps commas and newlines inside the quoted cell", () => {
    expect(escapeCsvCell("a,b\nc")).toBe('"a,b\nc"');
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralises leading %j so spreadsheets do not execute it",
    (char) => {
      const raw = `${char}cmd|' /C calc'!A0`;
      expect(isFormulaLike(raw)).toBe(true);
      expect(escapeCsvCell(raw)).toBe(`"'${raw.replace(/"/g, '""')}"`);
    },
  );

  it("does not prefix safe values", () => {
    expect(isFormulaLike("Spotify UK")).toBe(false);
    expect(escapeCsvCell("Spotify UK")).toBe('"Spotify UK"');
  });

  it("handles null/undefined", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it("neutralises a negative amount rendered as text", () => {
    expect(escapeCsvCell("-12.99")).toBe(`"'-12.99"`);
  });
});

describe("toCsvRow", () => {
  it("labels direction and defaults the category", () => {
    expect(
      toCsvRow({ date: "2026-01-02", description: "Netflix", amount: 12.99, category: null }),
    ).toBe(`"2026-01-02","Netflix","'-12.99","debit","Uncategorized"`);
  });

  it("marks credits", () => {
    expect(
      toCsvRow({
        date: "2026-01-02",
        description: "Salary",
        amount: 2000,
        direction: "credit",
        category: "Income",
      }),
    ).toBe('"2026-01-02","Salary","2000","credit","Income"');
  });
  it("exports a corrected direction with a matching signed amount", () => {
    expect(toCsvRow({ date: '2026-09-02', description: 'Refund', amount: -12, direction: 'credit' })).toContain('"12","credit"');
  });

  it("treats legacy null-direction rows as debits", () => {
    expect(
      toCsvRow({ date: "2026-01-02", description: "Gym", amount: 30, direction: null }),
    ).toContain('"debit"');
  });
});

describe("buildTransactionsCsv", () => {
  it("emits a header plus one line per row", () => {
    const csv = buildTransactionsCsv([
      { date: "2026-01-02", description: "=SUM(A1:A2)", amount: 1, category: "Subscription" },
      { date: "2026-01-03", description: "Spotify", amount: 9.99, category: null },
    ]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"Date","Description","Amount","Direction","Category"');
    expect(lines[1]).toContain(`"'=SUM(A1:A2)"`);
  });

  it("handles an empty result set", () => {
    expect(buildTransactionsCsv([])).toBe('"Date","Description","Amount","Direction","Category"');
  });
});

describe("exportFileName", () => {
  it("uses an ISO date suffix", () => {
    expect(exportFileName(new Date("2026-09-04T10:00:00Z"))).toBe(
      "casher-transactions-2026-09-04.csv",
    );
  });
});
