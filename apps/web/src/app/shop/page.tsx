import Link from 'next/link';
import type { Metadata } from 'next';
import { RichContent } from '../../components/cms/rich-content';
import { PublicFormEmbed } from '../../components/cms/public-form-embed';
import { NewsletterSidebarWidget } from '../../components/cms/newsletter-sidebar-widget';
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
  variants?: Array<{ color?: string | null; isActive?: boolean }>;
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
  const selectedColor = firstParam(params.color)?.trim() ?? '';
  const [products, page, siteConfig] = await Promise.all([getProducts(), getPublishedPage('shop'), getPublicSiteConfig()]);
  const showTitle = page?.builderLayout?.settings?.showTitle !== false;
  const showBreadcrumbs = page?.builderLayout?.settings?.breadcrumbs !== false;
  const title = page?.title ?? 'Shop';
  const filteredProducts = filterProducts(products, selectedCategory, selectedPrice, selectedColor);
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
          selectedColor={selectedColor}
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
  selectedColor,
}: {
  products: Product[];
  siteConfig: PublicSiteConfig;
  selectedCategory: string;
  selectedPrice: string;
  selectedColor: string;
}) {
  const widgets = siteConfig.sidebars.shop.filter((widget) => widget.enabled);
  const categories = collectCategories(products);
  const colors = collectColors(products);
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
                  <Link href={shopHref({ price: selectedPrice, color: selectedColor })} className={!selectedCategory ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                    All products
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={shopHref({ category: category.slug, price: selectedPrice, color: selectedColor })}
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
                  <Link href={shopHref({ category: selectedCategory, color: selectedColor })} className={!selectedPrice ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                    Any price
                  </Link>
                </li>
                {prices.map((price) => {
                  return (
                    <li key={price.key}>
                      <Link href={shopHref({ category: selectedCategory, price: price.key, color: selectedColor })} className={selectedPrice === price.key ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                        {price.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }

        if (widget.type === 'color_filter') {
          const widgetColors = parseWidgetList(getWidgetSetting(widget.settings, 'colorsText')).map((item) => item.label);
          const colorOptions = widgetColors.length > 0 ? widgetColors : colors;
          return (
            <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href={shopHref({ category: selectedCategory, price: selectedPrice })} className={!selectedColor ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                    Any color
                  </Link>
                </li>
                {colorOptions.map((color) => (
                  <li key={color}>
                    <Link href={shopHref({ category: selectedCategory, price: selectedPrice, color })} className={selectedColor === color ? 'font-medium text-purple-700' : 'text-gray-700 hover:text-purple-700'}>
                      {color}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (widget.type === 'image') {
          const imageUrl = getWidgetSetting(widget.settings, 'imageUrl');
          const imageAlt = getWidgetSetting(widget.settings, 'imageAlt') || widget.title;
          const imageHref = getWidgetSetting(widget.settings, 'imageHref');
          if (!imageUrl) return null;
          const image = <img src={imageUrl} alt={imageAlt} className="h-auto w-full rounded-md object-cover" />;
          return (
            <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
              {widget.title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>}
              {imageHref ? <Link href={imageHref}>{image}</Link> : image}
            </section>
          );
        }

        if (widget.type === 'form') {
          const formSlug = getWidgetSetting(widget.settings, 'formSlug');
          return (
            <section key={widget.id}>
              <PublicFormEmbed slug={formSlug} fallbackTitle={widget.title} showTitle={Boolean(widget.title)} />
            </section>
          );
        }

        if (widget.type === 'newsletter') {
          return <NewsletterSidebarWidget key={widget.id} widget={widget} />;
        }

        if (widget.type === 'menu') {
          const links = parseWidgetList(getWidgetSetting(widget.settings, 'linksText'));
          return (
            <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
              <nav className="mt-3 flex flex-col gap-2 text-sm">
                {links.map((link) => (
                  <Link key={`${link.label}-${link.href}`} href={link.href} className="text-gray-700 hover:text-purple-700">
                    {link.label}
                  </Link>
                ))}
              </nav>
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

function shopHref(filters: { category?: string; price?: string; color?: string }) {
  const query = new URLSearchParams();
  if (filters.category) query.set('category', filters.category);
  if (filters.price) query.set('price', filters.price);
  if (filters.color) query.set('color', filters.color);
  const value = query.toString();
  return value ? `/shop?${value}` : '/shop';
}

function getWidgetSetting(settings: Record<string, string | number | boolean> | undefined, key: string) {
  const value = settings?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseWidgetList(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = '', href = '#'] = line.split('|').map((part) => part.trim());
      return { label: label || href, href: href || '#' };
    });
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

function collectColors(products: Product[]) {
  const colors = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (variant.color) colors.add(parseVariantColor(variant.color).label);
    }
  }
  return Array.from(colors).sort((a, b) => a.localeCompare(b));
}

function filterProducts(products: Product[], category: string, price: string, color: string) {
  return products.filter((product) => {
    const matchesCategory = !category || product.categories?.some((item) => item.slug === category);
    const productPrice = Number(product.price);
    const matchesPrice =
      !price ||
      (price === 'under-25' && productPrice < 25) ||
      (price === '25-50' && productPrice >= 25 && productPrice <= 50) ||
      (price === '50-100' && productPrice > 50 && productPrice <= 100) ||
      (price === 'over-100' && productPrice > 100);
    const matchesColor = !color || product.variants?.some((variant) => variant.color && parseVariantColor(variant.color).label === color);
    return matchesCategory && matchesPrice && matchesColor;
  });
}

function parseVariantColor(value: string) {
  const [label = value] = value.split('|').map((part) => part.trim());
  return { label: label || value };
}
