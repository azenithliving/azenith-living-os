// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  belongsToStore,
  storeCompanyIds,
  storeIdFilter,
  LEGACY_STORE_COMPANY_IDS,
} from '@/lib/company-scope';

const ADMIN = 'dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d';
const ZERO_ONE = '00000000-0000-0000-0000-000000000001';
const FOREIGN = '11111111-2222-3333-4444-555555555555';

describe('storeCompanyIds', () => {
  it('treats the canonical id and the legacy stamps as one store', () => {
    const ids = storeCompanyIds(ADMIN);
    expect(ids).toContain(ADMIN);
    for (const legacy of LEGACY_STORE_COMPANY_IDS) expect(ids).toContain(legacy);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates even if env equals a legacy id
  });

  it('drops a null canonical instead of putting null in an .in() list', () => {
    expect(storeCompanyIds(null)).toEqual(LEGACY_STORE_COMPANY_IDS);
    expect(storeCompanyIds(null)).not.toContain(null);
  });
});

describe('belongsToStore', () => {
  it('accepts rows stamped with any id belonging to the shop', () => {
    expect(belongsToStore(ADMIN, ADMIN)).toBe(true);
    expect(belongsToStore(ZERO_ONE, ADMIN)).toBe(true); // the live room sections
  });

  it('keeps unstamped historical rows visible', () => {
    expect(belongsToStore(null, ADMIN)).toBe(true);
    expect(belongsToStore(undefined, ADMIN)).toBe(true);
  });

  it('still rejects a genuinely different tenant', () => {
    expect(belongsToStore(FOREIGN, ADMIN)).toBe(false);
  });

  it('filters nothing when no company is resolved, matching the old behaviour', () => {
    expect(belongsToStore(FOREIGN, null)).toBe(true);
    expect(storeIdFilter(null)).toBeNull();
    expect(storeIdFilter(ADMIN)).toEqual(storeCompanyIds(ADMIN));
  });
});
