import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;
  
  if (path.startsWith('/_next') || path.startsWith('/api')) {
    return new Response(null, { status: 404 });
  }

  const referer = req.headers.get('referer');
  if (referer && referer.includes('/api/omnipotent/proxy')) {
    try {
      const refererUrl = new URL(referer);
      const targetUrlStr = refererUrl.searchParams.get('url') || refererUrl.pathname.split('/v2/')[1]?.replace(/^https\//, 'https://').replace(/^http\//, 'http://');
      
      if (targetUrlStr) {
        const targetBase = new URL(targetUrlStr);
        const redirectedUrl = new URL(path + url.search, targetBase.origin);
        const proto = redirectedUrl.protocol.replace(':','');
        const proxyUrl = `/api/omnipotent/proxy/v2/${proto}/${redirectedUrl.host}${redirectedUrl.pathname}${redirectedUrl.search}`;
        return NextResponse.rewrite(new URL(proxyUrl, req.url));
      }
    } catch (e) {}
  }

  return new Response('ARK: Path not manifested.', { status: 404 });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
