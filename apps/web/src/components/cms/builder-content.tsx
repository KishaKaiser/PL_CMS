import Link from 'next/link';
import type { BuilderBlock, BuilderLayout } from '../../lib/public-cms';
import { getCategories, getTags } from '../../lib/public-cms';
import { PublicFormEmbed } from './public-form-embed';
import { PublicSliderEmbed } from './public-slider-embed';
import { AnnouncementBar, StorefrontHeader } from './storefront-header';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  currency?: string;
}

type StoreData = {
  products: Product[];
  categories: Array<{ id: string; slug: string; name: string }>;
  tags: Array<{ id: string; slug: string; name: string }>;
};

async function getProducts(): Promise<Product[]> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
  try {
    const res = await fetch(`${apiBase}/products`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json() as Promise<Product[]>;
  } catch {
    return [];
  }
}

export async function BuilderContent({
  layout,
  showChrome = true,
}: {
  layout: BuilderLayout;
  showChrome?: boolean;
}) {
  const [products, categories, tags] = await Promise.all([getProducts(), getCategories(), getTags()]);
  const storeData = { products, categories, tags };

  return (
    <div>
      {showChrome && layout.settings?.breadcrumbs !== false && (
        <nav className="border-b bg-gray-50 px-8 py-3 text-sm text-gray-500">
          <Link href="/">Home</Link>
          <span className="mx-2">/</span>
          <span>Page</span>
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
              <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-5xl'}>
                {section.blocks.map((block) => (
                  <BuilderBlockView key={block.id} block={block} storeData={storeData} />
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

function BuilderBlockView({ block, storeData }: { block: BuilderBlock; storeData: StoreData }) {
  if (block.type === 'heading') {
    return <h1 className="mb-4 font-bold" style={textStyle(block, 40)}>{String(block.props.text ?? '')}</h1>;
  }
  if (block.type === 'text') {
    return <p className="mb-4 leading-7" style={textStyle(block, 16)}>{String(block.props.text ?? '')}</p>;
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
      <a href={String(block.props.href ?? '#')} className="mb-4 inline-block rounded bg-indigo-600 px-4 py-2 text-white">
        {String(block.props.label ?? 'Learn More')}
      </a>
    );
  }
  if (block.type === 'icon') {
    return (
      <div className="mb-4 flex items-center gap-3">
        <i
          className={String(block.props.iconClass ?? 'fa-solid fa-star')}
          style={{
            color: String(block.props.color ?? '#4f46e5'),
            fontSize: `${Number(block.props.size ?? 36)}px`,
          }}
        />
        <span>{String(block.props.label ?? '')}</span>
      </div>
    );
  }
  if (block.type === 'menu') {
    const links = getMenuLinks(block);
    const vertical = block.props.orientation === 'vertical' || block.props.orientation === 'sidebar';
    return (
      <nav className={`mb-4 flex ${vertical ? 'flex-col items-start' : 'flex-wrap items-center'} gap-3`}>
        {links.map((link) => (
          <a key={`${link.label}-${link.href}`} href={link.href} className="text-sm font-medium text-indigo-700 hover:underline">
            {link.label}
          </a>
        ))}
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
    return <StoreHeaderView block={block} />;
  }
  if (block.type === 'hero-slider') {
    return <HeroSliderView block={block} />;
  }
  if (block.type === 'grid') {
    const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 3)));
    const children = block.children ?? [];
    return (
      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {children.map((child) => <BuilderBlockView key={child.id} block={child} storeData={storeData} />)}
      </div>
    );
  }
  if (block.type === 'image-slider') {
    const mode = String(block.props.mode ?? (block.props.sliderSlug ? 'saved-slider' : 'legacy-images'));
    if (mode === 'saved-slider') {
      return <PublicSliderEmbed slug={String(block.props.sliderSlug ?? '')} />;
    }
    if (mode === 'video') {
      const url = String(block.props.videoUrl ?? '');
      if (!url) return null;
      return (
        <div className="mb-6 overflow-hidden rounded border bg-black" style={{ aspectRatio: String(block.props.aspectRatio ?? '16 / 9') }}>
          {videoEmbed(url)}
        </div>
      );
    }
    const slides = getSlides(block);
    const height = `${Number(block.props.height ?? 360)}px`;
    return (
      <AnimatedSlider slides={slides} height={height} seconds={Number(block.props.slideSeconds ?? 5)} />
    );
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
  if (block.type === 'columns') {
    const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 2)));
    return (
      <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {(block.children ?? []).map((child) => <BuilderBlockView key={child.id} block={child} storeData={storeData} />)}
      </div>
    );
  }
  if (block.type === 'product-grid') {
    const products = storeData.products.slice(0, Number(block.props.limit ?? 3));
    return (
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {products.map((product) => (
          <Link key={product.id} href={`/shop/${product.id}`} className="rounded border bg-white p-4 shadow-sm hover:shadow">
            <h3 className="font-semibold">{product.name}</h3>
            {product.description && <p className="mt-1 text-sm text-gray-500">{product.description}</p>}
            <p className="mt-3 text-xl font-bold text-indigo-700">${Number(product.price).toFixed(2)}</p>
          </Link>
        ))}
      </div>
    );
  }
  if (block.type === 'product-categories') {
    return (
      <div className="mb-6 flex flex-wrap gap-2">
        {storeData.categories.map((category) => <span key={category.id} className="rounded-full border px-3 py-1 text-sm">{category.name}</span>)}
      </div>
    );
  }
  if (block.type === 'product-tags') {
    return (
      <div className="mb-6 flex flex-wrap gap-2">
        {storeData.tags.map((tag) => <span key={tag.id} className="rounded bg-gray-100 px-3 py-1 text-sm">#{tag.name}</span>)}
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

function StoreHeaderView({ block }: { block: BuilderBlock }) {
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
  ]);
  return (
    <StorefrontHeader
      logoText={String(block.props.logoText ?? 'The Psychic Link')}
      logoSrc={block.props.logoMode === 'image' ? String(block.props.logoSrc ?? '') : ''}
      logoAlt={String(block.props.logoAlt ?? block.props.logoText ?? 'The Psychic Link')}
      socialLinks={socialLinks}
      topLinks={topLinks}
      navLinks={navLinks}
      actionLinks={actionLinks}
      showActions={block.props.showActions !== false}
    />
  );
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

function getMenuLinks(block: BuilderBlock) {
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
  if (layout === 'sidebar-left') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]';
  if (layout === 'sidebar-right') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]';
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
