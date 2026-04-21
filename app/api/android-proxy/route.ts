import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response("Missing URL", { status: 400 });
  }

  try {
    const response = await fetch(targetUrl);
    const body = await response.text();

    // حذف رؤوس الحماية (Security Headers) التي تمنع الـ Embedding
    const headers = new Headers();
    headers.set('Content-Type', 'text/html');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(body, { headers });
  } catch (error) {
    return new Response("Proxy Error", { status: 500 });
  }
}
