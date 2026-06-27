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
  weightOz?: string | number | null;
  lengthIn?: string | number | null;
  widthIn?: string | number | null;
  heightIn?: string | number | null;
  stockQuantity?: number | null;
  stockStatus?: string | null;
  trackStock?: boolean | null;
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
    <main className="mx-auto w-full max-w-7xl p-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:underline">Shop</Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {productImage ? (
            <img
              src={productImage}
              alt={product.featuredMedia?.altText || product.featuredMedia?.title || product.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
              Product image
            </div>
          )}
        </div>

        <section className="rounded-lg border bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <h1 className="text-4xl font-bold text-gray-950">{product.name}</h1>
          </div>

          {product.shortDescription && (
            <div className="border-b border-gray-100 p-6">
              <RichContent html={product.shortDescription} className="prose max-w-none text-lg leading-8 text-gray-600" />
            </div>
          )}

          <div className="p-6">
            <ProductDetailClient product={product} variants={activeVariants} />
          </div>
        </section>
      </section>

      <section className="mt-8 rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <h2 className="text-xl font-semibold text-gray-950">Product Dimensions</h2>
        </div>
        <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <DimensionStat label="Height" value={formatMeasurement(product.heightIn, 'in')} />
          <DimensionStat label="Width" value={formatMeasurement(product.widthIn, 'in')} />
          <DimensionStat label="Length" value={formatMeasurement(product.lengthIn, 'in')} />
          <DimensionStat label="Weight" value={formatMeasurement(product.weightOz, 'oz')} />
        </dl>
      </section>

      {product.description && (
        <section className="mt-8 rounded-lg border bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-xl font-semibold text-gray-950">Long Description</h2>
          </div>
          <RichContent html={product.description} className="prose max-w-none p-5 text-gray-700" />
        </section>
      )}

      <section className="mt-8 rounded-lg border bg-white p-5 shadow-sm">
        <ReviewSection
          title="Customer Ratings"
          endpoint={`/api/proxy/products/${product.id}/reviews`}
          loginMessage="Log in to review products you purchased."
        />
      </section>

      <div className="mt-8">
        <Link href="/shop" className="text-sm text-purple-600 hover:underline">
          Back to Shop
        </Link>
      </div>
    </main>
  );
}

function DimensionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-2 text-lg font-semibold text-gray-950">{value}</dd>
    </div>
  );
}

function formatMeasurement(value: string | number | null | undefined, suffix: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not set';
  const formatted = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${suffix}`;
}
