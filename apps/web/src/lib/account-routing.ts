export type AccountRole = string | null | undefined;

export function getDashboardPathForRole(role: AccountRole) {
  const normalized = role?.toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'EDITOR') return '/admin';
  if (normalized === 'ADVISOR') return '/advisor';
  return '/client';
}

export function decodeJwtPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as { role?: string; exp?: number };
  } catch {
    return null;
  }
}

export function getAccountLinkFromToken(token?: string) {
  const payload = token ? decodeJwtPayload(token) : null;
  const now = Math.floor(Date.now() / 1000);
  if (!payload || (payload.exp && payload.exp < now)) {
    return { label: 'Login', href: '/login', isLoggedIn: false };
  }

  return {
    label: 'Account',
    href: getDashboardPathForRole(payload.role),
    isLoggedIn: true,
  };
}
