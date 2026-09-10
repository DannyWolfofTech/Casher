import { describe, it, expect } from 'vitest';
import { nextRenewal, cancellationProvider } from '../subscription-renewals';
describe('expected subscription renewals', () => {
  it('clamps end-of-month dates instead of skipping February', () => {
    expect(nextRenewal({last_charged:'2025-01-31', frequency:'monthly'})).toBe('2025-02-28');
    expect(nextRenewal({last_charged:'2024-01-31', frequency:'monthly'})).toBe('2024-02-29');
    expect(nextRenewal({last_charged:'2024-02-29', frequency:'annual'})).toBe('2025-02-28');
  });
  it('handles weekly and quarterly payments and preserves stale evidence', () => {
    expect(nextRenewal({last_charged:'2025-12-28', frequency:'weekly'})).toBe('2026-01-04');
    expect(nextRenewal({last_charged:'2025-11-30', frequency:'quarterly'})).toBe('2026-02-28');
    expect(nextRenewal({last_charged:'2025-09-15', frequency:'monthly'})).toBe('2025-10-15');
  });
  it('does not invent dates from missing or invalid inputs', () => {
    for (const last_charged of [null, '', '2025-02-30', 'invalid']) expect(nextRenewal({last_charged,frequency:'monthly'})).toBeNull();
    expect(nextRenewal({last_charged:'2025-09-15',frequency:'unknown'})).toBeNull();
  });
  it('recognizes statement descriptors, without guessing unknown merchants', () => {
    expect(cancellationProvider('NETFLIX.COM')?.url).toBe('https://www.netflix.com/cancelplan');
    expect(cancellationProvider('SPOTIFY UK')?.name).toBe('Spotify');
    for (const name of ['NetflixScam', 'BOS GYM SWIM & FITNESS', 'https://evil.test/Netflix']) expect(cancellationProvider(name)).toBeNull();
  });
});
