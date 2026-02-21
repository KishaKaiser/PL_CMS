import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-indigo-700">Psychic Link CMS</h1>
      <p className="text-lg text-gray-600">Welcome to the platform.</p>
      <nav className="flex flex-wrap justify-center gap-4">
        <Link href="/login" className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
          Login
        </Link>
        <Link href="/shop" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
          Shop
        </Link>
        <Link href="/admin" className="rounded border px-4 py-2 hover:bg-gray-100">
          Admin
        </Link>
        <Link href="/advisor" className="rounded border px-4 py-2 hover:bg-gray-100">
          Advisor
        </Link>
        <Link href="/client" className="rounded border px-4 py-2 hover:bg-gray-100">
          Client
        </Link>
      </nav>
    </main>
  );
}
