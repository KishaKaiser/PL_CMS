import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

const ALLOWED_PATH_PREFIXES = [
  'products',
  'checkout',
  'wallet',
  'shipping',
  'payments',
  'auth',
  'orders',
  'fulfillment',
  'pages',
  'posts',
  'users',
  'settings',
  'audit',
  'admin',
  'account',
  'dashboard',
  'modules',
  'media',
  'messages',
  'forms',
  'sliders',
  'public',
];

type Context = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: Context) {
  const { path } = await params;
  const targetPath = path.join('/');

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

  const auth = req.headers.get('authorization');
  if (auth) {
    headers.set('authorization', auth);
  } else {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    if (token) headers.set('authorization', 'Bearer ' + token);
  }

  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined;

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
