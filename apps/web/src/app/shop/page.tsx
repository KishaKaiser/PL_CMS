import Link from 'next/link';
import type { Metadata } from 'next';
import { RichContent } from '../../components/cms/rich-content';
import { getPublishedPage, getPublicSiteConfig, getSafeImageSrc, type PublicSiteConfig } from '../../lib/public-cms';
import { fetchApi } from '../../lib/server-api';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../../lib/seo';
import { ProductGrid } from './ProductGrid';

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
  categories?: Array<{ id: string; slug: string; name: string }>;
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetchApi('/products', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const [page, siteConfig] = await Promise.all([getPublishedPage('shop'), getPublicSiteConfig()]);
  return buildSeoMetadata({
    title: page ? getSeoTitle(page.title, page.metaTitle) : 'Shop',
    description: page
      ? getSeoDescription(page.metaDescription, page.content, siteConfig.identity.tagline)
      : getSeoDescription('Browse available products and services.', siteConfig.identity.tagline),
    path: '/shop',
    imageUrl: page?.featuredImageUrl ?? siteConfig.identity.logoUrl,
    siteName: siteConfig.identity.title,
  });
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShopPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const selectedCategory = firstParam(params.category)?.trim() ?? '';
  const selectedPrice = firstParam(params.price)?.trim() ?? '';
  const [products, page, siteConfig] = await Promise.all([getProducts(), getPublishedPage('shop'), getPublicSiteConfig()]);
  const showTitle = page?.builderLayout?.settings?.showTitle !== false;
  const showBreadcrumbs = page?.builderLayout?.settings?.breadcrumbs !== false;
  const title = page?.title ?? 'Shop';
  const filteredProducts = filterProducts(products, selectedCategory, selectedPrice);
  const productCards = filteredProducts.map((product) => ({
    ...product,
    imageSrc: getSafeImageSrc(product.featuredMedia?.url ?? product.imageUrl),
  }));

  return (
    <main className="mx-auto w-full max-w-7xl p-8">
      {showBreadcrumbs && (
        <nav className="mb-4 text-sm text-gray-500">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span>{title}</span>
        </nav>
      )}

      <div className="mb-8">
        <section className="max-w-3xl">
          {showTitle && <h1 className="mb-3 text-4xl font-bold text-gray-950">{title}</h1>}
          {page?.content ? (
            <RichContent html={page.content} className="prose max-w-none text-gray-700" />
          ) : (
            <p className="text-gray-600">Browse our available products and services.</p>
          )}
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ShopSidebar
          products={products}
          siteConfig={siteConfig}
          selectedCategory={selectedCategory}
          selectedPrice={selectedPrice}
        />

        <section>
      {filteredProducts.length === 0 ? (
        <p className="text-gray-500">No products available at the moment.</p>
      ) : (
        <ProductGrid products={productCards} />
      )}
        </section>
      </div>
    </main>
  );
}

function ShopSidebar({
  products,
  siteConfig,
  selectedCategory,
  selectedPrice,
}: {
  products: Product[];
  siteConfig: PublicSiteConfig;
  selectedCategory: string;
  selectedPrice: string;
}) {
  const widgets = siteConfig.sidebars.shop.filter((widget) => widget.enabled);
  const categories = collectCategories(products);
  const prices = [
    { key: 'under-25', label: 'Under $25' },
    { key: '25-50', label: '$25 to $50' },
    { key: '50-100', label: '$50 to $100' },
    { key: 'over-100', label: 'Over $100' },
  ];

  return (
    <aside className="space-y-6">
      {widgets.map((widget) => {
        if (widget.type === 'shop_categories') {
          return (
            <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/shop" className={!selectedCategory ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                    All products
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/shop?category=${encodeURIComponent(category.slug)}`}
                      className={selectedCategory === category.slug ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}
                    >
                      {category.name} ({category.count})
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (widget.type === 'price_filter') {
          return (
            <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href={selectedCategory ? `/shop?category=${encodeURIComponent(selectedCategory)}` : '/shop'} className={!selectedPrice ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                    Any price
                  </Link>
                </li>
                {prices.map((price) => {
                  const query = new URLSearchParams();
                  if (selectedCategory) query.set('category', selectedCategory);
                  query.set('price', price.key);
                  return (
                    <li key={price.key}>
                      <Link href={`/shop?${query.toString()}`} className={selectedPrice === price.key ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                        {price.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }

        return (
          <section key={widget.id} className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-500 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <p className="mt-2">This shop widget is ready for setup.</p>
          </section>
        );
      })}
    </aside>
  );
}

function collectCategories(products: Product[]) {
  const categories = new Map<string, { slug: string; name: string; count: number }>();
  for (const product of products) {
    for (const category of product.categories ?? []) {
      const existing = categories.get(category.slug);
      categories.set(category.slug, {
        slug: category.slug,
        name: category.name,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }
  return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function filterProducts(products: Product[], category: string, price: string) {
  return products.filter((product) => {
    const matchesCategory = !category || product.categories?.some((item) => item.slug === category);
    const productPrice = Number(product.price);
    const matchesPrice =
      !price ||
      (price === 'under-25' && productPrice < 25) ||
      (price === '25-50' && productPrice >= 25 && productPrice <= 50) ||
      (price === '50-100' && productPrice > 50 && productPrice <= 100) ||
      (price === 'over-100' && productPrice > 100);
    return matchesCategory && matchesPrice;
  });
}
