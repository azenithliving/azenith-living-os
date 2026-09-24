/**
 * P5-M1 brain tests — pure, deterministic, NO network.
 * url-manifest (link truth) + chat-brain (action derivation, finalization).
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { isRealPath, toPath, verifyResponseLinks, keepRealEvidenceUrls, suggestProductLink } from '@/lib/qayyim/url-manifest';
import { deriveActions, finalizeReply } from '@/lib/qayyim/chat-brain';

describe('url-manifest — the site route truth', () => {
  it('accepts real static routes', () => {
    expect(isRealPath('/')).toBe(true);
    expect(isRealPath('/rooms')).toBe(true);
    expect(isRealPath('/furniture')).toBe(true);
    expect(isRealPath('/about')).toBe(true);
    expect(isRealPath('https://azenith-living.vercel.app/rooms')).toBe(true);
    expect(isRealPath('/rooms/')).toBe(true);
  });

  it('rejects hallucinated product paths that never existed', () => {
    expect(isRealPath('/products/sofa-malaki-1790214163150')).toBe(false);
    expect(isRealPath('/product/123')).toBe(false);
    expect(isRealPath('/rooms/no-such-room-xyz')).toBe(false);
    expect(isRealPath('not-a-path')).toBe(false);
  });

  it('normalizes query/hash and full URLs to pathname', () => {
    expect(toPath('https://azenith-living.vercel.app/rooms?x=1#y')).toBe('/rooms');
    expect(toPath('/furniture/sofa/')).toBe('/furniture/sofa');
  });

  it('suggests a real landing for product mentions', () => {
    expect(suggestProductLink(null)).toBe('/furniture');
    expect(suggestProductLink('definitely-not-a-room')).toBe('/furniture');
  });

  it('verifyResponseLinks neutralizes fake paths but keeps real ones', () => {
    const input = 'شاهد الصوفا في /products/sofa-malaki-1790214163150 والتفاصيل في /rooms';
    const { text, removed } = verifyResponseLinks(input, 'https://azenith-living.vercel.app');
    expect(text).toContain('/rooms');
    expect(text).not.toContain('/products/sofa-malaki');
    expect(text).toContain('(رابط غير موثق)');
    expect(removed).toHaveLength(1);
  });

  it('leaves external absolute URLs alone', () => {
    const input = 'مصدر خارجي https://example.com/report.pdf';
    const { removed } = verifyResponseLinks(input, 'https://azenith-living.vercel.app');
    expect(removed).toHaveLength(0);
  });

  it('keepRealEvidenceUrls drops the old /products whitelist hole', () => {
    const urls = ['/products/sofa-1', '/rooms', '/furniture', '/api/admin/qayyim/preview/abc', '/#section'];
    expect(keepRealEvidenceUrls(urls)).toEqual(['/rooms', '/furniture', '/api/admin/qayyim/preview/abc', '/#section']);
  });
});

describe('chat-brain — deterministic action buttons', () => {
  it('extracts quoted imperatives "اكتب لي X" / "قل X"', () => {
    const text = 'خطوات جاهزة:\n• اكتب لي "أصلح وصف صوفا ملكية" وسأنشئ مسودة فوراً\n• اكتب "اقترح صورة" وسأختار هيررو فاخر';
    const actions = deriveActions(text);
    expect(actions).toContain('أصلح وصف صوفا ملكية');
    expect(actions).toContain('اقترح صورة');
  });

  it('extracts quoted bullets as commands', () => {
    const actions = deriveActions('• "انشر المسودة" بعد المعاينة\n• "اعرض المسودات المعلقة"');
    expect(actions.length).toBeGreaterThanOrEqual(2);
  });

  it('caps at 3 actions and dedupes', () => {
    const text = 'اكتب "أفحص" ثم قل "أفحص" ثم اضغط "حسّن" ثم اكتب "انشر" ثم قل "وزّع"';
    const actions = deriveActions(text);
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('returns nothing for plain prose', () => {
    expect(deriveActions('الموقع يبدو جيدًا هذا الأسبوع.')).toEqual([]);
  });

  it('finalizeReply combines link verification and actions', () => {
    const res = finalizeReply('راجع /products/sofa-x أو /rooms — واكتب "افحص SEO" للتنفيذ', 'https://azenith-living.vercel.app');
    expect(res.reply).toContain('/rooms');
    expect(res.unverifiedLinks).toEqual(['/products/sofa-x']);
    expect(res.actions).toEqual(['افحص SEO']);
    expect(res.reply).toContain('رابط غير موثق');
  });
});
