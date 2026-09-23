/**
 * Qayyim Swarm - Draft live preview
 * GET /api/admin/qayyim/preview/[token]
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
  if (value === null || value === undefined) return '<span class="muted">—</span>';
  if (typeof value === 'string') return `<span class="str">${esc(value)}</span>`;
  if (typeof value === 'number' || typeof value === 'boolean') return `<span class="num">${esc(value)}</span>`;
  if (Array.isArray(value)) {
    return `<ul>${value.map((v) => `<li>${renderValue(v, depth + 1)}</li>`).join('')}</ul>`;
  }
  if (typeof value === 'object') {
    return `<dl>${Object.entries(value)
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${renderValue(v, depth + 1)}</dd>`)
      .join('')}</dl>`;
  }
  return `<span class="str">${esc(String(value))}</span>`;
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

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة مسودة — قيّم الدار</title>
<style>
  body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0d0d12;color:#e5e5e5;margin:0;padding:24px}
  .wrap{max-width:860px;margin:0 auto}
  .badge{display:inline-block;padding:3px 10px;border-radius:8px;font-size:12px;border:1px solid rgba(245,197,107,.4);color:#f5c56b;background:rgba(245,197,107,.08)}
  h1{font-size:20px;margin:16px 0 4px}
  .meta{color:#888;font-size:12px;margin-bottom:20px;direction:ltr;text-align:right}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px}
  .card h2{font-size:13px;color:#f5c56b;margin:0 0 10px}
  dl{margin:0;font-size:13px}
  dt{color:#999;font-size:11px;margin-top:8px}
  dd{margin:2px 0 0;color:#ddd}
  ul{margin:4px 0;padding-right:16px}
  .str{color:#e5e5e5}
  .num{color:#7dd3fc}
  .muted{color:#555}
  .warn{margin-top:20px;padding:12px;border-radius:10px;border:1px solid rgba(245,197,107,.25);background:rgba(245,197,107,.06);font-size:12px;color:#cbb27a}
</style>
</head>
<body>
<div class="wrap">
  <span class="badge">${esc(statusLabel[(draft as any).status] || (draft as any).status)} · v${esc((draft as any).version)}</span>
  <h1>معاينة مسودة: ${esc((draft as any).draft_type || 'content_update')}</h1>
  <div class="meta">${esc((draft as any).target_path || '/')} · ${esc((draft as any).target_table)} · ${esc((draft as any).agent_key || (draft as any).created_by || '')}</div>
  <div class="grid">
    <div class="card">
      <h2>المحتوى الحالي</h2>
      ${renderValue((draft as any).previous)}
    </div>
    <div class="card">
      <h2>المحتوى المقترح</h2>
      ${renderValue((draft as any).proposed ?? (draft as any).content)}
    </div>
  </div>
  <div class="warn">هذه معاينة للمراجعة فقط — لن يظهر التغيير للزوار إلا بعد النشر من لوحة الإدارة.</div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
