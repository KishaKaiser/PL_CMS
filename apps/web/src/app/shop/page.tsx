import Link from 'next/link';
import { getSafeImageSrc } from '../../lib/public-cms';

interface Product {
  id: string;
  name: string;
  shortDescription?: string | null;
  description?: string;
  imageUrl?: string | null;
  featuredMedia?: { url: string; altText?: string | null; title?: string | null } | null;
  price: string | number;
  currency: string;
  minutesPack: number;
  isActive: boolean;
}

async function getProducts(): Promise<Product[]> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
  try {
    const res = await fetch(`${apiBase}/products`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold">Shop</h1>
          <p className="text-gray-600">Browse our available minute packs and products.</p>
        </div>
        <Link
          href="/shop/cart"
          className="rounded border border-purple-300 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
        >
          View Cart
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">No products available at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-lg border bg-white p-5 shadow-sm"
            >
              {getSafeImageSrc(p.featuredMedia?.url ?? p.imageUrl) && (
                <img
                  src={getSafeImageSrc(p.featuredMedia?.url ?? p.imageUrl) ?? ''}
                  alt={p.featuredMedia?.altText || p.featuredMedia?.title || p.name}
                  className="mb-4 h-44 w-full rounded-md object-cover"
                />
              )}
              <h2 className="text-lg font-semibold">{p.name}</h2>
              {(p.shortDescription || p.description) && (
                <p className="mt-1 flex-1 text-sm text-gray-500">{p.shortDescription || p.description}</p>
              )}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-purple-700">
                  ${Number(p.price).toFixed(2)}
                </span>
                <span className="text-sm text-gray-400">{p.currency}</span>
              </div>
              {p.minutesPack > 0 && (
                <p className="mt-1 text-sm font-medium text-green-700">
                  {p.minutesPack} minutes included
                </p>
              )}
              <Link
                href={`/shop/${p.id}`}
                className="mt-4 rounded bg-purple-600 py-2 text-center text-sm text-white hover:bg-purple-700"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/" className="text-sm text-purple-600 hover:underline">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
