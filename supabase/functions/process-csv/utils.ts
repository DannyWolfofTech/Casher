export type RawTransactionRow = Record<string, unknown>;

export interface ProcessedTransactionRecord {
  user_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  merchant: string;
}

export interface RowProcessingResult {
  transaction: ProcessedTransactionRecord;
  merchant: string;
  subscriptionAmount: number;
}

const DESCRIPTION_FIELDS = [
  "description",
  "Description",
  "Transaction Description",
  "transaction description",
  "memo",
  "Memo",
  "narrative",
  "Narrative",
];

const DATE_FIELDS = [
  "date",
  "Date",
  "transaction date",
  "Transaction Date",
  "posted date",
  "Posted Date",
];

const AMOUNT_FIELDS = ["amount", "Amount", "transaction amount", "Transaction Amount", "value", "Value"];
const DEBIT_FIELDS = ["debit", "Debit", "debit amount", "Debit Amount"];
const CREDIT_FIELDS = ["credit", "Credit", "credit amount", "Credit Amount"];

const CURRENCY_SYMBOLS_REGEX = /[£$€]/g;

export function getFirstNonEmpty(row: RawTransactionRow, fields: string[]): unknown {
  for (const field of fields) {
    const value = row[field];

    if (value === undefined || value === null) continue;

    if (typeof value === "string" && value.trim() === "") continue;

    return value;
  }

  return undefined;
}

export function extractDescription(row: RawTransactionRow): string {
  const value = getFirstNonEmpty(row, DESCRIPTION_FIELDS);

  if (value === undefined || value === null) return "";

  return String(value).trim();
}

export function extractDateValue(row: RawTransactionRow): string | undefined {
  const value = getFirstNonEmpty(row, DATE_FIELDS);

  if (value === undefined || value === null) return undefined;

  return String(value).trim();
}

export function parseDate(raw: unknown): string {
  if (raw instanceof Date) {
    return raw.toISOString().split("T")[0];
  }

  if (raw === undefined || raw === null) {
    return new Date().toISOString().split("T")[0];
  }

  const value = String(raw).trim();

  if (!value) {
    return new Date().toISOString().split("T")[0];
  }

  const ukMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const parsed = new Date(`${year}-${month}-${day}`);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  const parsedDate = new Date(value);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

export function parseAmount(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw === "number") {
    if (Number.isNaN(raw) || !Number.isFinite(raw)) {
      return null;
    }

    return raw;
  }

  let value = String(raw).trim();

  if (!value) {
    return null;
  }

  let sign = 1;

  if (value.startsWith("(") && value.endsWith(")")) {
    sign = -1;
    value = value.slice(1, -1);
  }

  if (/^(dr|debit)\b/i.test(value)) {
    sign = -1;
    value = value.replace(/^(dr|debit)\b/i, "");
  }

  if (/^(cr|credit)\b/i.test(value)) {
    value = value.replace(/^(cr|credit)\b/i, "");
  }

  if (/dr$/i.test(value)) {
    sign = -1;
    value = value.replace(/dr$/i, "");
  }

  if (/cr$/i.test(value)) {
    value = value.replace(/cr$/i, "");
  }

  value = value.replace(CURRENCY_SYMBOLS_REGEX, "");
  value = value.replace(/\s+/g, "");

  if (value.startsWith("-")) {
    sign = -1;
    value = value.slice(1);
  }

  if (value.endsWith("-")) {
    sign = -1;
    value = value.slice(0, -1);
  }

  const commaCount = (value.match(/,/g) || []).length;
  const dotCount = (value.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (value.lastIndexOf(",") > value.lastIndexOf(".")) {
      value = value.replace(/\./g, "");
      value = value.replace(/,/g, ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (commaCount === 1) {
    const [, fractional = ""] = value.split(",");
    if (fractional.length === 2) {
      value = value.replace(/,/g, ".");
    } else if (fractional.length === 3) {
      value = value.replace(/,/g, "");
    } else {
      value = value.replace(/,/g, ".");
    }
  } else if (commaCount > 1) {
    value = value.replace(/,/g, "");
  }

  value = value.replace(/[^0-9.]/g, "");

  if (!value) {
    return null;
  }

  const parsed = parseFloat(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed * sign;
}

export function deriveAmount(row: RawTransactionRow): number | null {
  const debitValue = getFirstNonEmpty(row, DEBIT_FIELDS);

  if (debitValue !== undefined) {
    const parsed = parseAmount(debitValue);

    if (parsed !== null) {
      return parsed > 0 ? -parsed : parsed;
    }
  }

  const creditValue = getFirstNonEmpty(row, CREDIT_FIELDS);

  if (creditValue !== undefined) {
    const parsed = parseAmount(creditValue);

    if (parsed !== null) {
      return parsed < 0 ? -parsed : parsed;
    }
  }

  const amountValue = getFirstNonEmpty(row, AMOUNT_FIELDS);

  if (amountValue !== undefined) {
    return parseAmount(amountValue);
  }

  return null;
}

export function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();

  if (
    lower.includes("netflix") ||
    lower.includes("spotify") ||
    lower.includes("disney") ||
    lower.includes("prime") ||
    lower.includes("youtube premium") ||
    lower.includes("apple music") ||
    lower.includes("hbo") ||
    lower.includes("subscription")
  ) {
    return "Subscription";
  }

  if (lower.includes("rent") || lower.includes("mortgage")) return "Rent";
  if (lower.includes("grocery") || lower.includes("tesco") || lower.includes("sainsbury") || lower.includes("asda")) return "Groceries";
  if (lower.includes("gym") || lower.includes("fitness")) return "Fitness";
  if (
    lower.includes("restaurant") ||
    lower.includes("cafe") ||
    lower.includes("takeaway")
  )
    return "Dining";
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("train")) return "Transport";

  return "Other";
}

export function detectSubscription(description: string): boolean {
  const subscriptionKeywords = [
    "netflix",
    "spotify",
    "amazon prime",
    "disney",
    "apple music",
    "youtube premium",
    "hbo",
    "gym",
    "fitness",
    "subscription",
    "monthly",
    "annual",
    "membership",
  ];

  const lower = description.toLowerCase();
  return subscriptionKeywords.some((keyword) => lower.includes(keyword));
}

export function extractMerchant(description: string): string {
  const cleaned = description.replace(/\d{2}\/\d{2}\/\d{2,4}/g, "").replace(/[A-Z]{2,3}\s\d+/g, "").trim();

  return cleaned.substring(0, 50);
}

export function mapRowToTransaction(row: RawTransactionRow, userId: string): RowProcessingResult | null {
  const description = extractDescription(row);
  const amount = deriveAmount(row);

  if (!description || amount === null || Number.isNaN(amount) || amount === 0) {
    return null;
  }

  const rawDate = extractDateValue(row);
  const date = parseDate(rawDate);
  const category = categorizeTransaction(description);
  const isRecurring = detectSubscription(description);
  const merchant = extractMerchant(description);

  return {
    transaction: {
      user_id: userId,
      date,
      description,
      amount,
      category,
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? "monthly" : null,
      merchant,
    },
    merchant,
    subscriptionAmount: Math.abs(amount),
  };
}
