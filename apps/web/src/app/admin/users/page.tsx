'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  username?: string | null;
  name: string;
  role: string;
  createdAt: string;
}

interface UserForm {
  name: string;
  username: string;
  email: string;
  role: string;
}

interface CreateUserForm extends UserForm {
  password: string;
}

const ROLES = ['ADMIN', 'EDITOR', 'ADVISOR', 'CLIENT'];
const emptyUserForm: UserForm = {
  name: '',
  username: '',
  email: '',
  role: 'CLIENT',
};
const emptyCreateForm: CreateUserForm = {
  ...emptyUserForm,
  password: '',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetForms, setResetForms] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(emptyUserForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/users');
      if (!res.ok) throw new Error('Failed to load users');
      setUsers((await res.json()) as User[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  function startEdit(user: User) {
    setError('');
    setNotice('');
    setExpandedId(null);
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      username: user.username ?? '',
      email: user.email,
      role: user.role,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyUserForm);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (createForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/proxy/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanUserPayload(createForm)),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'User creation failed'));
      const created = (await res.json()) as User;
      setUsers((currentUsers) => [created, ...currentUsers]);
      setCreateForm(emptyCreateForm);
      setShowCreateForm(false);
      setNotice('User account created.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating user');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingUserId(id);
    try {
      const res = await fetch(`/api/proxy/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanUserPayload(editForm)),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'User update failed'));
      const updated = (await res.json()) as User;
      setUsers((currentUsers) => currentUsers.map((user) => (user.id === id ? updated : user)));
      cancelEdit();
      setNotice('User account updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleDeleteUser(user: User) {
    if (!confirm(`Delete ${user.username || user.name}? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    setSavingUserId(user.id);
    try {
      const res = await fetch(`/api/proxy/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        throw new Error(await readErrorMessage(res, 'User delete failed'));
      }
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
      if (editingId === user.id) cancelEdit();
      setNotice('User account deleted.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting user');
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleResetPassword(id: string) {
    const newPassword = resetForms[id] ?? '';
    if (newPassword.length < 8) {
      setResetErrors((currentErrors) => ({
        ...currentErrors,
        [id]: 'Password must be at least 8 characters',
      }));
      return;
    }
    setResetErrors((currentErrors) => ({ ...currentErrors, [id]: '' }));
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/proxy/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Reset failed'));
      setResetForms((currentForms) => ({ ...currentForms, [id]: '' }));
      setExpandedId(null);
      setNotice('Password updated.');
    } catch (err: unknown) {
      setResetErrors((currentErrors) => ({
        ...currentErrors,
        [id]: err instanceof Error ? err.message : 'Error',
      }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Add accounts, update profile details, change roles, reset passwords, and delete users.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm((currentValue) => !currentValue);
            setEditingId(null);
            setError('');
            setNotice('');
          }}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel New User' : 'Add New User'}
        </button>
      </div>

      {notice && <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p>}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {showCreateForm && (
        <section className="mb-6 rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Add User</h2>
          <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 md:grid-cols-2">
            <UserFormFields form={createForm} onChange={setCreateForm} />
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                required
                type="password"
                minLength={8}
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((currentForm) => ({ ...currentForm, password: event.target.value }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">No users found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['User', 'Role', 'Created', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t align-top">
                  <td className="px-4 py-4">
                    {editingId === user.id ? (
                      <form
                        id={`edit-user-${user.id}`}
                        onSubmit={(event) => void handleUpdateUser(event, user.id)}
                        className="grid gap-4 md:grid-cols-2"
                      >
                        <UserFormFields form={editForm} onChange={setEditForm} compact />
                      </form>
                    ) : (
                      <div>
                        <p className="font-medium text-gray-900">{user.username || user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        {user.username && <p className="text-xs text-gray-400">{user.name}</p>}
                      </div>
                    )}
                    {expandedId === user.id && (
                      <div className="mt-4 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 md:flex-row md:items-center">
                        <input
                          type="password"
                          placeholder="New password (min 8 chars)"
                          value={resetForms[user.id] ?? ''}
                          onChange={(event) =>
                            setResetForms((currentForms) => ({
                              ...currentForms,
                              [user.id]: event.target.value,
                            }))
                          }
                          className="flex-1 rounded border px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void handleResetPassword(user.id)}
                          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                        >
                          Set Password
                        </button>
                        {resetErrors[user.id] && (
                          <span className="text-xs text-red-600">{resetErrors[user.id]}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {editingId === user.id ? (
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                        Editing
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">
                    {new Date(user.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    {editingId === user.id ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          form={`edit-user-${user.id}`}
                          disabled={savingUserId === user.id}
                          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {savingUserId === user.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded bg-gray-100 px-3 py-1.5 text-xs hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="rounded bg-gray-100 px-3 py-1.5 text-xs hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedId((id) => (id === user.id ? null : user.id))}
                          className="rounded bg-gray-100 px-3 py-1.5 text-xs hover:bg-gray-200"
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(user)}
                          disabled={savingUserId === user.id}
                          className="rounded bg-red-100 px-3 py-1.5 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserFormFields<T extends UserForm>({
  form,
  onChange,
  compact = false,
}: {
  form: T;
  onChange: Dispatch<SetStateAction<T>>;
  compact?: boolean;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          required
          value={form.name}
          onChange={(event) =>
            onChange((currentForm) => ({ ...currentForm, name: event.target.value }))
          }
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Username</label>
        <input
          value={form.username}
          onChange={(event) =>
            onChange((currentForm) => ({ ...currentForm, username: event.target.value }))
          }
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          placeholder="client123"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) =>
            onChange((currentForm) => ({ ...currentForm, email: event.target.value }))
          }
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <div className={compact ? '' : undefined}>
        <label className="block text-sm font-medium text-gray-700">Role</label>
        <select
          value={form.role}
          onChange={(event) =>
            onChange((currentForm) => ({ ...currentForm, role: event.target.value }))
          }
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function cleanUserPayload<T extends UserForm>(form: T) {
  return {
    ...form,
    name: form.name.trim(),
    username: form.username.trim() || null,
    email: form.email.trim(),
  };
}

async function readErrorMessage(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(', ');
  return data.message ?? fallback;
}
