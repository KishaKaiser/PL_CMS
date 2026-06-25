import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichContent } from '../../../components/cms/rich-content';
import { ReviewSection } from '../../../components/reviews/review-section';
import { getSafeImageSrc } from '../../../lib/public-cms';
import { fetchApi } from '../../../lib/server-api';
import ProductDetailClient from './ProductDetailClient';

interface Inventory {
  onHand: number;
  reserved: number;
}

interface ProductVariant {
  id: string;
  color: string;
  sku: string;
  priceOverride?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  inventory?: Inventory | null;
}

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
  variants: ProductVariant[];
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetchApi(`/products/${id}`, { cache: 'no-store' });
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

  const activeVariants = product.variants?.filter((v) => v.isActive) ?? [];
  const productImage = getSafeImageSrc(product.featuredMedia?.url ?? product.imageUrl);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/shop" className="hover:underline">Shop</Link>
        {' / '}
        <span>{product.name}</span>
      </nav>

      <h1 className="mb-2 text-3xl font-bold">{product.name}</h1>

      {productImage && (
        <img
          src={productImage}
          alt={product.featuredMedia?.altText || product.featuredMedia?.title || product.name}
          className="mb-6 max-h-[460px] w-full rounded-lg border object-cover"
        />
      )}

      {product.shortDescription && (
        <p className="mb-4 text-lg text-gray-600">{product.shortDescription}</p>
      )}

      {product.description && (
        <RichContent html={product.description} className="prose mb-6 max-w-none text-gray-700" />
      )}

      {activeVariants.length > 0 ? (
        <ProductDetailClient product={product} variants={activeVariants} />
      ) : (
        <>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-purple-700">
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
            className="inline-block rounded bg-purple-600 px-8 py-3 text-white hover:bg-purple-700"
          >
            Buy Now – ${Number(product.price).toFixed(2)}
          </Link>
        </>
      )}

      <div className="mt-8">
        <Link href="/shop" className="text-sm text-purple-600 hover:underline">
          ← Back to Shop
        </Link>
      </div>

      <ReviewSection
        title="Customer Reviews"
        endpoint={`/api/proxy/products/${product.id}/reviews`}
        loginMessage="Log in to review products you purchased."
      />
    </main>
  );
}
