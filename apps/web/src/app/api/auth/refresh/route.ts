import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchApi } from '../../../../lib/server-api';

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  const upstream = await fetchApi('/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json({ message: 'API is unavailable. Check API_BASE_URL or the API service.' }, { status: 503 });
  }

  const data = (await upstream.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; message?: string };

  if (!upstream.ok || !data.accessToken || !data.refreshToken) {
    return NextResponse.json(
      { message: data.message ?? 'Refresh failed' },
      { status: upstream.status },
    );
  }

  const res = NextResponse.json({ ok: true });
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookies.set('access_token', data.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });

  res.cookies.set('refresh_token', data.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
