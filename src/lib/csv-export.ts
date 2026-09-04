/**
 * CSV export helpers for the transactions table.
 *
 * Security: spreadsheet applications (Excel, Sheets, LibreOffice) execute a
 * cell whose value starts with `=`, `+`, `-`, `@`, TAB or CR. Any of those
 * leading characters must be neutralised before the value is written, or an
 * imported bank description can turn into a formula on the user's machine
 * (CSV injection / DDE execution).
 */

import { isCredit, type DirectionalTransaction } from "@/lib/transactions";

export const CSV_EXPORT_HEADERS = [
  "Date",
  "Description",
  "Amount",
  "Direction",
  "Category",
] as const;

const DANGEROUS_LEADING = /^[=+\-@\t\r]/;

/** True when a raw value would be interpreted as a formula by a spreadsheet. */
export function isFormulaLike(value: string): boolean {
  return DANGEROUS_LEADING.test(value);
}

/**
 * Neutralise formula-like values by prefixing a single quote, then quote and
 * escape the cell so delimiters/newlines survive the round trip.
 */
export function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (isFormulaLike(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export interface ExportableTransaction extends DirectionalTransaction {
  date: string;
  description: string;
  amount: number | string;
  category?: string | null;
}

export function toCsvRow(t: ExportableTransaction): string {
  return [
    escapeCsvCell(t.date),
    escapeCsvCell(t.description),
    escapeCsvCell(t.amount),
    escapeCsvCell(isCredit(t) ? "credit" : "debit"),
    escapeCsvCell(t.category || "Uncategorized"),
  ].join(",");
}

/** Build the full CSV document for the given rows (already filtered/sorted). */
export function buildTransactionsCsv(rows: ExportableTransaction[]): string {
  return [
    CSV_EXPORT_HEADERS.map(escapeCsvCell).join(","),
    ...rows.map(toCsvRow),
  ].join("\r\n");
}

export function exportFileName(date = new Date()): string {
  return `casher-transactions-${date.toISOString().split("T")[0]}.csv`;
}
