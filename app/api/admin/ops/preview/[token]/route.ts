/**
 * Qayyim Swarm - Draft live preview
 * GET /api/admin/ops/preview/[token]
 *
 * Renders a minimal HTML preview of the draft's proposed content so admins
 * can review changes before publishing. Token expires per preview_expires_at.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDraftByPreviewToken } from "@/lib/qayyim-ops";

export const dynamic = "force-dynamic";

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderValue(value: any, depth = 0): string {
  if (value === null || value === undefined) return '<span class="muted">— لا يوجد</span>';
  if (typeof value === 'string') {
    if (value.trim() === '') return '<span class="muted">— فارغ</span>';
    return `<div class="text-block">${esc(value)}</div>`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return `<span class="num">${esc(value)}</span>`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="muted">— لا عناصر</span>';
    return `<ul>${value.map((v) => `<li>${renderValue(v, depth + 1)}</li>`).join('')}</ul>`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '<span class="muted">— فارغ</span>';
    return `<dl>${Object.entries(value)
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${renderValue(v, depth + 1)}</dd>`)
      .join('')}</dl>`;
  }
  return `<span class="str">${esc(String(value))}</span>`;
}

function renderDiff(previous: any, proposed: any): string {
  const prev = previous || {};
  const next = proposed || {};
  const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  if (allKeys.length === 0) return '<span class="muted">— لا محتوى</span>';
  return allKeys.map(k => {
    const a = prev[k];
    const b = next[k];
    const changed = JSON.stringify(a) !== JSON.stringify(b);
    const cls = changed ? 'changed' : '';
    return `<div class="diff-row ${cls}"><dt>${esc(k)} ${changed ? '<span class="change-badge">تغير</span>' : ''}</dt><dd>${changed ? `<div class="diff-prev">${renderValue(a)}</div><div class="arrow">↓</div><div class="diff-next">${renderValue(b)}</div>` : renderValue(b)}</dd></div>`;
  }).join('');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const draft = await getDraftByPreviewToken(token);

  if (!draft) {
    return new NextResponse(
      '<html dir="rtl"><body style="font-family:sans-serif;background:#0d0d12;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh"><div><h1>المعاينة غير متاحة</h1><p>الرابط منتهي الصلاحية أو غير صالح.</p></div></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const statusLabel: Record<string, string> = {
    draft: 'مسودة', previewing: 'قيد المعاينة', published: 'منشور',
    rejected: 'مرفوض', rolled_back: 'متراجع عنه',
  };

  const prev = (draft as any).previous || {};
  const prop = (draft as any).proposed ?? (draft as any).content ?? {};
  const hasPrev = prev && Object.keys(prev).length > 0;
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة مسودة — قيّم الدار</title>
<style>
  body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0d0d12;color:#e5e5e5;margin:0;padding:24px;line-height:1.6}
  .wrap{max-width:960px;margin:0 auto}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;border:1px solid rgba(245,197,107,.4);color:#f5c56b;background:rgba(245,197,107,.08)}
  h1{font-size:22px;margin:16px 0 4px}
  .meta{color:#888;font-size:12px;margin-bottom:20px;direction:ltr;text-align:right}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px}
  .card h2{font-size:13px;color:#f5c56b;margin:0 0 10px}
  .card.current{border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.05)}
  .card.proposed{border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05)}
  dl{margin:0;font-size:13px}
  dt{color:#f5c56b;font-size:11px;margin-top:10px;font-weight:bold}
  dd{margin:4px 0 0;color:#ddd;background:rgba(0,0,0,.2);padding:8px;border-radius:8px}
  ul{margin:4px 0;padding-right:16px}
  .str{color:#e5e5e5}
  .text-block{white-space:pre-wrap;background:rgba(255,255,255,.04);padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.06);line-height:1.7}
  .num{color:#7dd3fc}
  .muted{color:#666;font-style:italic}
  .warn{margin-top:20px;padding:14px;border-radius:12px;border:1px solid rgba(245,197,107,.25);background:rgba(245,197,107,.06);font-size:12px;color:#cbb27a}
  .diff-row{margin-bottom:12px;padding:8px;border-radius:8px}
  .diff-row.changed{background:rgba(245,197,107,.06);border:1px dashed rgba(245,197,107,.2)}
  .change-badge{font-size:9px;background:#f5c56b;color:#000;padding:1px 6px;border-radius:10px;margin-right:6px}
  .diff-prev{opacity:.6;text-decoration:line-through;background:rgba(239,68,68,.08);padding:6px;border-radius:6px;margin-bottom:4px}
  .diff-next{background:rgba(16,185,129,.08);padding:6px;border-radius:6px;border:1px solid rgba(16,185,129,.2)}
  .arrow{text-align:center;color:#f5c56b;font-size:14px;margin:2px 0}
  .legend{display:flex;gap:12px;justify-content:center;margin:16px 0;font-size:11px;color:#888}
  .legend span{display:flex;align-items:center;gap:4px}
  .dot{width:8px;height:8px;border-radius:50%}
  .dot.before{background:#ef4444}
  .dot.after{background:#10b981}
</style>
</head>
<body>
<div class="wrap">
  <span class="badge">${esc(statusLabel[(draft as any).status] || (draft as any).status)} · v${esc((draft as any).version)} · ${esc((draft as any).draft_type || 'content_update')}</span>
  <h1>معاينة مسودة: ${esc((draft as any).draft_type || 'content_update')}</h1>
  <div class="meta">${esc((draft as any).target_path || '/')} · ${esc((draft as any).target_table)} · ${esc((draft as any).created_by || (draft as any).agent_key || '')}</div>
  <div class="legend"><span><span class="dot before"></span> قبل</span><span><span class="dot after"></span> بعد</span><span>— ما سيراه الزائر بعد النشر</span></div>
  ${hasPrev ? `
  <div class="grid">
    <div class="card current">
      <h2>⬅ المحتوى الحالي (قبل)</h2>
      ${renderValue(prev)}
    </div>
    <div class="card proposed">
      <h2>المحتوى المقترح (بعد) ➡</h2>
      ${renderValue(prop)}
    </div>
  </div>
  <div style="margin-top:16px" class="card">
    <h2>🔍 مقارنة التغييرات (Diff)</h2>
    ${renderDiff(prev, prop)}
  </div>
  ` : `
  <div class="card proposed">
    <h2>المحتوى المقترح (جديد)</h2>
    ${renderValue(prop)}
  </div>
  `}
  <div class="warn">هذه معاينة للمراجعة فقط — لن يظهر التغيير للزوار إلا بعد النشر من لوحة الإدارة. اضغط "نشر" في تبويب المسودات للموافقة.</div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
