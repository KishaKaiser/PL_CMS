import { NextRequest, NextResponse } from 'next/server';
import { fetchApi } from '../../../../lib/server-api';

async function proxyShipStationCustomStore(req: NextRequest) {
  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);

  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetchApi(`/shipstation/custom-store${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: body ? Buffer.from(body) : undefined,
    });
    const upstreamBody = await upstream.arrayBuffer();
    return new NextResponse(upstreamBody, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'text/xml' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The API service did not respond.';
    return new NextResponse(
      `<?xml version="1.0" encoding="utf-8"?><Error>${message}</Error>`,
      { status: 503, headers: { 'content-type': 'text/xml' } },
    );
  }
}

export const GET = proxyShipStationCustomStore;
export const POST = proxyShipStationCustomStore;
