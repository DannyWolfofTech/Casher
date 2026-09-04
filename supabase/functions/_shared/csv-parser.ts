/**
 * Shared, dependency-free CSV parsing for bank statement imports.
 *
 * This module is the single source of truth used by the `process-csv` edge
 * function AND by the automated test-suite. It must stay pure (no Deno / Node
 * globals, no network, no imports) so it can run in both runtimes.
 */

export const IMPORT_VERSION = 2;

/**
 * Category used for money-in rows. This is the ONLY direction signal that
 * survives on databases where the `direction` column does not exist yet, so
 * readers treat `category === INCOME_CATEGORY` as a credit.
 */
export const INCOME_CATEGORY = "Income";

export type Direction = "debit" | "credit";

export interface NormalizedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  /** Signed cash-flow amount. Debits/outflows negative, credits positive. */
  amount: number;
  direction: Direction;
  category: string;
  isSubscription: boolean;
  merchant: string;
  rowNumber: number;
}

export interface SkippedRow {
  rowNumber: number;
  reason: string;
}

export interface ColumnMap {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
}

export interface ParseSuccess {
  ok: true;
  transactions: NormalizedTransaction[];
  skipped: SkippedRow[];
  duplicatesInFile: number;
  headerRowIndex: number;
  columns: ColumnMap;
  totalDataRows: number;
}

export interface ParseFailure {
  ok: false;
  code: "EMPTY_FILE" | "MISSING_COLUMNS" | "NO_VALID_ROWS" | "TOO_MANY_ROWS";
  message: string;
  details?: Record<string, unknown>;
}

export type ParseResult = ParseSuccess | ParseFailure;

/* ------------------------------------------------------------------ */
/* Low-level CSV tokenizer (RFC4180-ish: quotes, escaped quotes, CRLF) */
/* ------------------------------------------------------------------ */

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function splitCsvRows(text: string): string[][] {
  const src = stripBom(text ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyChar = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      sawAnyChar = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      sawAnyChar = true;
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      if (sawAnyChar || row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      sawAnyChar = false;
      continue;
    }
    field += ch;
    sawAnyChar = true;
  }

  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ------------------------------------------------------------------ */
/* Header detection                                                    */
/* ------------------------------------------------------------------ */

export function normalizeHeader(header: string): string {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[£$€]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DATE_ALIASES = [
  "date", "transaction date", "posted date", "post date", "trans date",
  "value date", "booking date", "date of transaction", "completed date",
];
const DESCRIPTION_ALIASES = [
  "description", "transaction description", "memo", "narrative", "details",
  "reference", "transaction", "particulars", "payee", "merchant", "name",
  "counter party", "counterparty",
];
const AMOUNT_ALIASES = [
  "amount", "transaction amount", "value", "cost", "sum", "amount gbp",
  "amount in account currency", "net amount",
];
const DEBIT_ALIASES = [
  "debit amount", "debit", "paid out", "money out", "withdrawal",
  "withdrawals", "payments", "out", "debits",
];
const CREDIT_ALIASES = [
  "credit amount", "credit", "paid in", "money in", "deposit", "deposits",
  "receipts", "in", "credits",
];
const TYPE_ALIASES = [
  "type", "transaction type", "debit credit", "dr cr", "cr dr",
  "debit or credit", "credit debit indicator",
];

function matchAlias(normalized: string, aliases: string[]): boolean {
  return aliases.includes(normalized);
}

export function buildColumnMap(headerRow: string[]): ColumnMap | null {
  const map: Partial<ColumnMap> = {};
  headerRow.forEach((raw) => {
    const n = normalizeHeader(raw);
    if (!n) return;
    if (!map.date && matchAlias(n, DATE_ALIASES)) map.date = raw;
    else if (!map.description && matchAlias(n, DESCRIPTION_ALIASES)) map.description = raw;
    else if (!map.debit && matchAlias(n, DEBIT_ALIASES)) map.debit = raw;
    else if (!map.credit && matchAlias(n, CREDIT_ALIASES)) map.credit = raw;
    else if (!map.amount && matchAlias(n, AMOUNT_ALIASES)) map.amount = raw;
    else if (!map.type && matchAlias(n, TYPE_ALIASES)) map.type = raw;
  });

  if (!map.date || !map.description) return null;
  if (!map.amount && !map.debit && !map.credit) return null;
  return map as ColumnMap;
}

export const MAX_HEADER_SCAN_ROWS = 10;

export function findHeaderRow(
  rows: string[][],
  maxScan = MAX_HEADER_SCAN_ROWS,
): { index: number; columns: ColumnMap } | null {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const columns = buildColumnMap(rows[i]);
    if (columns) return { index: i, columns };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || y < 1000 || y > 9999) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Parse a bank-statement date into an ISO calendar date (YYYY-MM-DD).
 * Supports DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD and ISO date-times.
 * Date-times are truncated on their literal date part — never converted via a
 * local timezone, so no off-by-one day shifting occurs.
 * Returns null when the value is not a real calendar date.
 */
export function parseUkDate(input: string): string | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/^["']|["']$/g, "");
  if (!s) return null;

  // ISO date-time: take the literal date part only.
  const isoDateTime = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ]\d{1,2}:\d{2}/);
  if (isoDateTime) {
    const y = +isoDateTime[1], m = +isoDateTime[2], d = +isoDateTime[3];
    return isRealCalendarDate(y, m, d) ? fmt(y, m, d) : null;
  }

  // UK date-time: DD/MM/YYYY HH:MM
  const ukDateTime = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})[T ]\d{1,2}:\d{2}/);
  if (ukDateTime) s = `${ukDateTime[1]}/${ukDateTime[2]}/${ukDateTime[3]}`;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    return isRealCalendarDate(y, m, d) ? fmt(y, m, d) : null;
  }

  const uk = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (uk) {
    const d = +uk[1];
    const m = +uk[2];
    let yStr = uk[3];
    if (yStr.length === 2) yStr = (parseInt(yStr, 10) >= 70 ? "19" : "20") + yStr;
    const y = parseInt(yStr, 10);
    return isRealCalendarDate(y, m, d) ? fmt(y, m, d) : null;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Amounts                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a currency amount, preserving sign.
 * Handles £/$/€, UK (1,234.56) and European (1.234,56) separators,
 * parenthesised negatives, leading/trailing +/-, and "CR"/"DR" suffixes.
 */
export function parseAmount(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return NaN;
  if (typeof input === "number") return isFinite(input) ? input : NaN;

  let s = String(input).trim().replace(/^["']|["']$/g, "");
  if (!s) return NaN;

  let sign = 1;

  // Trailing CR/DR indicators (common in UK exports)
  const crdr = s.match(/\s*(CR|DR)\.?$/i);
  if (crdr) {
    if (crdr[1].toUpperCase() === "DR") sign = -1;
    s = s.slice(0, crdr.index).trim();
  }

  s = s.replace(/[£$€\s]/g, "");

  const negParen = /^\((.*)\)$/.exec(s);
  if (negParen) {
    sign *= -1;
    s = negParen[1];
  }

  if (s.startsWith("-")) {
    sign *= -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

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
    if (parts.length === 2 && parts[1].length <= 2) s = parts[0] + "." + parts[1];
    else s = s.replace(/,/g, "");
  }

  s = s.replace(/[^0-9.]/g, "");
  if (!s || !/\d/.test(s)) return NaN;

  const n = parseFloat(s);
  return isNaN(n) ? NaN : sign * n;
}

/* ------------------------------------------------------------------ */
/* Descriptions, categories, subscriptions                             */
/* ------------------------------------------------------------------ */

export function normalizeDescription(d: string): string {
  return String(d ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function categorizeTransaction(description: string): string {
  const lower = String(description ?? "").toLowerCase();
  if (
    lower.includes("netflix") || lower.includes("spotify") || lower.includes("disney") ||
    lower.includes("prime") || lower.includes("youtube premium") || lower.includes("apple music") ||
    lower.includes("hbo") || lower.includes("subscription")
  ) return "Subscription";
  if (lower.includes("rent") || lower.includes("mortgage")) return "Rent";
  if (lower.includes("grocery") || lower.includes("tesco") || lower.includes("sainsbury") || lower.includes("asda")) return "Groceries";
  if (lower.includes("gym") || lower.includes("fitness")) return "Fitness";
  if (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("takeaway")) return "Dining";
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("train")) return "Transport";
  return "Other";
}

const SUBSCRIPTION_KEYWORDS = [
  "netflix", "spotify", "amazon prime", "disney", "apple music",
  "youtube premium", "hbo", "gym", "fitness", "subscription",
  "membership",
];

/** Housing costs are never subscriptions, however they are worded. */
const NON_SUBSCRIPTION_PATTERN = /\b(rent|rental|mortgage|landlord|letting)\b/i;

export function detectSubscription(description: string): boolean {
  const raw = String(description ?? "");
  // Fail closed for rent/mortgage before any keyword check.
  if (NON_SUBSCRIPTION_PATTERN.test(raw)) return false;
  const lower = raw.toLowerCase();
  // Generic temporal words ("monthly", "annual") are NOT evidence on their own.
  return SUBSCRIPTION_KEYWORDS.some((k) => lower.includes(k));
}


export function detectFrequency(description: string): "monthly" | "annual" {
  return /\bannual|\byearly|\bper year/i.test(String(description ?? "")) ? "annual" : "monthly";
}

export function extractMerchant(description: string): string {
  const cleaned = String(description ?? "")
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, "")
    .replace(/[A-Z]{2,3}\s\d+/g, "")
    .trim();
  return cleaned.substring(0, 50);
}

/* ------------------------------------------------------------------ */
/* Dedupe keys                                                         */
/* ------------------------------------------------------------------ */

/** Sign-preserving dedupe key: a debit and a credit never collapse. */
export function dedupKey(date: string, description: string, amount: number | string): string {
  const n = Number(amount);
  const signed = (n < 0 ? -1 : 1) * Math.abs(Number(n.toFixed ? n : n));
  return `${date}|${normalizeDescription(String(description))}|${signed.toFixed(2)}`;
}

/** Legacy (pre import-version 2) key: rows were stored as absolute values. */
export function legacyDedupKey(date: string, description: string, amount: number | string): string {
  return `${date}|${normalizeDescription(String(description))}|${Math.abs(Number(amount)).toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/* Row-level normalisation                                             */
/* ------------------------------------------------------------------ */

function cell(row: string[], header: string[], name?: string): string {
  if (!name) return "";
  const idx = header.indexOf(name);
  if (idx === -1) return "";
  return row[idx] ?? "";
}

function directionFromType(typeValue: string): Direction | null {
  const t = normalizeHeader(typeValue);
  if (!t) return null;
  if (/^(dr|debit|withdrawal|payment|paid out|money out|purchase|out)$/.test(t)) return "debit";
  if (/^(cr|credit|deposit|refund|paid in|money in|in)$/.test(t)) return "credit";
  return null;
}

export interface ResolvedAmount {
  amount: number; // signed
  direction: Direction;
}

/** Resolve the signed cash-flow amount from a row's amount/debit/credit cells. */
export function resolveAmount(
  amountRaw: string,
  debitRaw: string,
  creditRaw: string,
  typeRaw: string,
): ResolvedAmount | null {
  const debit = parseAmount(debitRaw);
  const credit = parseAmount(creditRaw);

  if (!isNaN(debit) && debit !== 0) {
    return { amount: -Math.abs(debit), direction: "debit" };
  }
  if (!isNaN(credit) && credit !== 0) {
    return { amount: Math.abs(credit), direction: "credit" };
  }

  const amount = parseAmount(amountRaw);
  if (isNaN(amount) || amount === 0) return null;

  const typed = directionFromType(typeRaw);
  if (typed === "debit") return { amount: -Math.abs(amount), direction: "debit" };
  if (typed === "credit") return { amount: Math.abs(amount), direction: "credit" };

  return amount < 0
    ? { amount, direction: "debit" }
    : { amount, direction: "credit" };
}

/* ------------------------------------------------------------------ */
/* Top-level parse                                                     */
/* ------------------------------------------------------------------ */

export interface ParseOptions {
  maxRows?: number;
  headerScanRows?: number;
}

export function parseTransactionsCsv(csvText: string, options: ParseOptions = {}): ParseResult {
  const maxRows = options.maxRows ?? 10_000;
  const rows = splitCsvRows(csvText);

  if (rows.length === 0) {
    return { ok: false, code: "EMPTY_FILE", message: "The file is empty." };
  }

  const header = findHeaderRow(rows, options.headerScanRows ?? MAX_HEADER_SCAN_ROWS);
  if (!header) {
    return {
      ok: false,
      code: "MISSING_COLUMNS",
      message:
        "Could not find the required columns. Your CSV needs a date column, a description column, and either an amount column or separate debit/credit columns.",
      details: { scannedRows: Math.min(rows.length, options.headerScanRows ?? MAX_HEADER_SCAN_ROWS) },
    };
  }

  const headerRow = rows[header.index];
  const dataRows = rows.slice(header.index + 1);

  if (dataRows.length > maxRows) {
    return {
      ok: false,
      code: "TOO_MANY_ROWS",
      message: `This file has ${dataRows.length} rows, which is over the ${maxRows} row limit. Please split it into smaller files.`,
      details: { rows: dataRows.length, maxRows },
    };
  }

  const transactions: NormalizedTransaction[] = [];
  const skipped: SkippedRow[] = [];
  const seenInFile = new Set<string>();
  let duplicatesInFile = 0;

  dataRows.forEach((row, i) => {
    const rowNumber = header.index + i + 2; // 1-based, header included
    const rawDate = cell(row, headerRow, header.columns.date);
    const description = cell(row, headerRow, header.columns.description).trim();
    const amountRaw = cell(row, headerRow, header.columns.amount);
    const debitRaw = cell(row, headerRow, header.columns.debit);
    const creditRaw = cell(row, headerRow, header.columns.credit);
    const typeRaw = cell(row, headerRow, header.columns.type);

    const date = parseUkDate(rawDate);
    if (!date) {
      skipped.push({ rowNumber, reason: `Invalid or unrecognised date: "${String(rawDate).trim()}"` });
      return;
    }
    if (!description) {
      skipped.push({ rowNumber, reason: "Missing description" });
      return;
    }

    const resolved = resolveAmount(amountRaw, debitRaw, creditRaw, typeRaw);
    if (!resolved) {
      skipped.push({ rowNumber, reason: "Missing, zero or unreadable amount" });
      return;
    }

    const key = dedupKey(date, description, resolved.amount);
    if (seenInFile.has(key)) {
      duplicatesInFile += 1;
      return;
    }
    seenInFile.add(key);

    const isSubscription = resolved.direction === "debit" && detectSubscription(description);

    transactions.push({
      date,
      description,
      amount: resolved.amount,
      direction: resolved.direction,
      category: resolved.direction === "credit" ? INCOME_CATEGORY : categorizeTransaction(description),
      isSubscription,
      merchant: extractMerchant(description),
      rowNumber,
    });
  });

  if (transactions.length === 0) {
    return {
      ok: false,
      code: "NO_VALID_ROWS",
      message:
        "We found the columns but none of the rows contained a valid date, description and amount. Nothing was imported.",
      details: { skipped: skipped.slice(0, 10), skippedCount: skipped.length },
    };
  }

  return {
    ok: true,
    transactions,
    skipped,
    duplicatesInFile,
    headerRowIndex: header.index,
    columns: header.columns,
    totalDataRows: dataRows.length,
  };
}

/** Build the detected-subscription rows for a parsed batch (debits only). */
export function buildSubscriptions(transactions: NormalizedTransaction[]) {
  const map = new Map<string, {
    service_name: string;
    amount: number;
    frequency: string;
    last_charged: string;
    estimated_annual_cost: number;
    cancellation_url: string | null;
    status: string;
  }>();

  for (const t of transactions) {
    if (!t.isSubscription || t.direction !== "debit") continue;
    if (map.has(t.merchant)) continue;
    const amount = Math.abs(t.amount);
    const frequency = detectFrequency(t.description);
    map.set(t.merchant, {
      service_name: t.merchant,
      amount,
      frequency,
      last_charged: t.date,
      estimated_annual_cost: frequency === "annual" ? amount : amount * 12,
      cancellation_url: null,
      status: "active",
    });
  }

  return map;
}
