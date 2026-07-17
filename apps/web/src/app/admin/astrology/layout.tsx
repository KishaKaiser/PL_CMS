'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/astrology/orders', label: 'Orders' },
  { href: '/admin/astrology', label: 'Chart Library' },
  { href: '/admin/astrology/synastry', label: 'Synastry' },
  { href: '/admin/astrology/karmic', label: 'Karmic Relationship' },
  { href: '/admin/astrology/karmic-debt', label: 'Karmic Debt' },
  { href: '/admin/astrology/family', label: 'Family' },
  { href: '/admin/astrology/transits', label: 'Transits' },
  { href: '/admin/astrology/electional', label: 'Electional' },
  { href: '/admin/astrology/rectification', label: 'Rectification' },
  { href: '/admin/astrology/blog', label: 'Blog Generator' },
];

export default function AstrologyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="border-b border-gray-200 bg-white px-8 pt-4">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-t px-3 py-2 text-sm font-medium ${
                  active ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
