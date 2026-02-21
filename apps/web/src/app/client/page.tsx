export default function ClientPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-3xl font-bold">Client Portal</h1>
      <p className="text-gray-600">
        Placeholder – restricted to <span className="font-medium">CLIENT</span> role.
      </p>
      <ul className="mt-6 list-disc pl-6 text-gray-700">
        <li>Browse advisors</li>
        <li>Join call queue</li>
        <li>Messages</li>
        <li>Call history</li>
        <li>Account &amp; balance</li>
      </ul>
      <div className="mt-6 flex gap-3">
        <a
          href="/client/shop"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Buy Minutes →
        </a>
        <a
          href="/client/orders"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          My Orders →
        </a>
        <a
          href="/client/session"
          className="rounded border px-4 py-2 text-sm hover:bg-gray-100"
        >
          Active Session →
        </a>
      </div>
    </main>
  );
}
