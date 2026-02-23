import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const upstream = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await upstream.json() as { accessToken?: string; refreshToken?: string; message?: string };

  if (!upstream.ok || !data.accessToken || !data.refreshToken) {
    return NextResponse.json(
      { message: data.message ?? 'Invalid credentials' },
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
