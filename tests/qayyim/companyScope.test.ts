// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  belongsToStore,
  storeCompanyIds,
  storeIdFilter,
  LEGACY_STORE_COMPANY_IDS,
} from '@/lib/company-scope';

/**
 * After 20260925_p6_one_store.sql the database is the guarantee: one stamp for
 * every row, plus a BEFORE trigger that normalises writes. These tests pin the
 * read-side contract that is left over, so a future change cannot quietly
 * re-widen it into a workaround again.
 */
const ADMIN = 'dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d';
const FOREIGN = '11111111-2222-3333-4444-555555555555';

describe('storeCompanyIds', () => {
  it('is exactly the store id now that the data is consolidated', () => {
    expect(storeCompanyIds(ADMIN)).toEqual([ADMIN]);
  });

  it('adds no duplicate when a retired stamp equals the canonical id', () => {
    expect(new Set(storeCompanyIds(ADMIN)).size).toBe(storeCompanyIds(ADMIN).length);
  });

  it('never puts null into an .in() list', () => {
    expect(storeCompanyIds(null)).toEqual([]);
  });

  it('keeps the seam empty and typed, so healing a legacy env is a one-line change', () => {
    expect(Array.isArray(LEGACY_STORE_COMPANY_IDS)).toBe(true);
    expect(LEGACY_STORE_COMPANY_IDS).toEqual([]);
  });
});

describe('belongsToStore', () => {
  it('accepts the store stamp', () => {
    expect(belongsToStore(ADMIN, ADMIN)).toBe(true);
  });

  it('rejects another tenant — the pre-consolidation leniency is retired', () => {
    expect(belongsToStore(FOREIGN, ADMIN)).toBe(false);
  });

  it('still tolerates an unstamped row, because an un-migrated environment may have one', () => {
    expect(belongsToStore(null, ADMIN)).toBe(true);
    expect(belongsToStore(undefined, ADMIN)).toBe(true);
  });

  it('filters nothing when no company is resolved, matching the old behaviour', () => {
    expect(belongsToStore(FOREIGN, null)).toBe(true);
    expect(storeIdFilter(null)).toBeNull();
    expect(storeIdFilter(ADMIN)).toEqual([ADMIN]);
  });
});
