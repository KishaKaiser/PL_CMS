import { AdvisorClients } from '../../../components/advisor-clients';
import { PublicSiteShell } from '../../../components/public-site-shell';

export default function AdvisorClientsPage() {
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-6xl p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">My clients</h1>
            <p className="mt-1 text-sm text-gray-600">
              The clients you have spoken with. Group them into lists to write to them together, or send free minutes.
            </p>
          </div>
          <div className="flex gap-4 text-sm font-medium text-indigo-600">
            <a href="/advisor/messages" className="hover:underline">Messages</a>
            <a href="/advisor" className="hover:underline">Dashboard</a>
          </div>
        </div>
        <AdvisorClients />
      </main>
    </PublicSiteShell>
  );
}
