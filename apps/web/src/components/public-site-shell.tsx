import Link from 'next/link';
import {
  getSafeImageSrc,
  getPublicSiteConfig,
  type PublicSiteConfig,
} from '../lib/public-cms';
import { BuilderContent } from './cms/builder-content';

type Props = {
  children: React.ReactNode;
  siteConfig?: PublicSiteConfig;
  showHeader?: boolean;
  showFooter?: boolean;
};

export async function PublicSiteShell({ children, siteConfig, showHeader = true, showFooter = true }: Props) {
  const config = siteConfig ?? (await getPublicSiteConfig());
  const logo = getSafeImageSrc(config.identity.logoUrl);
  const headerLinks = config.menus.header;
  const footerLinks = config.menus.footer;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900" style={{ fontFamily: config.theme.fontFamily }}>
      <a href="#public-main-content" className="sr-only rounded px-3 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:shadow">
        Skip to content
      </a>
      {showHeader && (
        config.themeLayouts.header ? (
          <header className="border-b bg-white">
            <BuilderContent layout={config.themeLayouts.header} showChrome={false} />
          </header>
        ) : (
          <header className="border-b bg-white">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                {logo && <img src={logo} alt={config.identity.title} className="h-12 w-12 rounded object-cover" />}
                <div>
                  <Link href="/" className="text-xl font-semibold hover:opacity-90" style={{ color: config.theme.primaryColor }}>
                    {config.identity.title}
                  </Link>
                  <p className="text-sm text-gray-500">{config.identity.tagline}</p>
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-3 text-sm">
                {headerLinks.map((item) => (
                  <Link key={`${item.href}:${item.label}`} href={item.href} className="rounded px-3 py-2 hover:bg-gray-100">
                    {item.label}
                  </Link>
                ))}
                <Link href="/admin" className="rounded px-3 py-2 hover:bg-gray-100">
                  Admin
                </Link>
              </nav>
            </div>
          </header>
        )
      )}

      <div id="public-main-content" className="flex-1">{children}</div>

      {showFooter && (
        config.themeLayouts.footer ? (
          <footer className="border-t bg-white">
            <BuilderContent layout={config.themeLayouts.footer} showChrome={false} />
          </footer>
        ) : (
          <footer className="border-t bg-white">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-6 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
              <p>{config.identity.footerText}</p>
              <div className="flex flex-wrap gap-4">
                {footerLinks.map((item) => (
                  <Link key={`${item.href}:${item.label}`} href={item.href} className="hover:underline" style={{ color: config.theme.primaryColor }}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </footer>
        )
      )}
    </div>
  );
}
