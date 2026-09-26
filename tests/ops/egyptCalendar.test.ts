// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { SEASONS, currentSeason, nextSeason, seasonLabel } from '@/lib/ops/egypt-calendar';

/**
 * Festival windows below are NOT invented: the Hijri anchors were resolved for
 * Gregorian 2026–2030 with Node's ICU `islamic-umalqura` calendar and every one
 * of them re-verified against api.aladhan.com (all agreed). See the source note
 * inside lib/ops/egypt-calendar.ts.
 */
describe('egypt-calendar', () => {
  it('puts Ramadan 2026 between its verified anchors', () => {
    const r = SEASONS.find((s) => s.key === 'ramadan' && s.start.startsWith('2026'));
    expect(r?.start).toBe('2026-02-18'); // 1 Ramadan 1447
    expect(r?.end).toBe('2026-03-19'); // last day before 1 Shawwal 1447 = 2026-03-20
  });

  it('resolves the verified festival day for each year in range', () => {
    expect(currentSeason('2027-02-08')?.key).toBe('ramadan'); // 1 Ramadan 1448
    expect(currentSeason('2028-01-28')?.key).toBe('ramadan'); // 1 Ramadan 1449
    expect(currentSeason('2029-04-24')?.key).toBe('eid_adha'); // 10 Dhul-Hijjah 1450
    expect(currentSeason('2030-04-13')?.key).toBe('eid_adha'); // 10 Dhul-Hijjah 1451
  });

  it('handles the year 2030 having two Ramadans', () => {
    expect(currentSeason('2030-01-10')?.start).toBe('2030-01-05'); // 1 Ramadan 1451
    const late = currentSeason('2030-12-30');
    expect(late?.key).toBe('ramadan'); // 1 Ramadan 1452 = 2030-12-26
    expect(late?.end).toBe('2031-01-23'); // 1 Shawwal 1452 = 2031-01-24
  });

  it('splits the boundary day between Ramadan and Eid al-Fitr', () => {
    expect(currentSeason('2026-03-19')?.key).toBe('ramadan');
    expect(currentSeason('2026-03-20')?.key).toBe('eid_fitr');
    expect(currentSeason('2026-03-22')?.key).toBe('eid_fitr');
    expect(currentSeason('2026-03-23')).toBeUndefined();
  });

  it('uses fixed Gregorian windows for the two commercial seasons', () => {
    expect(currentSeason('2026-07-01')?.key).toBe('summer');
    expect(currentSeason('2026-08-14')?.key).toBe('summer');
    expect(currentSeason('2026-08-15')?.key).toBe('schools');
    expect(currentSeason('2026-10-15')?.key).toBe('schools');
    expect(currentSeason('2026-11-05')).toBeUndefined(); // honest gap: no season
  });

  it('accepts Date objects and compares on the UTC day', () => {
    expect(currentSeason(new Date('2026-05-27T00:30:00Z'))?.key).toBe('eid_adha');
  });

  it('names seasons in Arabic for the digest', () => {
    expect(seasonLabel('ramadan')).toContain('رمضان');
    expect(seasonLabel('eid_adha')).toContain('الأضحى');
  });

  it('returns the next upcoming season, skipping past ones', () => {
    expect(nextSeason('2026-08-20')?.start).toBe('2027-02-08'); // after schools ends
    expect(nextSeason('2026-03-25')?.key).toBe('eid_adha');
  });

  it('keeps every window well-formed and inside the stated horizon', () => {
    expect(SEASONS.length).toBeGreaterThanOrEqual(15);
    for (const s of SEASONS) {
      expect(s.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.end >= s.start).toBe(true);
      expect(['ramadan', 'eid_fitr', 'eid_adha', 'summer', 'schools']).toContain(s.key);
    }
    const years = SEASONS.map((s) => s.start.slice(0, 4));
    for (const y of ['2026', '2027', '2028', '2029', '2030']) expect(years).toContain(y);
  });
});
