import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseCandidates } from '../../../../lib/server-api';

/**
 * An approved advisor sets their password from the emailed onboarding link. The API checks the link and returns the same
 * tokens a normal sign-in would, which are stored here as the usual cookies so they land on their checklist signed in.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const upstream = await postToApi(body);
  if (!upstream) {
    return NextResponse.json({ message: 'API is unavailable. Check API_BASE_URL or the API service.' }, { status: 503 });
  }

  const data = (await upstream.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; role?: string; message?: string | string[] };
  if (!upstream.ok || !data.accessToken || !data.refreshToken) {
    const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    return NextResponse.json({ message: message ?? 'This link could not be used.' }, { status: upstream.ok ? 400 : upstream.status });
  }

  const res = NextResponse.json({ ok: true, role: data.role });
  // Cookies are only marked secure when the visitor really came in over https, so the site also works over plain http.
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? '';
  const secure = process.env.NODE_ENV === 'production' && forwardedProto === 'https';

  res.cookies.set('access_token', data.accessToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 15 });
  res.cookies.set('refresh_token', data.refreshToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}

async function postToApi(body: unknown) {
  let fallback: Response | null = null;
  for (const base of getApiBaseCandidates()) {
    try {
      const response = await fetch(`${base}/advisor-onboarding/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (![404, 500, 502, 503, 504].includes(response.status)) return response;
      fallback = response;
    } catch {
      continue;
    }
  }
  return fallback;
}
