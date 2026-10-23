import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { fetchApi } from '../../../../lib/server-api';

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
  'advisors',
  'billing',
  'phone',
  'appointments',
  'callbacks',
  'phone-audio',
  'account',
  'dashboard',
  'modules',
  'media',
  'messages',
  'contact-lists',
  'free-minutes',
  'payouts',
  'advisor-applications',
  'advisor-onboarding',
  'forms',
  'sliders',
  'newsletter',
  'store',
  'astrology',
  'public',
  'candles',
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
  const headers = new Headers();

  const auth = req.headers.get('authorization');
  if (auth) {
    headers.set('authorization', auth);
  } else {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    if (token) headers.set('authorization', 'Bearer ' + token);
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetchApi(`/${targetPath}${search}`, {
      method: req.method,
      headers,
      body: body ? Buffer.from(body) : undefined,
    });

    const upstreamBody = await upstream.arrayBuffer();

    // Using the emailed onboarding link sets the advisor's password and signs them in: the API returns the sign-in tokens, and
    // they are kept here as the usual cookies instead of being handed to the page. (This path is used rather than a separate
    // /api/auth/ route because the server in front of the site sends only /api/proxy/ and a few fixed /api/auth/ paths here.)
    if (upstream.ok && req.method === 'POST' && targetPath === 'advisor-onboarding/activate') {
      try {
        const data = JSON.parse(Buffer.from(upstreamBody).toString('utf8')) as { accessToken?: string; refreshToken?: string; role?: string };
        if (data.accessToken && data.refreshToken) {
          const res = NextResponse.json({ ok: true, role: data.role });
          // Cookies are only marked secure when the visitor really came in over https, so the site also works over plain http.
          const secure = process.env.NODE_ENV === 'production' && (req.headers.get('x-forwarded-proto') ?? '') === 'https';
          res.cookies.set('access_token', data.accessToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 15 });
          res.cookies.set('refresh_token', data.refreshToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
          return res;
        }
      } catch {
        // fall through and return the response as it came
      }
    }

    const responseHeaders: Record<string, string> = { 'content-type': upstream.headers.get('content-type') ?? 'application/json' };
    // Downloads (such as onboarding forms) keep their file name, and are never cached.
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) {
      responseHeaders['content-disposition'] = disposition;
      responseHeaders['cache-control'] = 'no-store';
    }
    return new NextResponse(upstreamBody, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The API service did not respond.';
    return NextResponse.json(
      { message: `Internal API request failed: ${message}` },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
