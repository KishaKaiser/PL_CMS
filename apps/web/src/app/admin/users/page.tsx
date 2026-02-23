'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLES = ['ADMIN', 'ADVISOR', 'CLIENT'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetForms, setResetForms] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/users');
      if (!res.ok) throw new Error('Failed to load users');
      setUsers(await res.json() as User[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  async function handleRoleChange(id: string, role: string) {
    try {
      const res = await fetch(`/api/proxy/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Role update failed');
      const updated = await res.json() as User;
      setUsers((us) => us.map((u) => (u.id === id ? updated : u)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating role');
    }
  }

  async function handleResetPassword(id: string) {
    const newPassword = resetForms[id] ?? '';
    if (newPassword.length < 8) {
      setResetErrors((e) => ({ ...e, [id]: 'Password must be at least 8 characters' }));
      return;
    }
    setResetErrors((e) => ({ ...e, [id]: '' }));
    try {
      const res = await fetch(`/api/proxy/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) throw new Error('Reset failed');
      setResetForms((f) => ({ ...f, [id]: '' }));
      setExpandedId(null);
    } catch (err: unknown) {
      setResetErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Error' }));
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Users</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-gray-500">Loading…</p> : users.length === 0 ? (
        <p className="text-gray-500">No users found.</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{user.name}</span>
                  <span className="ml-3 text-sm text-gray-500">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    onClick={() => setExpandedId((id) => (id === user.id ? null : user.id))}
                    className="rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200"
                  >
                    Reset Password
                  </button>
                </div>
              </div>
              {expandedId === user.id && (
                <div className="border-t px-4 py-3 bg-gray-50 flex items-center gap-3">
                  <input
                    type="password"
                    placeholder="New password (min 8 chars)"
                    value={resetForms[user.id] ?? ''}
                    onChange={(e) => setResetForms((f) => ({ ...f, [user.id]: e.target.value }))}
                    className="flex-1 rounded border px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                  >
                    Set Password
                  </button>
                  {resetErrors[user.id] && (
                    <span className="text-xs text-red-600">{resetErrors[user.id]}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
