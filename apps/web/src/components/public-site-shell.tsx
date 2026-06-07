import Link from 'next/link';
import { getPublishedPages, type PublicPage } from '../lib/public-cms';

const MAX_FOOTER_PAGES = 3;

type Props = {
  children: React.ReactNode;
  pages?: PublicPage[];
};

export async function PublicSiteShell({ children, pages }: Props) {
  const navPages = pages ?? (await getPublishedPages('home'));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-xl font-semibold text-indigo-700 hover:text-indigo-800">
              Psychic Link CMS
            </Link>
            <p className="text-sm text-gray-500">Public CMS frontend powered by published content.</p>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/" className="rounded px-3 py-2 hover:bg-gray-100">
              Home
            </Link>
            <Link href="/blog" className="rounded px-3 py-2 hover:bg-gray-100">
              Blog
            </Link>
            {navPages.map((page) => (
              <Link key={page.id} href={`/${page.slug}`} className="rounded px-3 py-2 hover:bg-gray-100">
                {page.title}
              </Link>
            ))}
            <Link href="/admin" className="rounded px-3 py-2 hover:bg-gray-100">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-6 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <p>Browse published pages and blog posts managed in the CMS.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className="hover:text-indigo-700">
              Home
            </Link>
            <Link href="/blog" className="hover:text-indigo-700">
              Blog
            </Link>
            {navPages.slice(0, MAX_FOOTER_PAGES).map((page) => (
              <Link key={page.id} href={`/${page.slug}`} className="hover:text-indigo-700">
                {page.title}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
