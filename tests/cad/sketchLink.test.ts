/**
 * Whose paper is this — the rules that decide it.
 *
 * `customer_key` sat empty in every row of the live table (12 readings, 0 links, measured
 * 2026-10-01), and the only thing that keeps a link honest once it exists is these rules:
 * a key is the roll's own shape, a phone key is a real Egyptian mobile, and the customer's
 * private page never repeats the number back.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { linkFromPhone, parseSketchLink, MAX_LINK_LENGTH } from '@/lib/cad/sketch-link';

const ARABIC_0 = 0x0660;

describe('linkFromPhone', () => {
  it('keys the same mobile the same way however it is spelled', () => {
    const wanted = 'phone:1001234567';
    for (const raw of ['01001234567', '+20 100 123 4567', '0020 100 123 4567', '201001234567', '100-123-4567', '  01001234567  ']) {
      expect(linkFromPhone(raw)?.key, raw).toBe(wanted);
    }
  });

  it('reads digits typed on an Arabic keyboard', () => {
    // Built from char codes: a table of Arabic-Indic digits typed by hand loses one every time.
    const arabic = '01001234567'.replace(/\d/g, (d) => String.fromCharCode(ARABIC_0 + Number(d)));
    expect(linkFromPhone(arabic)?.key).toBe('phone:1001234567');
  });

  it('refuses anything that is not an Egyptian mobile, because a wrong digit merges two strangers', () => {
    for (const raw of ['', '   ', null, undefined, '0100123', '100123456', '0223445566', '0100123456a', '999']) {
      expect(linkFromPhone(raw), String(raw)).toBeNull();
    }
    expect(linkFromPhone('01001234567')?.value).toBe('1001234567');
  });
});

describe('parseSketchLink', () => {
  it('accepts the three shapes the roll forms, and nothing else', () => {
    expect(parseSketchLink('phone:1001234567')?.kind).toBe('phone');
    expect(parseSketchLink('email:Ali@Example.com')?.key).toBe('email:ali@example.com');
    expect(parseSketchLink('name:أحمد  محمود')?.key).toBe('name:أحمد محمود');
    for (const raw of ['', '   ', '1001234567', 'customer:1001234567', 'phone:', 'name:  ', `x${'y'.repeat(MAX_LINK_LENGTH)}`]) {
      expect(parseSketchLink(raw), String(raw)).toBeNull();
    }
  });

  it('will not wear the phone prefix over digits that are not a mobile', () => {
    expect(parseSketchLink('phone:123')).toBeNull();
    expect(parseSketchLink('phone:01001234567')).toBeNull();
    expect(parseSketchLink('phone:10012345678')).toBeNull();
  });

  it('refuses a key carrying control characters or quoting', () => {
    expect(parseSketchLink('name:أحمد\n-x')).toBeNull();
    expect(parseSketchLink('name:أ"; drop')).toBeNull();
    expect(parseSketchLink('name:أ<b>')).toBeNull();
  });
});

describe('the customer’s own page keeps his number to itself', () => {
  const sheetDoor = () => readFileSync('app/api/passport/[token]/route.ts', 'utf8');

  it('never returns the stored key from the public door', () => {
    const source = sheetDoor();
    const body = source.slice(source.indexOf('function publicSheet'), source.indexOf('async function findByToken'));
    expect(body).not.toMatch(/customer_key/);
    // The key is read for the write rule, and stops there.
    // The door must read the key (that is how it decides whether the paper has an owner) while
    // never echoing it. Column order in the select is not the rule, so match the name in the list.
    expect(source).toMatch(/select\("[^"]*\bcustomer_key\b[^"]*"\)/);
  });

  it('only claims a paper that has no owner yet, so a visitor cannot move the owner’s link', () => {
    expect(sheetDoor()).toMatch(/\.is\("customer_key",\s*null\)/);
  });
});

describe('the paper door answers for the store, not for whatever a tab sends', () => {
  const door = () => readFileSync('app/api/admin/ops/sketch/route.ts', 'utf8');

  it('will not take a finished pixel reading from the request body', () => {
    // Four readings were once stored with a witness that never ran, because a test
    // instrument handed the door one in the body and the door believed it.
    expect(door()).not.toMatch(/offline_reading/);
    expect(door()).toMatch(/runOffline:\s*false/);
  });

  it('takes the owner link only in the roll’s own key shapes', () => {
    expect(door()).toMatch(/parseSketchLink\(body\?\.customer_key\)/);
    expect(door()).toMatch(/\.eq\("id", id\)[\s\S]*\.eq\("company_id", companyId\)/);
  });
});
