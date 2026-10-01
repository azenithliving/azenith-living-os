/**
 * Finding a customer from what someone typed.
 *
 * The desk asks one question the roll cannot answer by itself — «whose paper is this?» —
 * and the owner answers it with three letters or the last digits of a mobile, on a phone,
 * standing in a shop. These are the rules that decide who he is offered, and the brake the
 * whole customers domain runs on: a query that matches nothing returns nothing. No
 * candidate is ever made up, and nothing here writes to the roll.
 */
import { describe, expect, it } from 'vitest';

import { matchRoll, rollLineLabel, type RollLine } from '@/lib/customers/match';

const line = (over: Partial<RollLine> & { key: string }): RollLine => ({ name: null, phone: null, ...over });

const ROLL: RollLine[] = [
  line({ key: 'phone:1001234567', name: 'أحمد محمود', phone: '01001234567' }),
  line({ key: 'phone:1112223344', name: 'اميرة السيد', phone: '01112223344' }),
  line({ key: 'name:أحمد', name: 'أحمد', phone: null }),
  line({ key: 'email:ali@example.com', name: null, phone: null, email: 'ali@example.com' }),
];

describe('matchRoll', () => {
  it('finds him by a mobile written any of the ways people write it', () => {
    for (const query of ['01001234567', '+20 100 123 4567', '1001234567']) {
      const hits = matchRoll(ROLL, query);
      expect(hits[0]?.line.key, query).toBe('phone:1001234567');
    }
  });

  it('finds him by the last digits, because that is what shows on a phone screen', () => {
    const hits = matchRoll(ROLL, '4567');
    expect(hits).toHaveLength(1);
    expect(hits[0].line.key).toBe('phone:1001234567');
    expect(hits[0].why).toBe('آخر الرقم');
  });

  it('does not care how the name was spelled or cased', () => {
    expect(matchRoll(ROLL, 'احمد')[0].line.key).toBe('phone:1001234567');
    expect(matchRoll(ROLL, 'أحمد')[0].line.key).toBe('phone:1001234567');
    expect(matchRoll(ROLL, 'اميره')[0].line.key).toBe('phone:1112223344');
  });

  it('ranks a number above a name: digits identify a human, a name identifies maybe three', () => {
    const hits = matchRoll(ROLL, 'أحمد');
    expect(hits.map((h) => h.line.key)).toEqual(['phone:1001234567', 'name:أحمد']);
  });

  it('reaches a customer with no name and no phone by the address he does have', () => {
    expect(matchRoll(ROLL, 'ali@ex')[0].line.key).toBe('email:ali@example.com');
  });

  it('returns nothing for nothing, and never a made-up candidate', () => {
    expect(matchRoll(ROLL, '')).toEqual([]);
    expect(matchRoll(ROLL, '   ')).toEqual([]);
    expect(matchRoll(ROLL, 'كورنيش')).toEqual([]);
    expect(matchRoll([], 'أحمد')).toEqual([]);
  });

  it('stops guessing after four digits, so «12» cannot name a person', () => {
    expect(matchRoll(ROLL, '12')).toEqual([]);
  });

  it('caps the list it hands to a thumb', () => {
    const wide: RollLine[] = Array.from({ length: 30 }, (_, i) => line({ key: `name:س${i}`, name: 'سامح' }));
    expect(matchRoll(wide, 'سامح')).toHaveLength(8);
    expect(matchRoll(wide, 'سامح', 3)).toHaveLength(3);
  });
});

describe('rollLineLabel', () => {
  it('shows a name and the last digits, never a key', () => {
    expect(rollLineLabel(ROLL[0])).toBe('أحمد محمود · 4567');
    expect(rollLineLabel(ROLL[2])).toBe('أحمد');
    expect(rollLineLabel(ROLL[3])).toBe('ali@example.com');
    expect(rollLineLabel(line({ key: 'x' }))).toBe('من غير اسم');
  });
});
