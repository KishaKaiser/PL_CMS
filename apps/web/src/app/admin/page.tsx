export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-600">
        Placeholder – restricted to <span className="font-medium">ADMIN</span> role.
      </p>
      <ul className="mt-6 list-disc pl-6 text-gray-700">
        <li>User management</li>
        <li>Module configuration</li>
        <li>Broadcast messages</li>
        <li>Audit log</li>
        <li>Settings</li>
      </ul>
    </main>
  );
}
