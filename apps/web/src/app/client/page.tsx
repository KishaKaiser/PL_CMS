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
    </main>
  );
}
