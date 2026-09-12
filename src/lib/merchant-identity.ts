import assets from '@/assets/merchants/catalogue.json';

export type MerchantId = keyof typeof assets;
export type Merchant = (typeof assets)[MerchantId] & { id: MerchantId };
export type MerchantCategory = 'groceries' | 'dining' | 'shopping' | 'transport' | 'travel' | 'subscription' | 'fitness' | 'utilities' | 'income' | 'rent' | 'other';

// Display metadata only. Never use a logo match to change amounts, categories,
// subscription detection, saved merchant fields or provider cancellation URLs.
const boundary = '(?=$|[ *#/\\-])';
const prefix = (value: string) => new RegExp(`^(?:${value})${boundary}`);
const rules: ReadonlyArray<{ id: MerchantId; pattern: RegExp }> = [
  // Specific products must precede their parent brand.
  { id: 'ubereats', pattern: prefix('UBER[ *]*EATS') },
  { id: 'applemusic', pattern: prefix('APPLE MUSIC') },
  { id: 'netflix', pattern: prefix('NETFLIX(?:\\.COM)?') },
  { id: 'spotify', pattern: prefix('SPOTIFY') },
  { id: 'puregym', pattern: prefix('PURE ?GYM(?:\\.COM)?') },
  { id: 'tesco', pattern: prefix('TESCO') },
  { id: 'asda', pattern: prefix('ASDA') },
  { id: 'morrisons', pattern: prefix('(?:W ?M )?MORRISONS') },
  { id: 'lidl', pattern: prefix('LIDL') },
  { id: 'aldinord', pattern: prefix('ALDI NORD') },
  { id: 'aldisud', pattern: prefix('ALDI S(?:U|UE)D') },
  { id: 'auchan', pattern: prefix('AUCHAN') },
  { id: 'carrefour', pattern: prefix('CARREFOUR') },
  { id: 'argos', pattern: prefix('ARGOS') },
  { id: 'boots', pattern: /^(?:BOOTS$|BOOTS (?:UK|THE CHEMIST|PHARMACY|STORES?|\d+)(?=$|[ *#/-]))/ },
  { id: 'ikea', pattern: prefix('IKEA') },
  { id: 'handm', pattern: prefix('H ?AND ?M|H M|HM') },
  { id: 'zalando', pattern: prefix('ZALANDO') },
  { id: 'deliveroo', pattern: prefix('DELIVEROO') },
  { id: 'justeat', pattern: prefix('JUST[ -]?EAT') },
  { id: 'mcdonalds', pattern: prefix('MCDONALDS') },
  { id: 'starbucks', pattern: prefix('STARBUCKS') },
  { id: 'uber', pattern: /^(?:UBER$|UBER[ *]+(?:TRIP|BV|PENDING|RIDES?)(?=$|[ *#/-]))/ },
  { id: 'airbnb', pattern: prefix('AIRBNB') },
  { id: 'bookingdotcom', pattern: prefix('BOOKING\\.COM|BOOKING COM') },
  { id: 'easyjet', pattern: prefix('EASY ?JET') },
  { id: 'ryanair', pattern: prefix('RYANAIR') },
  { id: 'vodafone', pattern: prefix('VODAFONE') },
  { id: 'o2', pattern: /^(?:O2$|O2 (?:UK|MOBILE|ONLINE|TELEFONICA|PAYMENT|\d+)(?=$|[ *#/-]))/ },
  { id: 'apple', pattern: /^(?:APPLE$|(?:APPLE|ITUNES)\.COM\/BILL(?=$|[ *#/-])|APPLE (?:STORE|RETAIL)(?=$|[ *#/-]))/ },
  { id: 'youtube', pattern: prefix('(?:GOOGLE[ *]+)?YOUTUBE(?: PREMIUM| MUSIC)?') },
  { id: 'dropbox', pattern: prefix('DROPBOX(?:\\.COM)?') },
];

function lookupText(value?: string | null): string {
  // Avoid retaining descriptors in an unbounded global cache, or matching only
  // a truncated fragment of an unusually long description.
  if (!value || value.length > 512) return '';
  let text = value.normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase()
    .replace(/[’']/g, '').replace(/&/g, ' AND ').replace(/\s+/g, ' ').trim();
  text = text.replace(/^(?:(?:DEBIT|CREDIT) CARD (?:PAYMENT|PURCHASE)|CARD (?:PAYMENT|PURCHASE)|DIRECT DEBIT|DD|POS|CONTACTLESS)\s+(?:TO\s+)?/, '');
  // Only explicit, familiar processor wrappers. A processor alone says nothing
  // about the underlying business; arbitrary leading text is never discarded.
  text = text.replace(/^(?:PAYPAL|PP|SUMUP|SQ|IZETTLE)\s*\*\s*/, '');
  return text;
}

function match(value?: string | null): Merchant | null {
  const text = lookupText(value);
  for (const rule of rules) {
    const found = rule.pattern.exec(text);
    if (!found) continue;
    // A combined statement fixture/description is not one identifiable merchant.
    if (/^\s*(?:AND|\+)\s+/.test(text.slice(found[0].length))) return null;
    return { id: rule.id, ...assets[rule.id] };
  }
  return null;
}

/** Prefer the complete descriptor; conflicting or uncertain identities fail closed. */
export function resolveMerchant(description?: string | null, merchant?: string | null): Merchant | null {
  if (description && description.length > 512) return null;
  const full = match(description);
  const supplied = match(merchant);
  if (full && supplied && full.id !== supplied.id) return null;
  if (full) return full;
  // An imported merchant field can help an otherwise opaque bank reference, but
  // must not turn "The Apple Tree Cafe" into Apple simply because it says Apple.
  return !description?.trim() || /^[\d\s*#./-]*$/.test(lookupText(description)) ? supplied : null;
}

export function merchantCategory(category?: string | null): MerchantCategory {
  const value = category?.trim().toLowerCase();
  switch (value) {
    case 'groceries': case 'grocery': return 'groceries';
    case 'dining': case 'food': case 'restaurants': return 'dining';
    case 'shopping': return 'shopping';
    case 'transport': case 'transportation': return 'transport';
    case 'travel': return 'travel';
    case 'subscription': case 'subscriptions': return 'subscription';
    case 'fitness': return 'fitness';
    case 'utilities': return 'utilities';
    case 'income': case 'salary': return 'income';
    case 'rent': case 'housing': return 'rent';
    default: return 'other';
  }
}

/** Search both the user's original text and the recognised display name. */
export function matchesMerchantSearch(row: { description: string; merchant?: string | null; category?: string | null }, search: string): boolean {
  const identity = resolveMerchant(row.description, row.merchant);
  return `${row.description} ${row.merchant || ''} ${row.category || ''} ${identity?.name || ''}`
    .normalize('NFKC').toLocaleLowerCase().includes(search.trim().normalize('NFKC').toLocaleLowerCase());
}
