'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', exact: true },
      { href: '/admin/audit', label: 'Audit Log' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/pages', label: 'Pages' },
      { href: '/admin/posts', label: 'Posts' },
      { href: '/admin/forms', label: 'Forms' },
      { href: '/admin/newsletter', label: 'Newsletter' },
      { href: '/admin/menus', label: 'Menus' },
      { href: '/admin/sidebars', label: 'Sidebars' },
      { href: '/admin/sliders', label: 'Sliders' },
      { href: '/admin/taxonomies', label: 'Categories & Tags' },
      { href: '/admin/media', label: 'Media Library' },
      { href: '/admin/theme-builder', label: 'Theme Builder' },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/admin/products', label: 'Products' },
      { href: '/admin/orders', label: 'Orders' },
      { href: '/admin/store', label: 'Store Settings' },
      { href: '/admin/settings/shipping', label: 'Shipping' },
      { href: '/admin/google-merchant', label: 'Google Merchant' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/messages', label: 'Messages' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/modules', label: 'Modules' },
      { href: '/admin/settings', label: 'Settings' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullScreenEditor = pathname.startsWith('/admin/theme-builder') || pathname.startsWith('/admin/sliders');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (isFullScreenEditor) {
    return <main className="min-h-screen bg-gray-100">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-gray-900 text-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700">
          <span className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Admin
          </span>
          <div className="mt-2">
            <Link href="/" className="text-xs text-gray-300 hover:text-white hover:underline">
              ← View public site
            </Link>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-5 px-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  {group.label}
                </h2>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          }`}
                          aria-current={active ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
