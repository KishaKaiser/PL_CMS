import Link from 'next/link';
import { cookies } from 'next/headers';
import type { BuilderBlock, BuilderLayout, PublicSiteConfig } from '../../lib/public-cms';
import { getCategories, getPublishedPosts, getPublicSiteConfig, getTags, type PublicPost } from '../../lib/public-cms';
import { PublicFormEmbed } from './public-form-embed';
import { PublicSliderEmbed } from './public-slider-embed';
import { NewsletterSubscribeForm } from './newsletter-subscribe-form';
import { AnnouncementBar, StorefrontHeader } from './storefront-header';
import { fetchApi } from '../../lib/server-api';
import { getAccountLinkFromToken } from '../../lib/account-routing';
import { ProductWidgetGrid, type ProductWidgetItem } from './product-widget-grid';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  regularPrice?: string | number | null;
  salePrice?: string | number | null;
  saleStartsAt?: string | Date | null;
  saleEndsAt?: string | Date | null;
  currency?: string;
  imageUrl?: string | null;
  featuredMedia?: { url: string; altText?: string | null; title?: string | null } | null;
  orderCount?: number;
}

type StoreData = {
  products: Product[];
  categories: Array<{ id: string; slug: string; name: string }>;
  tags: Array<{ id: string; slug: string; name: string }>;
  posts: PublicPost[];
  primaryColor?: string;
};

type AccountLink = ReturnType<typeof getAccountLinkFromToken>;
type SiteMenus = PublicSiteConfig['menus'];
const defaultSocialIconLines = [
  'fa-brands fa-instagram|https://instagram.com|Instagram',
  'fa-brands fa-facebook-f|https://facebook.com|Facebook',
  'fa-brands fa-pinterest-p|https://pinterest.com|Pinterest',
];

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetchApi('/products', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

export async function BuilderContent({
  layout,
  showChrome = true,
  breadcrumbLabel = 'Page',
  accountLink,
  menus,
}: {
  layout: BuilderLayout;
  showChrome?: boolean;
  breadcrumbLabel?: string;
  accountLink?: AccountLink;
  menus?: SiteMenus;
}) {
  const cookieStore = accountLink ? null : await cookies();
  const resolvedAccountLink = accountLink ?? getAccountLinkFromToken(cookieStore?.get('access_token')?.value);
  const [products, categories, tags, posts, siteConfig] = await Promise.all([
    getProducts(),
    getCategories(),
    getTags(),
    getPublishedPosts(),
    menus ? Promise.resolve(null) : getPublicSiteConfig(),
  ]);
  const storeData = { products, categories, tags, posts, primaryColor: siteConfig?.theme.primaryColor };
  const resolvedMenus = menus ?? siteConfig?.menus ?? { header: [], footer: [], custom: [] };

  return (
    <div>
      {showChrome && layout.settings?.breadcrumbs !== false && (
        <nav className="border-b bg-gray-50 px-8 py-3 text-sm text-gray-500">
          <Link href="/">Home</Link>
          <span className="mx-2">/</span>
          <span>{breadcrumbLabel}</span>
        </nav>
      )}
      <div className={showChrome ? pageShellClass(layout.settings?.layout) : ''}>
        {showChrome && layout.settings?.layout === 'sidebar-left' && <DefaultSidebar />}
        <div>
          {layout.sections.map((section) => (
            <section
              key={section.id}
              style={{
                background: String(section.settings.background ?? 'transparent'),
                padding: String(section.settings.padding ?? '40px 24px'),
              }}
            >
              <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-7xl'}>
                {section.blocks.map((block) => (
                  <BuilderBlockView key={block.id} block={block} storeData={storeData} accountLink={resolvedAccountLink} menus={resolvedMenus} />
                ))}
              </div>
            </section>
          ))}
        </div>
        {showChrome && layout.settings?.layout === 'sidebar-right' && <DefaultSidebar />}
      </div>
    </div>
  );
}

function BuilderBlockView({ block, storeData, accountLink, menus }: { block: BuilderBlock; storeData: StoreData; accountLink: AccountLink; menus: SiteMenus }) {
  if (block.type === 'heading') {
    return <h1 className="mb-4 font-bold" style={textStyle(block, 40)}>{String(block.props.text ?? '')}</h1>;
  }
  if (block.type === 'text') {
    return <div className="cms-rich-content mb-4 leading-7" style={textStyle(block, 16)} dangerouslySetInnerHTML={{ __html: String(block.props.text ?? '') }} />;
  }
  if (block.type === 'image') {
    const src = String(block.props.src ?? '');
    if (!src) return null;
    return (
      <div className="mb-4 flex" style={{ justifyContent: imageAlign(block.props.align) }}>
        <img
          src={src}
          alt={String(block.props.alt ?? '')}
          style={{
            width: `${Number(block.props.width ?? 100)}%`,
            height: `${Number(block.props.height ?? 320)}px`,
            objectFit: String(block.props.objectFit ?? 'cover') as 'cover',
            borderRadius: Number(block.props.borderRadius ?? 8),
          }}
        />
      </div>
    );
  }
  if (block.type === 'button') {
    return (
      <a href={String(block.props.href ?? '#')} className="mb-4 inline-block rounded bg-purple-600 px-4 py-2 text-white">
        {String(block.props.label ?? 'Learn More')}
      </a>
    );
  }
  if (block.type === 'spacer') {
    return <div aria-hidden="true" style={{ height: `${Math.min(400, Math.max(4, Number(block.props.height ?? 48)))}px` }} />;
  }
  if (block.type === 'icon') {
    return (
      <div className="mb-4 flex items-center gap-3">
        <i
          className={String(block.props.iconClass ?? 'fa-solid fa-star')}
          style={{
            color: String(block.props.color ?? '#6f21b6'),
            fontSize: `${Number(block.props.size ?? 36)}px`,
          }}
        />
        <span>{String(block.props.label ?? '')}</span>
      </div>
    );
  }
  if (block.type === 'menu') {
    const links = getMenuLinks(block, menus);
    const vertical = block.props.orientation === 'vertical';
    return (
      <nav className="mb-4">
        {block.props.title ? <h3 className="mb-2 text-sm font-semibold text-gray-900">{String(block.props.title)}</h3> : null}
        <div className={`flex ${vertical ? 'flex-col items-start' : 'flex-wrap items-center'} gap-3`}>
          {links.map((link) => (
            <a key={`${link.label}-${link.href}`} href={link.href} className="text-sm font-medium text-purple-700 hover:underline">
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    );
  }
  if (block.type === 'social-icons') {
    const links = getIconLinksFromText(block.props.linksText, defaultSocialIconLines);
    const vertical = block.props.orientation === 'vertical';
    return (
      <nav className="mb-4">
        {block.props.title ? <h3 className="mb-2 text-sm font-semibold text-gray-900">{String(block.props.title)}</h3> : null}
        <div className={`flex ${vertical ? 'flex-col items-start' : 'flex-wrap items-center'} gap-3`}>
          {links.map((link) => (
            <a key={`${link.label}-${link.href}`} href={link.href} className="inline-flex items-center gap-2 text-sm hover:underline" style={{ color: String(block.props.color ?? '#6f21b6') }}>
              <i className={link.iconClass} style={{ fontSize: `${Number(block.props.size ?? 20)}px` }} />
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </nav>
    );
  }
  if (block.type === 'announcement-bar') {
    return (
      <AnnouncementBar
        text={String(block.props.text ?? 'Free shipping on all domestic orders over $35')}
        background={String(block.props.background ?? '#6f21b6')}
        color={String(block.props.color ?? '#ffffff')}
      />
    );
  }
  if (block.type === 'store-header') {
    return <StoreHeaderView block={block} accountLink={accountLink} />;
  }
  if (block.type === 'hero-slider') {
    return <HeroSliderView block={block} />;
  }
  if (block.type === 'grid') {
    const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 3)));
    const children = block.children ?? [];
    return (
      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {children.map((child) => <BuilderBlockView key={child.id} block={child} storeData={storeData} accountLink={accountLink} menus={menus} />)}
      </div>
    );
  }
  if (block.type === 'image-slider') {
    const mode = String(block.props.mode ?? (block.props.sliderSlug ? 'saved-slider' : 'legacy-images'));
    const wide = block.props.displayWidth === 'wide';
    const wrap = (content: React.ReactNode) => wide ? <div className="relative left-1/2 mb-6 w-screen -translate-x-1/2">{content}</div> : content;
    if (mode === 'saved-slider') {
      return wrap(<PublicSliderEmbed slug={String(block.props.sliderSlug ?? '')} />);
    }
    if (mode === 'video') {
      const url = String(block.props.videoUrl ?? '');
      if (!url) return null;
      return wrap(
        <div className="overflow-hidden rounded border bg-black" style={{ aspectRatio: String(block.props.aspectRatio ?? '16 / 9') }}>
          {videoEmbed(url)}
        </div>,
      );
    }
    const slides = getSlides(block);
    const height = `${Number(block.props.height ?? 360)}px`;
    return wrap(<AnimatedSlider slides={slides} height={height} seconds={Number(block.props.slideSeconds ?? 5)} />);
  }
  if (block.type === 'video') {
    const url = String(block.props.url ?? '');
    if (!url) return null;
    return (
      <div className="mb-6 overflow-hidden rounded border bg-black" style={{ aspectRatio: String(block.props.aspectRatio ?? '16 / 9') }}>
        {videoEmbed(url)}
      </div>
    );
  }
  if (block.type === 'sidebar-widgets') {
    return (
      <aside className="mb-6 rounded border bg-gray-50 p-4">
        {getLines(block.props.itemsText, ['Search', 'Categories', 'Recent posts']).map((item) => (
          <div key={item} className="border-b py-2 text-sm last:border-b-0">{item}</div>
        ))}
      </aside>
    );
  }
  if (block.type === 'saved-form') {
    return (
      <PublicFormEmbed
        slug={String(block.props.formSlug ?? '')}
        fallbackTitle={String(block.props.formTitle ?? 'Form')}
        showTitle={block.props.displayTitle !== false}
      />
    );
  }
  if (block.type === 'newsletter-signup') {
    return (
      <NewsletterSubscribeForm
        title={String(block.props.title ?? 'Join Our Newsletter')}
        description={String(block.props.description ?? '')}
        layout={block.props.layout === 'horizontal' ? 'horizontal' : 'vertical'}
        placeholder={String(block.props.placeholder ?? 'Email address')}
        buttonLabel={String(block.props.buttonLabel ?? 'Subscribe')}
      />
    );
  }
  if (block.type === 'columns') {
    const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 2)));
    return (
      <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {(block.children ?? []).map((child) => <BuilderBlockView key={child.id} block={child} storeData={storeData} accountLink={accountLink} menus={menus} />)}
      </div>
    );
  }
  if (block.type === 'product-grid') {
    const products = getProductWidgetItems(storeData.products, block);
    const title = String(block.props.title ?? '').trim();
    const description = String(block.props.description ?? '').trim();
    return (
      <div className="mb-8">
        {title && <h2 className="mb-5 text-2xl font-semibold text-gray-950">{title}</h2>}
        {description && <p className="mb-5 max-w-3xl text-gray-600">{description}</p>}
        <ProductWidgetGrid products={products} primaryColor={storeData.primaryColor} />
      </div>
    );
  }
  if (block.type === 'product-categories') {
    const vertical = block.props.orientation === 'vertical';
    return (
      <div className={`mb-6 flex ${vertical ? 'flex-col items-start' : 'flex-wrap'} gap-2`}>
        {storeData.categories.map((category) => <span key={category.id} className="rounded-full border px-3 py-1 text-sm">{category.name}</span>)}
      </div>
    );
  }
  if (block.type === 'product-tags') {
    const vertical = block.props.orientation === 'vertical';
    return (
      <div className={`mb-6 flex ${vertical ? 'flex-col items-start' : 'flex-wrap'} gap-2`}>
        {storeData.tags.map((tag) => <span key={tag.id} className="rounded bg-gray-100 px-3 py-1 text-sm">#{tag.name}</span>)}
      </div>
    );
  }
  if (block.type === 'blog-posts') {
    const title = String(block.props.title ?? 'Latest Posts').trim();
    const description = String(block.props.description ?? '').trim();
    const posts = storeData.posts.slice(0, 4);
    return (
      <div className="mb-8">
        {title && <h2 className="mb-3 text-2xl font-semibold text-gray-950">{title}</h2>}
        {description && <p className="mb-5 max-w-3xl text-gray-600">{description}</p>}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {posts.map((post) => (
            <article key={post.id} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
              {post.featuredImageUrl ? (
                <a href={`/blog/${post.slug}`} className="block aspect-[4/3] bg-gray-100">
                  <img src={post.featuredImageUrl} alt={post.title} className="h-full w-full object-cover" />
                </a>
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-gray-100 text-sm text-gray-400">No image</div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-semibold text-gray-950">
                  <a href={`/blog/${post.slug}`} className="hover:underline">{post.title}</a>
                </h3>
                {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-gray-600">{post.excerpt}</p>}
                <a href={`/blog/${post.slug}`} className="mt-auto inline-flex w-fit rounded px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: storeData.primaryColor ?? '#6f21b6' }}>
                  Read More
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function textStyle(block: BuilderBlock, fallbackSize: number) {
  return {
    color: typeof block.props.color === 'string' ? block.props.color : undefined,
    fontFamily: typeof block.props.fontFamily === 'string' ? block.props.fontFamily : undefined,
    fontSize: `${Number(block.props.fontSize ?? fallbackSize)}px`,
    textAlign: String(block.props.align ?? 'left') as 'left',
  };
}

function StoreHeaderView({ block, accountLink }: { block: BuilderBlock; accountLink: AccountLink }) {
  const socialLinks = getIconLinksFromText(block.props.socialLinksText, [
    'fa-brands fa-instagram|https://instagram.com|Instagram',
    'fa-brands fa-facebook-f|https://facebook.com|Facebook',
    'fa-brands fa-pinterest-p|https://pinterest.com|Pinterest',
  ]);
  const topLinks = getLinksFromText(block.props.topLinksText, ['About Us|/about-us', 'Contact|/contact', 'Wishlist|/wishlist']);
  const navLinks = getLinksFromText(block.props.navLinksText, ['Home|/', 'Blog|/blog', 'Shop|/shop', 'Horoscopes|/horoscopes', 'Phone Readings|/phone-readings']);
  const actionLinks = getIconLinksFromText(block.props.actionLinksText, [
    'text|/login|Login',
    'fa-solid fa-magnifying-glass|/search|Search',
    'fa-regular fa-heart|/wishlist|Wishlist',
    'fa-solid fa-bag-shopping|/shop/cart|Cart',
  ]).map((link) => isLoginActionLink(link) ? { ...link, href: accountLink.href, label: accountLink.label } : link);
  return (
    <StorefrontHeader
      logoText={String(block.props.logoText ?? 'The Psychic Link')}
      logoSrc={block.props.logoMode === 'image' ? String(block.props.logoSrc ?? '') : ''}
      logoAlt={String(block.props.logoAlt ?? block.props.logoText ?? 'The Psychic Link')}
      logoMaxWidth={Number(block.props.logoMaxWidth ?? 220)}
      logoMaxHeight={Number(block.props.logoMaxHeight ?? 64)}
      socialLinks={socialLinks}
      topLinks={topLinks}
      navLinks={navLinks}
      actionLinks={actionLinks}
      showActions={block.props.showActions !== false}
      stickyMain={!(block.props.stickyMain === false && block.props.stickyMainTouched === true)}
    />
  );
}

function getProductWidgetItems(products: Product[], block: BuilderBlock): ProductWidgetItem[] {
  const limit = Math.min(24, Math.max(1, Number(block.props.limit ?? 3) || 3));
  const filter = String(block.props.filter ?? 'latest');
  let filtered = [...products];

  if (filter === 'sale') {
    filtered = filtered.filter(isProductOnSale);
  } else if (filter === 'top-sellers') {
    filtered.sort((a, b) => Number(b.orderCount ?? 0) - Number(a.orderCount ?? 0));
  }

  return filtered.slice(0, limit).map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    regularPrice: product.regularPrice,
    salePrice: product.salePrice,
    currency: product.currency || 'USD',
    imageSrc: getProductImageSrc(product),
    imageAlt: product.featuredMedia?.altText || product.featuredMedia?.title || product.name,
    isOnSale: isProductOnSale(product),
  }));
}

function isProductOnSale(product: Product) {
  if (product.salePrice == null) return false;
  const now = Date.now();
  const startsAt = product.saleStartsAt ? new Date(product.saleStartsAt).getTime() : null;
  const endsAt = product.saleEndsAt ? new Date(product.saleEndsAt).getTime() : null;
  return (startsAt == null || startsAt <= now) && (endsAt == null || endsAt >= now);
}

function getProductImageSrc(product: Product) {
  return product.featuredMedia?.url || product.imageUrl || null;
}

function isLoginActionLink(link: { href: string; label: string; iconClass: string }) {
  return link.href === '/login' || link.label.toLowerCase() === 'login';
}

function HeroSliderView({ block }: { block: BuilderBlock }) {
  const slides = getSlides(block);
  const height = `${Number(block.props.height ?? 610)}px`;
  return (
    <section className="relative mx-auto mb-8 max-w-[1696px] overflow-hidden bg-neutral-900" style={{ height }}>
      <AnimatedSlider slides={slides} height="100%" seconds={Number(block.props.slideSeconds ?? 5)} />
      <div className="absolute inset-y-0 left-[10%] flex flex-col justify-center text-white">
        <h1 className="mb-8 text-5xl font-light lg:text-6xl">{String(block.props.heading ?? 'Welcome')}</h1>
        <a href={String(block.props.buttonHref ?? '/shop')} className="w-fit border-2 border-white/80 px-10 py-5 text-lg font-semibold tracking-wide text-white hover:bg-white hover:text-neutral-900 lg:text-xl">
          {String(block.props.buttonLabel ?? 'SHOP NOW')}
        </a>
      </div>
      <button className="absolute left-8 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-3xl text-white">‹</button>
      <button className="absolute right-8 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-3xl text-white">›</button>
      <div className="absolute bottom-10 left-12 flex gap-3">
        <span className="h-3 w-3 rounded-full bg-purple-700" />
        <span className="h-3 w-3 rounded-full bg-white/50" />
      </div>
    </section>
  );
}

function AnimatedSlider({ slides, height, seconds }: { slides: Array<{ src: string; alt: string }>; height: string; seconds: number }) {
  if (slides.length === 0) return <div className="h-full w-full bg-neutral-900" style={{ height }} />;
  const end = slides.length > 1 ? `-${((slides.length - 1) / slides.length) * 100}%` : '0%';
  const duration = `${Math.max(2, seconds) * Math.max(1, slides.length)}s`;
  return (
    <div className="h-full w-full overflow-hidden bg-gray-100" style={{ height }}>
      <style>{`@keyframes plCmsAutoSlide { 0%, 18% { transform: translateX(0); } 100% { transform: translateX(var(--slide-end)); } }`}</style>
      <div
        className="flex h-full"
        style={{
          width: `${slides.length * 100}%`,
          animation: slides.length > 1 ? `plCmsAutoSlide ${duration} ease-in-out infinite alternate` : undefined,
          ['--slide-end' as string]: end,
        }}
      >
        {slides.map((slide) => (
          <img key={slide.src} src={slide.src} alt={slide.alt} className="h-full object-cover" style={{ width: `${100 / slides.length}%` }} />
        ))}
      </div>
    </div>
  );
}

function imageAlign(value: unknown) {
  if (value === 'left') return 'flex-start';
  if (value === 'right') return 'flex-end';
  return 'center';
}

function getLinksFromText(value: unknown, fallback: string[]) {
  return getLines(value, fallback).map((line) => {
    const [label, href] = line.split('|');
    return { label: label?.trim() || 'Link', href: href?.trim() || '#' };
  });
}

function getIconLinksFromText(value: unknown, fallback: string[]) {
  return getLines(value, fallback).map((line) => {
    const [iconClass, href, label] = line.split('|');
    return {
      iconClass: iconClass?.trim() || 'fa-solid fa-link',
      href: href?.trim() || '#',
      label: label?.trim() || 'Link',
    };
  });
}

function getLines(value: unknown, fallback: string[]) {
  const lines = typeof value === 'string'
    ? value.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  return lines.length > 0 ? lines : fallback;
}

function getMenuLinks(block: BuilderBlock, menus: SiteMenus) {
  const menuId = String(block.props.menuId ?? block.props.source ?? '');
  if (menuId === 'header') return menus.header;
  if (menuId === 'footer') return menus.footer;
  const savedMenu = menus.custom.find((menu) => menu.id === menuId);
  if (savedMenu) return savedMenu.items;
  if (Array.isArray(block.props.menuItems)) {
    return block.props.menuItems
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const candidate = item as { label?: unknown; href?: unknown };
        return {
          label: String(candidate.label ?? 'Link'),
          href: String(candidate.href ?? '#'),
        };
      })
      .filter((item): item is { label: string; href: string } => Boolean(item?.label));
  }
  return getLines(block.props.linksText, ['Home|/', 'Shop|/shop', 'Blog|/blog']).map((line) => {
    const [label, href] = line.split('|');
    return { label: label?.trim() || 'Link', href: href?.trim() || '#' };
  });
}

function getSlides(block: BuilderBlock) {
  if (!Array.isArray(block.props.slides)) return [];
  return block.props.slides
    .map((slide) => {
      if (typeof slide === 'string') return { src: slide, alt: '' };
      return slide && typeof slide === 'object' ? slide as { src?: unknown; alt?: unknown } : null;
    })
    .filter((slide): slide is { src?: unknown; alt?: unknown } => Boolean(slide?.src))
    .map((slide) => ({ src: String(slide.src), alt: String(slide.alt ?? '') }));
}

function videoEmbed(url: string) {
  const embedUrl = getVideoEmbedUrl(url);
  if (embedUrl) {
    return <iframe src={embedUrl} title="Embedded video" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  }
  return <video src={url} controls className="h-full w-full" />;
}

function getVideoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname === 'youtu.be') return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${parsed.pathname.split('/').filter(Boolean)[0]}`;
  } catch {
    return null;
  }
  return null;
}

function pageShellClass(layout?: string) {
  if (layout === 'full') return '';
  if (layout === 'sidebar-left') return 'mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]';
  if (layout === 'sidebar-right') return 'mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]';
  return '';
}

function DefaultSidebar() {
  return (
    <aside className="rounded border bg-gray-50 p-4 text-sm text-gray-600">
      <h2 className="font-semibold text-gray-900">Sidebar</h2>
      <p className="mt-2">Add sidebar widgets from the theme builder.</p>
    </aside>
  );
}
