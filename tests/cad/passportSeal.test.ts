/**
 * The seal: what «nothing changed after he signed» is allowed to mean.
 *
 * Measured live on 2026-10-01 on a real sheet: the paper carried 4.5 and 3.2, the customer
 * typed 4.5, and his own page told him — one second after he signed — «الأرقام على الورقة
 * اتغيرت بعد اعتمادك». The seal was taken over the number he agreed and checked against
 * every number on the paper, including the one nobody vouched for. These are the two rules
 * that keep that accusation honest: the same set on both sides, and a real change still
 * caught.
 */
import { describe, expect, it } from 'vitest';

import { agreedNumbers, freezeHash, looksLikePassportToken, newPassportToken, stillSealed } from '@/lib/cad/passport';

const AGREEABLE = [
  { meters: 4.5, confirmed: true },
  { meters: 3.2, confirmed: false },
];

describe('the seal only covers what was agreed', () => {
  it('does not accuse a customer of changing his sheet the moment he signs it', () => {
    const sealed = freezeHash(AGREEABLE.filter((d) => d.confirmed));
    expect(stillSealed(sealed, AGREEABLE)).toBe(true);
  });

  it('catches a confirmed number being moved later', () => {
    const sealed = freezeHash(AGREEABLE.filter((d) => d.confirmed));
    expect(stillSealed(sealed, [{ meters: 4.6, confirmed: true }, { meters: 3.2, confirmed: false }])).toBe(false);
  });

  it('catches a new number gaining a witness after the signature', () => {
    const sealed = freezeHash(AGREEABLE.filter((d) => d.confirmed));
    expect(stillSealed(sealed, [{ meters: 4.5, confirmed: true }, { meters: 3.2, confirmed: true }])).toBe(false);
  });

  it('says nothing about a sheet that was never sealed', () => {
    expect(stillSealed(null, AGREEABLE)).toBe(false);
    expect(stillSealed('', AGREEABLE)).toBe(false);
  });

  it('treats a bare list of numbers as all agreed, so no caller silently seals nothing', () => {
    expect(agreedNumbers([{ meters: 2 }, { meters: 1.005 }])).toEqual([1, 2]);
    expect(stillSealed(freezeHash([{ meters: 2 }]), [{ meters: 2 }])).toBe(true);
  });

  it('rounds to the centimetre and orders, so the same room seals the same way', () => {
    expect(freezeHash([{ meters: 4.5, confirmed: true }, { meters: 3.2, confirmed: true }])).toBe(
      freezeHash([{ meters: 3.2000001, confirmed: true }, { meters: 4.5, confirmed: true }])
    );
  });
});

describe('the private address of a sheet', () => {
  it('is 24 characters a chat app will not break', () => {
    const token = newPassportToken();
    expect(token).toHaveLength(24);
    expect(looksLikePassportToken(token)).toBe(true);
  });

  it('refuses a shape that is not one, so a probe cannot reach the door', () => {
    for (const bad of ['', 'short', 'a'.repeat(40), `${'a'.repeat(20)}../`]) {
      expect(looksLikePassportToken(bad), bad).toBe(false);
    }
  });

  it('two sheets never get the same address', () => {
    const seen = new Set(Array.from({ length: 500 }, () => newPassportToken()));
    expect(seen.size).toBe(500);
  });
});
