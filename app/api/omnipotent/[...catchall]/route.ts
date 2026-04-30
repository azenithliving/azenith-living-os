import { NextResponse, NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ catchall: string[] }> };

export async function GET(req: NextRequest, _context: RouteContext) {
  return handleCatchAll(req);
}

export async function POST(req: NextRequest, _context: RouteContext) {
  return handleCatchAll(req);
}

async function handleCatchAll(req: NextRequest) {
  const referer = req.headers.get('referer');
  if (!referer) return new Response('Not found (No referer)', { status: 404 });

  try {
    const refererUrl = new URL(referer);
    const targetUrlParam = refererUrl.searchParams.get('url');
    
    if (targetUrlParam) {
      const targetBase = new URL(targetUrlParam);
      const relativePath = req.nextUrl.pathname.replace('/api/omnipotent/', '');
      const finalTargetUrl = new URL(relativePath, targetBase.origin).href;
      
      console.log(`[Omni-CatchAll] Redirecting 404 to Proxy: ${finalTargetUrl}`);
      
      // We don't redirect, we just tell the browser to try again with the full proxy URL
      // Actually, it's better to fetch it directly here to be transparent
      const proxyUrl = `/api/omnipotent/proxy?url=${encodeURIComponent(finalTargetUrl)}`;
      return NextResponse.redirect(new URL(proxyUrl, req.url));
    }
  } catch (e) {
    console.error("[Omni-CatchAll Error]", e);
  }

  return new Response('Not found', { status: 404 });
}
