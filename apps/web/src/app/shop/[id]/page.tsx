import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  currency: string;
  minutesPack: number;
  isActive: boolean;
}

async function getProduct(id: string): Promise<Product | null> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
  try {
    const res = await fetch(`${apiBase}/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<Product>;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product || !product.isActive) notFound();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/shop" className="hover:underline">Shop</Link>
        {' / '}
        <span>{product.name}</span>
      </nav>

      <h1 className="mb-2 text-3xl font-bold">{product.name}</h1>

      {product.description && (
        <p className="mb-4 text-gray-600">{product.description}</p>
      )}

      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-indigo-700">
          ${Number(product.price).toFixed(2)}
        </span>
        <span className="text-lg text-gray-400">{product.currency}</span>
      </div>

      {product.minutesPack > 0 && (
        <p className="mb-6 text-base font-medium text-green-700">
          Includes {product.minutesPack} minutes of advisor call time
        </p>
      )}

      <Link
        href={`/shop/checkout?productId=${product.id}`}
        className="inline-block rounded bg-indigo-600 px-8 py-3 text-white hover:bg-indigo-700"
      >
        Buy Now – ${Number(product.price).toFixed(2)}
      </Link>

      <div className="mt-8">
        <Link href="/shop" className="text-sm text-indigo-600 hover:underline">
          ← Back to Shop
        </Link>
      </div>
    </main>
  );
}
