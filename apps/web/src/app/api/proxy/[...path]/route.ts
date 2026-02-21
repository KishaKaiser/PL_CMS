import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

/**
 * Allowlist of upstream path prefixes the proxy is permitted to forward.
 * Requests to any other paths are rejected with 403 to reduce attack surface.
 */
const ALLOWED_PATH_PREFIXES = [
  'products',
  'checkout',
  'wallet',
  'shipping',
  'payments',
  'auth',
  'orders',
];

type Context = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: Context) {
  const { path } = await params;
  const targetPath = path.join('/');

  // Enforce path allowlist
  const isAllowed = ALLOWED_PATH_PREFIXES.some(
    (prefix) => targetPath === prefix || targetPath.startsWith(`${prefix}/`),
  );
  if (!isAllowed) {
    return new NextResponse(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const search = req.nextUrl.search ?? '';
  const url = `${API_BASE}/${targetPath}${search}`;

  const headers = new Headers();

  // Forward Authorization header if present (set by client-side JS from stored token)
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);

  // Forward cookies so cookie-based auth also works from browser requests
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.arrayBuffer()
      : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  });

  const upstreamBody = await upstream.arrayBuffer();
  return new NextResponse(upstreamBody, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
