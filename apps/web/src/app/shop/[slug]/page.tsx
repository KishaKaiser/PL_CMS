import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { ReviewSection } from '../../../components/reviews/review-section';
import { ProductInstructions } from '../../../components/product-instructions';
import { getPublicSiteConfig, getSafeImageSrc } from '../../../lib/public-cms';
import { fetchApi } from '../../../lib/server-api';
import { buildSeoMetadata, getSeoDescription, getSeoTitle, toAbsoluteUrl } from '../../../lib/seo';
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
  slug?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  hiddenFromShop?: boolean;
  /** Set for the custom candle product, which has no page of its own: customers are sent to the builder. */
  customizeHref?: string | null;
  instructionsMedia?: { url: string; title?: string | null; originalName?: string | null; sizeBytes?: number } | null;
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

/** The product behind an address: its slug, or an id / old address, which the page sends on to the current address. */
async function getProduct(key: string): Promise<Product | null> {
  try {
    const res = await fetchApi(`/products/${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<Product>;
  } catch {
    return null;
  }
}

async function getRatings(productId: string): Promise<number[]> {
  try {
    const res = await fetchApi(`/products/${productId}/reviews`, { cache: 'no-store' });
    if (!res.ok) return [];
    const reviews = (await res.json()) as Array<{ rating?: number }>;
    return reviews.map((review) => Number(review.rating)).filter((rating) => Number.isFinite(rating));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

function productPath(product: Product) {
  return `/shop/${product.slug || product.id}`;
}

/** What search engines read to show the product with its price, availability and rating. */
function buildProductJsonLd(product: Product, ratings: number[]) {
  const url = toAbsoluteUrl(productPath(product));
  const safeImage = getSafeImageSrc(product.featuredMedia?.url ?? product.imageUrl);
  const image = safeImage ? toAbsoluteUrl(safeImage) : null;
  const description = getSeoDescription(product.metaDescription, product.shortDescription, product.description);
  const price = Number(product.price);
  const outOfStock = product.stockStatus === 'OUT_OF_STOCK' || (product.trackStock && Number(product.stockQuantity ?? 0) <= 0 && product.stockStatus !== 'BACKORDER');
  const availability = outOfStock ? 'OutOfStock' : product.stockStatus === 'BACKORDER' ? 'BackOrder' : 'InStock';
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url,
    ...(image ? { image: [image] } : {}),
    ...(description ? { description } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: product.currency || 'USD',
      price: (Number.isFinite(price) ? price : 0).toFixed(2),
      availability: `https://schema.org/${availability}`,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
  if (ratings.length > 0) {
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    data.aggregateRating = { '@type': 'AggregateRating', ratingValue: average.toFixed(1), reviewCount: ratings.length };
  }
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: key } = await params;
  const [product, siteConfig] = await Promise.all([getProduct(key.toLowerCase()), getPublicSiteConfig()]);

  if (!product || !product.isActive) {
    return {
      ...buildSeoMetadata({
        title: 'Product Not Found',
        description: siteConfig.identity.tagline,
        path: `/shop/${key}`,
        siteName: siteConfig.identity.title,
      }),
      robots: { index: false, follow: false },
    };
  }

  const metadata = buildSeoMetadata({
    // The search engine title and description the admin wrote; the name and short description when they did not.
    title: getSeoTitle(product.name, product.metaTitle),
    description: getSeoDescription(product.metaDescription, product.shortDescription, product.description, `Shop ${product.name}`),
    path: productPath(product),
    imageUrl: product.featuredMedia?.url ?? product.imageUrl ?? siteConfig.identity.logoUrl,
    siteName: siteConfig.identity.title,
    type: 'website',
  });
  // A product hidden from the shop (such as the wallet credit) should not turn up in search results either.
  return product.hiddenFromShop ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug: key } = await params;
  const product = await getProduct(key.toLowerCase());

  if (!product || !product.isActive) notFound();
  // The custom candle has no product page: an old link, or a search result, goes to the builder.
  if (product.customizeHref) redirect(product.customizeHref);

  // An older link (by id, or an address the product used to have) goes on to the product's current address.
  if (product.slug && product.slug !== key) permanentRedirect(`/shop/${product.slug}`);

  const jsonLd = buildProductJsonLd(product, await getRatings(product.id));

  const activeVariants = product.variants?.filter((v) => v.isActive) ?? [];
  const productImage = product.featuredMedia?.url ?? product.imageUrl ?? '';
  const productImageAlt = product.featuredMedia?.altText || product.featuredMedia?.title || product.name;

  return (
    <main className="mx-auto w-full max-w-7xl p-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:underline">Shop</Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <ProductDetailClient product={product} variants={activeVariants} productImage={productImage} productImageAlt={productImageAlt} />

      {product.instructionsMedia?.url && (
        <ProductInstructions
          url={product.instructionsMedia.url}
          title={product.instructionsMedia.title || product.instructionsMedia.originalName || `${product.name} instructions`}
          sizeBytes={product.instructionsMedia.sizeBytes}
        />
      )}

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
          <div className="cms-rich-content prose max-w-none p-5 text-gray-700" dangerouslySetInnerHTML={{ __html: product.description }} />
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
