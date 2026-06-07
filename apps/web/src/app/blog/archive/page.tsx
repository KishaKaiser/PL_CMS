import Link from 'next/link';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { getArchives } from '../../../lib/public-cms';

export const dynamic = 'force-dynamic';

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default async function BlogArchivePage() {
  const archives = await getArchives();

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-bold">Blog archives</h1>
        <p className="mt-2 text-gray-600">Browse posts by publish month.</p>

        <ul className="mt-8 space-y-3">
          {archives.map((archive) => (
            <li key={archive.key}>
              <Link
                href={`/blog/archive/${archive.year}/${String(archive.month).padStart(2, '0')}`}
                className="rounded-lg border bg-white px-4 py-3 text-sm shadow-sm hover:border-indigo-300 hover:text-indigo-700"
              >
                {monthLabel(archive.year, archive.month)} ({archive.count})
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </PublicSiteShell>
  );
}
