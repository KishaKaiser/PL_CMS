'use client';

import { useEffect, useRef, useState } from 'react';

export type StorefrontLink = {
  label: string;
  href: string;
};

export type StorefrontIconLink = StorefrontLink & {
  iconClass: string;
};

export function AnnouncementBar({
  text,
  background,
  color,
}: {
  text: string;
  background: string;
  color: string;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center gap-4 px-5 py-3 text-center text-sm font-semibold"
      style={{ background, color }}
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Close announcement"
        className="absolute right-5 text-2xl leading-none opacity-90 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export function StorefrontHeader({
  logoText,
  logoSrc,
  logoAlt,
  socialLinks,
  topLinks,
  navLinks,
  actionLinks,
  showActions,
  stickyMain,
}: {
  logoText: string;
  logoSrc?: string;
  logoAlt?: string;
  socialLinks: StorefrontIconLink[];
  topLinks: StorefrontLink[];
  navLinks: StorefrontLink[];
  actionLinks: StorefrontIconLink[];
  showActions: boolean;
  stickyMain?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const mainRowRef = useRef<HTMLDivElement | null>(null);
  const [mainRowHeight, setMainRowHeight] = useState(0);

  useEffect(() => {
    if (!stickyMain) {
      setStuck(false);
      return;
    }

    const row = mainRowRef.current;
    if (!row) return;
    const rowElement = row;
    const top = rowElement.getBoundingClientRect().top + window.scrollY;

    function updateStickyState() {
      setMainRowHeight(rowElement.offsetHeight);
      setStuck(window.scrollY > top);
    }

    updateStickyState();
    window.addEventListener('scroll', updateStickyState, { passive: true });
    window.addEventListener('resize', updateStickyState);
    return () => {
      window.removeEventListener('scroll', updateStickyState);
      window.removeEventListener('resize', updateStickyState);
    };
  }, [stickyMain]);

  return (
    <header className="bg-white">
      <div className="flex flex-wrap items-center gap-7 bg-neutral-900 px-6 py-5 text-sm font-medium text-white lg:px-12">
        {socialLinks.map((link) => (
          <a key={`${link.iconClass}-${link.href}`} href={link.href} aria-label={link.label} className="hover:text-purple-200">
            <i className={link.iconClass} />
          </a>
        ))}
        {topLinks.map((link) => (
          <a key={link.href} href={link.href} className="hover:underline">
            {link.label}
          </a>
        ))}
      </div>

      {stuck && <div style={{ height: mainRowHeight }} />}
      <div
        ref={mainRowRef}
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 bg-white px-6 py-6 lg:grid-cols-[1fr_auto_1fr] lg:px-12 lg:py-8 ${
          stuck ? 'fixed left-0 right-0 top-0 z-50 border-b border-gray-100 shadow-md' : stickyMain ? 'z-40 border-b border-gray-100 shadow-sm' : ''
        }`}
      >
        <nav className="flex items-center gap-6 text-base text-neutral-800">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="text-2xl hover:text-purple-700"
          >
            <i className="fa-solid fa-bars" />
          </button>
          <div className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-purple-700">
                {link.label}
              </a>
            ))}
          </div>
        </nav>

        <a href="/" className="justify-self-center">
          {logoSrc ? (
            <img src={logoSrc} alt={logoAlt || logoText} className="max-h-16 max-w-[220px] object-contain" />
          ) : (
            <span className="text-center font-serif text-3xl italic text-black">{logoText}</span>
          )}
        </a>

        {showActions && (
          <div className="flex items-center gap-5 text-neutral-900 lg:justify-end lg:gap-7">
            {actionLinks.map((link) => (
              <a key={`${link.iconClass}-${link.href}`} href={link.href} aria-label={link.label} className="hover:text-purple-700">
                {link.iconClass === 'text' ? <span className="text-base">{link.label}</span> : <i className={`${link.iconClass} text-2xl`} />}
              </a>
            ))}
          </div>
        )}
      </div>

      {menuOpen && (
        <nav className={`${stuck ? 'fixed left-0 right-0 z-50 shadow-md' : ''} border-t border-gray-200 bg-white px-6 py-4 lg:hidden`} style={stuck ? { top: mainRowHeight } : undefined}>
          <div className="grid gap-3">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="rounded px-2 py-2 text-base font-medium text-neutral-800 hover:bg-purple-50 hover:text-purple-700">
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
