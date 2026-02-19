export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-indigo-700">Psychic Link CMS</h1>
      <p className="text-lg text-gray-600">Welcome to the platform.</p>
      <nav className="flex gap-4">
        <a href="/login" className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
          Login
        </a>
        <a href="/admin" className="rounded border px-4 py-2 hover:bg-gray-100">
          Admin
        </a>
        <a href="/advisor" className="rounded border px-4 py-2 hover:bg-gray-100">
          Advisor
        </a>
        <a href="/client" className="rounded border px-4 py-2 hover:bg-gray-100">
          Client
        </a>
      </nav>
    </main>
  );
}
