import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseCandidates } from '../../../../lib/server-api';

const RETRYABLE_UPSTREAM_STATUSES = new Set([404, 500, 502, 503, 504]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const upstream = await postLoginToApi(body);

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

async function postLoginToApi(body: unknown) {
  let fallbackResponse: Response | null = null;

  for (const base of getApiBaseCandidates()) {
    try {
      const response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!RETRYABLE_UPSTREAM_STATUSES.has(response.status)) return response;
      fallbackResponse = response;
    } catch {
      continue;
    }
  }

  return fallbackResponse;
}
