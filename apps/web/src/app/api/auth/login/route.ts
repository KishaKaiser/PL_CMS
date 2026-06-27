import { NextRequest, NextResponse } from 'next/server';
import { fetchApi } from '../../../../lib/server-api';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const upstream = await fetchApi('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json({ message: 'API is unavailable. Check API_BASE_URL or the API service.' }, { status: 503 });
  }

  const data = (await upstream.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; role?: string; message?: string };

  if (!upstream.ok || !data.accessToken || !data.refreshToken) {
    return NextResponse.json(
      { message: data.message ?? 'Invalid credentials' },
      { status: upstream.status },
    );
  }

  const res = NextResponse.json({ ok: true, role: data.role });

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookies.set('access_token', data.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15 minutes
  });

  res.cookies.set('refresh_token', data.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return res;
}
