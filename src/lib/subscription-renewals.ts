import { addMonths, addDays, format, isValid, parseISO } from 'date-fns';

/** One expected renewal after the last observed charge, never a fabricated current charge. */
export function nextRenewal(sub: { last_charged: string | null; frequency: string }): string | null {
  if (!sub.last_charged || !/^\d{4}-\d{2}-\d{2}$/.test(sub.last_charged)) return null;
  const last = parseISO(sub.last_charged);
  if (!isValid(last)) return null;
  const months: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12, annually: 12, yearly: 12 };
  const days: Record<string, number> = { weekly: 7, fortnightly: 14 };
  const frequency = sub.frequency.toLowerCase();
  const next = months[frequency] ? addMonths(last, months[frequency]) : days[frequency] ? addDays(last, days[frequency]) : null;
  return next ? format(next, 'yyyy-MM-dd') : null;
}

// Official cancellation destinations verified 11 September 2026.
// Unknown merchants must never be sent to a guessed site or an imported URL.
export function cancellationProvider(merchant: string): { name: string; url: string } | null {
  if (/^netflix(?:\.com)?(?:\s|$)/i.test(merchant.trim())) return { name: 'Netflix', url: 'https://www.netflix.com/cancelplan' };
  if (/^spotify(?:\s|$|\*)/i.test(merchant.trim())) return { name: 'Spotify', url: 'https://www.spotify.com/account/subscription/manage/' };
  return null;
}
