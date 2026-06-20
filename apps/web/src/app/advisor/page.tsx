export default function AdvisorPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-3xl font-bold">Advisor Portal</h1>
      <p className="text-gray-600">
        Placeholder – restricted to <span className="font-medium">ADVISOR</span> role.
      </p>
      <ul className="mt-6 list-disc pl-6 text-gray-700">
        <li>Availability schedule</li>
        <li>Call queue</li>
        <li>Active session</li>
        <li>Messages</li>
        <li>Profile settings</li>
      </ul>
      <div className="mt-6">
        <a
          href="/advisor/messages"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Messages →
        </a>
      </div>
    </main>
  );
}
