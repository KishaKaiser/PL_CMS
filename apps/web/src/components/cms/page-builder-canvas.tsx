'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MediaAsset } from '../admin/media-library';
import { PublicSliderEmbed, type CmsSlider } from './public-slider-embed';

export type BuilderBlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'columns'
  | 'grid'
  | 'icon'
  | 'menu'
  | 'announcement-bar'
  | 'store-header'
  | 'hero-slider'
  | 'image-slider'
  | 'video'
  | 'sidebar-widgets'
  | 'global'
  | 'saved-form'
  | 'product-grid'
  | 'product-categories'
  | 'product-tags';

export type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';

export interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  props: Record<string, unknown>;
  children?: BuilderBlock[];
}

export interface BuilderSection {
  id: string;
  type: 'section';
  settings: {
    layout?: string;
    background?: string;
    padding?: string;
  };
  blocks: BuilderBlock[];
}

export interface BuilderLayout {
  version: number;
  type: string;
  settings?: {
    layout?: string;
    breadcrumbs?: boolean;
    showTitle?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
  };
  sections: BuilderSection[];
}

export interface BuilderWidget {
  id?: string;
  type: BuilderBlockType;
  label: string;
  category?: string | null;
  pluginName?: string | null;
  defaultJson?: BuilderBlock;
  enabled: boolean;
}

interface ProductPreview {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  currency?: string;
}

interface TaxonomyPreview {
  id: string;
  slug: string;
  name: string;
  postCount?: number;
}

interface SavedFormLite {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
}

interface SavedSliderLite extends CmsSlider {
  id: string;
  status: string;
}

export type StorePreviewData = {
  products: ProductPreview[];
  categories: TaxonomyPreview[];
  tags: TaxonomyPreview[];
};

export type ThemePreviewStyles = {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
};

export const DEFAULT_THEME_PREVIEW_STYLES: ThemePreviewStyles = {
  primaryColor: '#4f46e5',
  accentColor: '#0f766e',
  fontFamily: 'Inter, Arial, sans-serif',
};

export const defaultWidgets: BuilderWidget[] = [
  { type: 'heading', label: 'Heading', category: 'content', enabled: true },
  { type: 'text', label: 'Text', category: 'content', enabled: true },
  { type: 'image', label: 'Image', category: 'media', enabled: true },
  { type: 'image-slider', label: 'Saved Slider / Video', category: 'media', enabled: true },
  { type: 'video', label: 'Video Embed', category: 'media', enabled: true },
  { type: 'button', label: 'Button', category: 'content', enabled: true },
  { type: 'icon', label: 'Font Awesome Icon', category: 'content', enabled: true },
  { type: 'announcement-bar', label: 'Announcement Bar', category: 'storefront', enabled: true },
  { type: 'store-header', label: 'Store Header', category: 'storefront', enabled: true },
  { type: 'hero-slider', label: 'Hero Slider', category: 'storefront', enabled: true },
  { type: 'columns', label: 'Columns', category: 'layout', enabled: true },
  { type: 'grid', label: 'Grid', category: 'layout', enabled: true },
  { type: 'menu', label: 'Menu', category: 'navigation', enabled: true },
  { type: 'sidebar-widgets', label: 'Sidebar Widgets', category: 'layout', enabled: true },
  { type: 'saved-form', label: 'Saved Form', category: 'forms', enabled: true },
  { type: 'product-grid', label: 'Products', category: 'store', enabled: true },
  { type: 'product-categories', label: 'Product Categories', category: 'store', enabled: true },
  { type: 'product-tags', label: 'Product Tags', category: 'store', enabled: true },
];

const emptyStorePreview: StorePreviewData = { products: [], categories: [], tags: [] };

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlock(type: BuilderBlockType, widget?: BuilderWidget): BuilderBlock {
  const id = createId(type);
  if (widget?.defaultJson && Object.keys(widget.defaultJson).length > 0) return { ...JSON.parse(JSON.stringify(widget.defaultJson)), id, type };
  if (type === 'heading') return { id, type, props: { text: 'New Heading', level: 2, fontSize: 36, align: 'left' } };
  if (type === 'text') return { id, type, props: { text: 'New text block.', fontSize: 16, align: 'left' } };
  if (type === 'image') return { id, type, props: { mediaId: '', src: '', alt: '', width: 100, height: 320, objectFit: 'cover', align: 'center', borderRadius: 8 } };
  if (type === 'image-slider') return { id, type, props: { mode: 'saved-slider', sliderId: '', sliderSlug: '', sliderTitle: '', videoUrl: '', height: 420 } };
  if (type === 'video') return { id, type, props: { url: '', aspectRatio: '16 / 9' } };
  if (type === 'button') return { id, type, props: { label: 'Learn More', href: '#' } };
  if (type === 'icon') return { id, type, props: { iconClass: 'fa-solid fa-star', label: 'Icon label', size: 36, color: '#4f46e5' } };
  if (type === 'announcement-bar') return { id, type, props: { text: 'Free shipping on all domestic orders over $35', background: '#6f21b6', color: '#ffffff' } };
  if (type === 'store-header') return { id, type, props: { logoText: 'The Psychic Link', socialLinksText: 'fa-brands fa-instagram|https://instagram.com|Instagram\nfa-brands fa-facebook-f|https://facebook.com|Facebook\nfa-brands fa-pinterest-p|https://pinterest.com|Pinterest', topLinksText: 'About Us|/about-us\nContact|/contact\nWishlist|/wishlist', navLinksText: 'Home|/\nBlog|/blog\nShop|/shop\nHoroscopes|/horoscopes\nPhone Readings|/phone-readings', actionLinksText: 'text|/login|Login\nfa-solid fa-magnifying-glass|/search|Search\nfa-regular fa-heart|/wishlist|Wishlist\nfa-solid fa-bag-shopping|/shop/cart|Cart', showActions: true } };
  if (type === 'hero-slider') return { id, type, props: { mediaIds: [], slides: [], mediaId: '', src: '', alt: '', heading: 'Welcome', buttonLabel: 'SHOP NOW', buttonHref: '/shop', height: 610, slideSeconds: 5 } };
  if (type === 'columns') return { id, type, props: { columns: 2 }, children: [] };
  if (type === 'grid') return { id, type, props: { columns: 3, itemsText: 'Grid item\nGrid item\nGrid item' } };
  if (type === 'menu') return { id, type, props: { source: 'header', orientation: 'horizontal', placement: 'header', linksText: 'Home|/\nShop|/shop\nBlog|/blog' } };
  if (type === 'sidebar-widgets') return { id, type, props: { itemsText: 'Search\nCategories\nRecent posts' } };
  if (type === 'saved-form') return { id, type, props: { formId: '', formSlug: '', formTitle: '', displayTitle: true } };
  if (type === 'product-grid') return { id, type, props: { limit: 3 } };
  if (type === 'product-categories') return { id, type, props: {} };
  if (type === 'product-tags') return { id, type, props: {} };
  return { id, type: 'global', props: {} };
}

export function findBlockInLayout(layout: BuilderLayout, blockId: string) {
  for (const section of layout.sections) {
    const block = findBlock(section.blocks, blockId);
    if (block) return block;
  }
  return undefined;
}

function findBlock(blocks: BuilderBlock[], blockId: string): BuilderBlock | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    const child = findBlock(block.children ?? [], blockId);
    if (child) return child;
  }
  return undefined;
}

export function mapBlocks(blocks: BuilderBlock[], mapper: (block: BuilderBlock) => BuilderBlock): BuilderBlock[] {
  return blocks.map((block) => {
    const mapped = mapper(block);
    return mapped.children ? { ...mapped, children: mapBlocks(mapped.children, mapper) } : mapped;
  });
}

export function removeBlockById(blocks: BuilderBlock[], blockId: string): BuilderBlock[] {
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) => ({
      ...block,
      children: block.children ? removeBlockById(block.children, blockId) : block.children,
    }));
}

export function mergeWidgets(widgets: BuilderWidget[]) {
  const map = new Map<BuilderBlockType, BuilderWidget>();
  [...defaultWidgets, ...widgets].forEach((widget) => map.set(widget.type, { ...widget, enabled: widget.enabled !== false }));
  return Array.from(map.values());
}

export function groupWidgets(widgets: BuilderWidget[]) {
  return widgets.filter((widget) => widget.enabled).reduce<Record<string, BuilderWidget[]>>((groups, widget) => {
    const category = widget.category ?? 'content';
    groups[category] = [...(groups[category] ?? []), widget];
    return groups;
  }, {});
}

export function responsiveWidth(mode: ResponsiveMode) {
  if (mode === 'mobile') return '390px';
  if (mode === 'tablet') return '768px';
  return '100%';
}

export function pageShellClass(layout?: string) {
  if (layout === 'full') return '';
  if (layout === 'sidebar-left') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]';
  if (layout === 'sidebar-right') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]';
  return 'mx-auto max-w-5xl';
}

function textStyle(block: BuilderBlock, theme: ThemePreviewStyles, fallbackSize: number) {
  return {
    color: typeof block.props.color === 'string' ? block.props.color : block.type === 'heading' ? theme.primaryColor : undefined,
    fontFamily: typeof block.props.fontFamily === 'string' ? block.props.fontFamily : theme.fontFamily,
    fontSize: `${Number(block.props.fontSize ?? fallbackSize)}px`,
    textAlign: String(block.props.align ?? 'left') as 'left',
  };
}

function imageAlign(value: unknown) {
  if (value === 'left') return 'flex-start';
  if (value === 'right') return 'flex-end';
  return 'center';
}

function getLines(value: unknown, fallback: string[]) {
  const lines = typeof value === 'string'
    ? value.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  return lines.length > 0 ? lines : fallback;
}

function getMenuLinks(block: BuilderBlock) {
  return getLinksFromText(block.props.linksText, ['Home|/', 'Shop|/shop', 'Blog|/blog']);
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
  if (embedUrl) return <iframe src={embedUrl} title="Embedded video" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
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

export function AnimatedSlider({ slides, height, seconds, fallback }: { slides: Array<{ src: string; alt: string }>; height: string; seconds: number; fallback: string }) {
  const end = slides.length > 1 ? `-${((slides.length - 1) / slides.length) * 100}%` : '0%';
  const duration = `${Math.max(2, seconds) * Math.max(1, slides.length)}s`;
  return (
    <div className="h-full w-full overflow-hidden rounded border bg-gray-100" style={{ height }}>
      {slides.length > 0 ? (
        <>
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
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">{fallback}</div>
      )}
    </div>
  );
}

export function StoreHeaderPreview({ block }: { block: BuilderBlock }) {
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
    <header className="bg-white">
      <div className="flex items-center gap-7 bg-neutral-900 px-12 py-5 text-sm font-medium text-white">
        {socialLinks.map((link) => (
          <a key={`${link.iconClass}-${link.href}`} href={link.href} aria-label={link.label} className="hover:text-purple-200">
            <i className={link.iconClass} />
          </a>
        ))}
        {topLinks.map((link) => <a key={link.href} href={link.href} className="hover:underline">{link.label}</a>)}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-12 py-9">
        <nav className="flex items-center gap-7 text-base text-neutral-800">
          <i className="fa-solid fa-bars text-2xl" />
          {navLinks.map((link) => <a key={link.href} href={link.href} className="hover:text-purple-700">{link.label}</a>)}
        </nav>
        <div className="font-serif text-3xl italic text-black">{String(block.props.logoText ?? 'The Psychic Link')}</div>
        {block.props.showActions !== false && (
          <div className="flex items-center justify-end gap-7 text-neutral-900">
            {actionLinks.map((link) => (
              <a key={`${link.iconClass}-${link.href}`} href={link.href} aria-label={link.label} className="hover:text-purple-700">
                {link.iconClass === 'text' ? <span className="text-base">{link.label}</span> : <i className={`${link.iconClass} text-2xl`} />}
              </a>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function HeroSliderPreview({ block, theme }: { block: BuilderBlock; theme: ThemePreviewStyles }) {
  const slides = getSlides(block);
  const height = `${Number(block.props.height ?? 610)}px`;
  return (
    <section className="relative mx-auto mb-8 max-w-[1696px] overflow-hidden bg-neutral-900" style={{ height }}>
      {slides.length > 0 ? (
        <AnimatedSlider slides={slides} height="100%" seconds={Number(block.props.slideSeconds ?? 5)} fallback="" />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-800 to-orange-400 text-white">Choose a hero image from Media Library</div>
      )}
      <div className="absolute inset-y-0 left-[10%] flex flex-col justify-center text-white">
        <h1 className="mb-8 text-6xl font-light">{String(block.props.heading ?? 'Welcome')}</h1>
        <a href={String(block.props.buttonHref ?? '/shop')} className="w-fit border-2 border-white/80 px-10 py-5 text-xl font-semibold tracking-wide text-white hover:bg-white hover:text-neutral-900">
          {String(block.props.buttonLabel ?? 'SHOP NOW')}
        </a>
      </div>
      <button className="absolute left-12 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-3xl text-white">‹</button>
      <button className="absolute right-12 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-3xl text-white">›</button>
      <div className="absolute bottom-10 left-12 flex gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
        <span className="h-3 w-3 rounded-full bg-white/50" />
      </div>
    </section>
  );
}

export function PreviewBlock({
  block,
  components,
  savedForms = [],
  savedSliders = [],
  theme,
  storePreview,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  active,
}: {
  block: BuilderBlock;
  components: Array<{ id: string; schemaJson: BuilderBlock }>;
  savedForms?: SavedFormLite[];
  savedSliders?: SavedSliderLite[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  selectedBlockId?: string;
  onSelectBlock?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
  active?: boolean;
}) {
  if (block.type === 'heading') {
    return <h1 className="mb-3 font-bold" style={textStyle(block, theme, 42)}>{String(block.props.text ?? 'Heading')}</h1>;
  }
  if (block.type === 'text') {
    return <p className="mb-4 leading-7" style={textStyle(block, theme, 16)}>{String(block.props.text ?? 'Text block')}</p>;
  }
  if (block.type === 'image') {
    const src = String(block.props.src ?? '');
    const width = `${Number(block.props.width ?? 100)}%`;
    const height = `${Number(block.props.height ?? 320)}px`;
    return src ? (
      <div className="mb-4 flex" style={{ justifyContent: imageAlign(block.props.align) }}>
        <img src={src} alt={String(block.props.alt ?? '')} style={{ width, height, objectFit: String(block.props.objectFit ?? 'cover') as 'cover', borderRadius: Number(block.props.borderRadius ?? 8) }} />
      </div>
    ) : <div className="mb-4 rounded bg-gray-100 p-12 text-center text-sm text-gray-500">Image</div>;
  }
  if (block.type === 'button') {
    return <a href={String(block.props.href ?? '#')} className="mb-4 inline-block rounded px-4 py-2 text-white" style={{ backgroundColor: theme.primaryColor }}>{String(block.props.label ?? 'Button')}</a>;
  }
  if (block.type === 'icon') {
    return <div className="mb-4 flex items-center gap-3"><i className={String(block.props.iconClass ?? 'fa-solid fa-star')} style={{ color: String(block.props.color ?? theme.primaryColor), fontSize: `${Number(block.props.size ?? 36)}px` }} /><span>{String(block.props.label ?? '')}</span></div>;
  }
  if (block.type === 'menu') {
    const links = getMenuLinks(block);
    const vertical = block.props.orientation === 'vertical' || block.props.orientation === 'sidebar';
    return <nav className={`mb-4 flex ${vertical ? 'flex-col items-start' : 'flex-wrap items-center'} gap-3`}>{links.map((link) => <a key={`${link.label}-${link.href}`} href={link.href} className="text-sm font-medium hover:underline" style={{ color: theme.primaryColor }}>{link.label}</a>)}</nav>;
  }
  if (block.type === 'announcement-bar') {
    return <div className="text-center text-sm font-semibold" style={{ background: String(block.props.background ?? '#6f21b6'), color: String(block.props.color ?? '#ffffff'), padding: '12px 20px' }}>{String(block.props.text ?? 'Free shipping on all domestic orders over $35')}</div>;
  }
  if (block.type === 'store-header') {
    return <StoreHeaderPreview block={block} />;
  }
  if (block.type === 'hero-slider') {
    return <HeroSliderPreview block={block} theme={theme} />;
  }
  if (block.type === 'grid') {
    const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 3)));
    const children = block.children ?? [];
    return <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{children.length > 0 ? children.map((child) => <EditableBlock key={child.id} block={child} components={components} savedForms={savedForms} savedSliders={savedSliders} theme={theme} storePreview={storePreview} selectedBlockId={selectedBlockId ?? ''} onSelectBlock={onSelectBlock ?? (() => undefined)} onRemoveBlock={onRemoveBlock ?? (() => undefined)} onDragStart={() => undefined} onDrop={() => undefined} active={Boolean(active)} />) : <div className="rounded border border-dashed p-6 text-sm text-gray-500">Select this grid and add widgets from the right panel.</div>}</div>;
  }
  if (block.type === 'image-slider') {
    const mode = String(block.props.mode ?? (block.props.sliderSlug ? 'saved-slider' : 'legacy-images'));
    if (mode === 'saved-slider') {
      const selectedSlider = savedSliders.find((item) => item.id === block.props.sliderId || item.slug === block.props.sliderSlug);
      return selectedSlider ? (
        <PublicSliderEmbed slider={selectedSlider} />
      ) : (
        <div className="mb-6 rounded border border-dashed p-6 text-sm text-gray-500">Choose a saved slider in the block options.</div>
      );
    }
    if (mode === 'video') {
      const url = String(block.props.videoUrl ?? '');
      return <div className="mb-6 overflow-hidden rounded border bg-black" style={{ aspectRatio: String(block.props.aspectRatio ?? '16 / 9') }}>{url ? videoEmbed(url) : <div className="flex h-full min-h-64 items-center justify-center text-sm text-white">Video widget</div>}</div>;
    }
    const slides = getSlides(block);
    const height = `${Number(block.props.height ?? 360)}px`;
    return <AnimatedSlider slides={slides} height={height} seconds={Number(block.props.slideSeconds ?? 5)} fallback="Select images for this slider." />;
  }
  if (block.type === 'video') {
    const url = String(block.props.url ?? '');
    return <div className="mb-6 overflow-hidden rounded border bg-black" style={{ aspectRatio: String(block.props.aspectRatio ?? '16 / 9') }}>{url ? videoEmbed(url) : <div className="flex h-full items-center justify-center text-sm text-white">Video embed</div>}</div>;
  }
  if (block.type === 'sidebar-widgets') {
    return <aside className="mb-6 rounded border bg-gray-50 p-4">{getLines(block.props.itemsText, ['Search', 'Categories', 'Recent posts']).map((item) => <div key={item} className="border-b py-2 text-sm last:border-b-0">{item}</div>)}</aside>;
  }
  if (block.type === 'saved-form') {
    const selectedForm = savedForms.find((item) => item.id === block.props.formId || item.slug === block.props.formSlug);
    const title = String(block.props.formTitle || selectedForm?.title || 'Saved form');
    const slug = String(block.props.formSlug || selectedForm?.slug || '');
    return (
      <div className="mb-6 rounded-lg border border-dashed border-indigo-200 bg-indigo-50 p-5">
        {block.props.displayTitle !== false && <h3 className="text-lg font-semibold text-indigo-950">{title}</h3>}
        <p className="mt-1 text-sm text-indigo-700">
          {slug ? `Embedded form: /forms/${slug}` : 'Choose a saved form in the block options.'}
        </p>
        <div className="mt-4 space-y-2">
          <div className="h-10 rounded border bg-white" />
          <div className="h-24 rounded border bg-white" />
          <span className="inline-block rounded px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: theme.primaryColor }}>
            Submit
          </span>
        </div>
      </div>
    );
  }
  if (block.type === 'product-grid') {
    const products = storePreview.products.slice(0, Number(block.props.limit ?? 3));
    return <div className="mb-6 grid gap-4 md:grid-cols-3">{products.map((product) => <div key={product.id} className="rounded border bg-white p-4 shadow-sm"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-sm text-gray-500">{product.description}</p><p className="mt-3 text-xl font-bold" style={{ color: theme.primaryColor }}>${Number(product.price).toFixed(2)}</p></div>)}</div>;
  }
  if (block.type === 'product-categories') {
    return <div className="mb-6 flex flex-wrap gap-2">{storePreview.categories.map((category) => <span key={category.id} className="rounded-full border px-3 py-1 text-sm">{category.name}</span>)}</div>;
  }
  if (block.type === 'product-tags') {
    return <div className="mb-6 flex flex-wrap gap-2">{storePreview.tags.map((tag) => <span key={tag.id} className="rounded bg-gray-100 px-3 py-1 text-sm">#{tag.name}</span>)}</div>;
  }
  if (block.type === 'global') {
    const component = components.find((item) => item.id === block.props.componentId);
    return component ? <PreviewBlock block={component.schemaJson} components={components} savedForms={savedForms} savedSliders={savedSliders} theme={theme} storePreview={storePreview} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onRemoveBlock={onRemoveBlock} active={active} /> : <div className="rounded border p-3 text-sm text-gray-500">Global component</div>;
  }
  const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 2)));
  const children = block.children ?? [];
  return <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{children.length > 0 ? children.map((child) => <EditableBlock key={child.id} block={child} components={components} savedForms={savedForms} savedSliders={savedSliders} theme={theme} storePreview={storePreview} selectedBlockId={selectedBlockId ?? ''} onSelectBlock={onSelectBlock ?? (() => undefined)} onRemoveBlock={onRemoveBlock ?? (() => undefined)} onDragStart={() => undefined} onDrop={() => undefined} active={Boolean(active)} />) : <div className="rounded border border-dashed p-6 text-sm text-gray-500">Select this container and add widgets from the right panel.</div>}</div>;
}

export function EditableBlock({
  block,
  components,
  savedForms,
  savedSliders,
  theme,
  storePreview,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  onDragStart,
  onDrop,
  active,
}: {
  block: BuilderBlock;
  components: Array<{ id: string; schemaJson: BuilderBlock }>;
  savedForms: SavedFormLite[];
  savedSliders: SavedSliderLite[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  selectedBlockId: string;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onDragStart: () => void;
  onDrop: () => void;
  active: boolean;
}) {
  const selected = selectedBlockId === block.id;
  return (
    <div draggable={active} onClick={(event) => { event.stopPropagation(); if (active) onSelectBlock(block.id); }} onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(); }} className={`group/block relative cursor-move rounded px-2 py-1 ${selected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-indigo-300'}`}>
      <div className="absolute right-2 top-2 z-20 hidden rounded bg-white shadow group-hover/block:block">
        <button onClick={(event) => { event.stopPropagation(); onRemoveBlock(block.id); }} className="px-2 py-1 text-xs text-red-600">Remove</button>
      </div>
      <PreviewBlock block={block} components={components} savedForms={savedForms} savedSliders={savedSliders} theme={theme} storePreview={storePreview} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onRemoveBlock={onRemoveBlock} active={active} />
    </div>
  );
}

export function PreviewSidebar() {
  return (
    <aside className="rounded border bg-gray-50 p-4 text-sm text-gray-500">
      Sidebar content
    </aside>
  );
}

export function PreviewLayout({
  layout,
  active,
  showChrome,
  components,
  savedForms,
  savedSliders,
  theme,
  storePreview,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  onDragStart,
  onMoveBlock,
  onAddBlock,
}: {
  layout: BuilderLayout;
  active: boolean;
  showChrome: boolean;
  components: Array<{ id: string; schemaJson: BuilderBlock }>;
  savedForms: SavedFormLite[];
  savedSliders: SavedSliderLite[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  selectedBlockId: string;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onDragStart: (id: string) => void;
  onMoveBlock: (sectionId: string, index: number) => void;
  onAddBlock: (type: BuilderBlockType, sectionId: string) => void;
}) {
  return (
    <div>
      {showChrome && layout.settings?.breadcrumbs !== false && (
        <div className="border-b bg-gray-50 px-8 py-3 text-sm text-gray-500">Home / Preview</div>
      )}
      <div className={showChrome ? pageShellClass(layout.settings?.layout) : ''}>
        {showChrome && layout.settings?.layout === 'sidebar-left' && <PreviewSidebar />}
        <div>
          {layout.sections.map((section) => (
            <section key={section.id} style={{ background: section.settings.background, padding: section.settings.padding }} onDragOver={(event) => event.preventDefault()} onDrop={() => active && onMoveBlock(section.id, section.blocks.length)} className="group/section relative">
              {active && (
                <div className="absolute right-3 top-3 z-10 hidden gap-2 rounded bg-white/90 p-2 shadow group-hover/section:flex">
                  <button onClick={() => onAddBlock('heading', section.id)} className="rounded border px-2 py-1 text-xs">Heading</button>
                  <button onClick={() => onAddBlock('text', section.id)} className="rounded border px-2 py-1 text-xs">Text</button>
                  <button onClick={() => onAddBlock('image', section.id)} className="rounded border px-2 py-1 text-xs">Image</button>
                </div>
              )}
              <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-5xl'}>
                {section.blocks.length === 0 ? (
                  active ? <button onClick={() => onAddBlock('heading', section.id)} className="w-full rounded border border-dashed p-10 text-sm text-gray-500">Add content</button> : null
                ) : (
                  section.blocks.map((block, index) => (
                    <EditableBlock key={block.id} block={block} components={components} savedForms={savedForms} savedSliders={savedSliders} theme={theme} storePreview={storePreview} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onRemoveBlock={onRemoveBlock} onDragStart={() => active && onDragStart(block.id)} onDrop={() => active && onMoveBlock(section.id, index)} active={active} />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
        {showChrome && layout.settings?.layout === 'sidebar-right' && <PreviewSidebar />}
      </div>
    </div>
  );
}

export function ContainerChildControls({
  block,
  widgets,
  onAddChild,
}: {
  block: BuilderBlock;
  widgets: BuilderWidget[];
  onAddChild: (type: BuilderBlockType) => void;
}) {
  const childCount = block.children?.length ?? 0;
  return (
    <div className="rounded border border-dashed p-3">
      <p className="mb-2 text-xs text-gray-500">
        {childCount} nested widget{childCount === 1 ? '' : 's'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {widgets
          .filter((widget) => widget.enabled && widget.type !== 'grid' && widget.type !== 'columns')
          .map((widget) => (
            <button
              key={widget.type}
              type="button"
              onClick={() => onAddChild(widget.type)}
              className="rounded border px-2 py-1 text-left text-xs hover:border-indigo-300 hover:bg-indigo-50"
            >
              {widget.label}
            </button>
          ))}
      </div>
    </div>
  );
}

export function MediaSlidePicker({
  block,
  mediaAssets,
  onChange,
}: {
  block: BuilderBlock;
  mediaAssets: MediaAsset[];
  onChange: (props: Record<string, unknown>) => void;
}) {
  const selectedIds = Array.isArray(block.props.mediaIds)
    ? block.props.mediaIds.map(String)
    : String(block.props.mediaId ?? '')
      ? [String(block.props.mediaId)]
      : [];

  return (
    <div className="rounded border p-3">
      <p className="mb-2 text-sm font-medium text-gray-700">Slides</p>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {mediaAssets.map((asset) => {
          const checked = selectedIds.includes(asset.id);
          return (
            <label key={asset.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const nextIds = event.target.checked
                    ? [...selectedIds, asset.id]
                    : selectedIds.filter((id) => id !== asset.id);
                  const slides = nextIds
                    .map((id) => mediaAssets.find((item) => item.id === id))
                    .filter(Boolean)
                    .map((item) => ({
                      id: item!.id,
                      src: item!.url,
                      alt: item!.altText || item!.title || item!.originalName,
                    }));
                  const firstSlide = slides[0];
                  onChange({
                    mediaIds: nextIds,
                    mediaId: firstSlide?.id ?? '',
                    src: firstSlide?.src ?? '',
                    alt: firstSlide?.alt ?? '',
                    slides,
                  });
                }}
              />
              <span className="truncate">{asset.title || asset.originalName}</span>
            </label>
          );
        })}
      </div>
      {mediaAssets.length === 0 && (
        <p className="text-xs text-gray-500">Upload images in Media Library, then refresh to select them.</p>
      )}
    </div>
  );
}

export function BlockEditor({
  block,
  onChange,
  onAddChild,
  onRemove,
  theme,
  mediaAssets,
  savedForms,
  savedSliders,
  widgets,
}: {
  block: BuilderBlock;
  onChange: (props: Record<string, unknown>) => void;
  onAddChild: (type: BuilderBlockType) => void;
  onRemove: () => void;
  theme: ThemePreviewStyles;
  mediaAssets: MediaAsset[];
  savedForms: SavedFormLite[];
  savedSliders: SavedSliderLite[];
  widgets: BuilderWidget[];
}) {
  const text = String(block.props.text ?? block.props.label ?? '');
  const href = String(block.props.href ?? '');
  const imageUrl = String(block.props.src ?? '');
  const mediaId = String(block.props.mediaId ?? '');
  const selectedMedia = mediaAssets.find((asset) => asset.id === mediaId) ?? mediaAssets.find((asset) => asset.url === imageUrl) ?? null;
  const fontFamily = String(block.props.fontFamily ?? theme.fontFamily);
  const fontSize = Number(block.props.fontSize ?? (block.type === 'heading' ? 42 : 16));
  const color = String(block.props.color ?? (block.type === 'heading' ? theme.primaryColor : '#374151'));
  return (
    <div className="space-y-3">
      <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">{block.type}</div>
      <button
        type="button"
        onClick={onRemove}
        className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Delete Selected Block
      </button>
      {['heading', 'text', 'button'].includes(block.type) && (
        <label className="block text-sm font-medium text-gray-700">
          Text
          <textarea value={text} rows={4} onChange={(event) => onChange(block.type === 'button' ? { label: event.target.value } : { text: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </label>
      )}
      {['heading', 'text'].includes(block.type) && (
        <>
          <input value={fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })} className="w-full rounded border px-3 py-2 text-sm" placeholder="Font family" />
          <label className="block text-sm font-medium text-gray-700">
            Font Size
            <input type="number" min="10" max="120" value={fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Color
            <input type="color" value={color} onChange={(event) => onChange({ color: event.target.value })} className="mt-1 h-10 w-full rounded border" />
          </label>
          <select value={String(block.props.align ?? 'left')} onChange={(event) => onChange({ align: event.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </>
      )}
      {block.type === 'image' && (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Image
            <select
              value={selectedMedia?.id ?? ''}
              onChange={(event) => {
                const asset = mediaAssets.find((item) => item.id === event.target.value);
                onChange(asset ? { mediaId: asset.id, src: asset.url, alt: asset.altText || asset.title || asset.originalName } : { mediaId: '', src: '', alt: '' });
              }}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Choose from media library</option>
              {mediaAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title || asset.originalName}
                </option>
              ))}
            </select>
          </label>
          {selectedMedia ? (
            <div className="overflow-hidden rounded border bg-gray-50">
              <img src={selectedMedia.url} alt={selectedMedia.altText || selectedMedia.title} className="h-32 w-full object-cover" />
              <p className="truncate px-3 py-2 text-xs text-gray-600">{selectedMedia.originalName}</p>
            </div>
          ) : (
            <p className="rounded border border-dashed px-3 py-2 text-xs text-gray-500">
              Upload images in Media Library, then refresh to select them here.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={Number(block.props.width ?? 100)} onChange={(event) => onChange({ width: Number(event.target.value) })} className="rounded border px-3 py-2 text-sm" placeholder="Width %" />
            <input type="number" value={Number(block.props.height ?? 320)} onChange={(event) => onChange({ height: Number(event.target.value) })} className="rounded border px-3 py-2 text-sm" placeholder="Height px" />
          </div>
          <select value={String(block.props.objectFit ?? 'cover')} onChange={(event) => onChange({ objectFit: event.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option value="cover">Crop to Fit</option>
            <option value="contain">Show Full Image</option>
            <option value="fill">Stretch</option>
          </select>
          <select value={String(block.props.align ?? 'center')} onChange={(event) => onChange({ align: event.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </>
      )}
      {block.type === 'button' && (
        <label className="block text-sm font-medium text-gray-700">Link<input value={href} onChange={(event) => onChange({ href: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
      {block.type === 'icon' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Font Awesome Class<input value={String(block.props.iconClass ?? 'fa-solid fa-star')} onChange={(event) => onChange({ iconClass: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Label<input value={String(block.props.label ?? '')} onChange={(event) => onChange({ label: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Size<input type="number" min="12" max="120" value={Number(block.props.size ?? 36)} onChange={(event) => onChange({ size: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Color<input type="color" value={String(block.props.color ?? theme.primaryColor)} onChange={(event) => onChange({ color: event.target.value })} className="mt-1 h-10 w-full rounded border" /></label>
        </>
      )}
      {block.type === 'menu' && (
        <>
          <select value={String(block.props.source ?? 'header')} onChange={(event) => onChange({ source: event.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option value="header">Header menu</option>
            <option value="footer">Footer menu</option>
            <option value="custom">Custom links</option>
          </select>
          <select value={String(block.props.orientation ?? 'horizontal')} onChange={(event) => onChange({ orientation: event.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
            <option value="sidebar">Sidebar</option>
          </select>
          <select value={String(block.props.placement ?? 'header')} onChange={(event) => onChange({ placement: event.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option value="header">Header</option>
            <option value="footer">Footer</option>
            <option value="sidebar">Sidebar</option>
            <option value="content">Content</option>
          </select>
          <label className="block text-sm font-medium text-gray-700">Custom Links (label|url per line)<textarea value={String(block.props.linksText ?? '')} rows={4} onChange={(event) => onChange({ linksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
      {block.type === 'announcement-bar' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Message<textarea value={String(block.props.text ?? '')} rows={2} onChange={(event) => onChange({ text: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Background<input type="color" value={String(block.props.background ?? '#6f21b6')} onChange={(event) => onChange({ background: event.target.value })} className="mt-1 h-10 w-full rounded border" /></label>
          <label className="block text-sm font-medium text-gray-700">Text Color<input type="color" value={String(block.props.color ?? '#ffffff')} onChange={(event) => onChange({ color: event.target.value })} className="mt-1 h-10 w-full rounded border" /></label>
        </>
      )}
      {block.type === 'store-header' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Logo Text<input value={String(block.props.logoText ?? 'The Psychic Link')} onChange={(event) => onChange({ logoText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Social Icons (icon class|url|label per line)<textarea value={String(block.props.socialLinksText ?? '')} rows={4} onChange={(event) => onChange({ socialLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Top Links (label|url per line)<textarea value={String(block.props.topLinksText ?? '')} rows={3} onChange={(event) => onChange({ topLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Main Nav (label|url per line)<textarea value={String(block.props.navLinksText ?? '')} rows={5} onChange={(event) => onChange({ navLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Action Icons (icon class|url|label per line)<textarea value={String(block.props.actionLinksText ?? '')} rows={4} onChange={(event) => onChange({ actionLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={block.props.showActions !== false} onChange={(event) => onChange({ showActions: event.target.checked })} /> Show login/search/wishlist/cart icons</label>
        </>
      )}
      {block.type === 'hero-slider' && (
        <>
          <MediaSlidePicker block={block} mediaAssets={mediaAssets} onChange={onChange} />
          <label className="block text-sm font-medium text-gray-700">Heading<input value={String(block.props.heading ?? 'Welcome')} onChange={(event) => onChange({ heading: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Button Label<input value={String(block.props.buttonLabel ?? 'SHOP NOW')} onChange={(event) => onChange({ buttonLabel: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Button Link<input value={String(block.props.buttonHref ?? '/shop')} onChange={(event) => onChange({ buttonHref: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Height<input type="number" min="320" max="900" value={Number(block.props.height ?? 610)} onChange={(event) => onChange({ height: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Slide Speed (seconds)<input type="number" min="2" max="20" value={Number(block.props.slideSeconds ?? 5)} onChange={(event) => onChange({ slideSeconds: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
      {block.type === 'grid' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Columns<input type="number" min="2" max="6" value={Number(block.props.columns ?? 3)} onChange={(event) => onChange({ columns: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <ContainerChildControls block={block} widgets={widgets} onAddChild={onAddChild} />
        </>
      )}
      {block.type === 'columns' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Columns<input type="number" min="2" max="6" value={Number(block.props.columns ?? 2)} onChange={(event) => onChange({ columns: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <ContainerChildControls block={block} widgets={widgets} onAddChild={onAddChild} />
        </>
      )}
      {block.type === 'image-slider' && (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Widget Mode
            <select value={String(block.props.mode ?? 'saved-slider')} onChange={(event) => onChange({ mode: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="saved-slider">Saved slider</option>
              <option value="video">Video</option>
              <option value="legacy-images">Legacy image list</option>
            </select>
          </label>
          {String(block.props.mode ?? 'saved-slider') === 'saved-slider' && (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Saved Slider
                <select
                  value={String(block.props.sliderId ?? '')}
                  onChange={(event) => {
                    const selectedSlider = savedSliders.find((item) => item.id === event.target.value);
                    onChange({
                      sliderId: selectedSlider?.id ?? '',
                      sliderSlug: selectedSlider?.slug ?? '',
                      sliderTitle: selectedSlider?.title ?? '',
                    });
                  }}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">Choose a saved slider</option>
                  {savedSliders.map((savedSlider) => (
                    <option key={savedSlider.id} value={savedSlider.id}>
                      {savedSlider.title} ({savedSlider.status.toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>
              {savedSliders.length === 0 && (
                <p className="rounded border border-dashed px-3 py-2 text-xs text-gray-500">
                  Create a slider under Admin Sliders, then refresh this editor to select it.
                </p>
              )}
            </>
          )}
          {block.props.mode === 'video' && (
            <>
              <label className="block text-sm font-medium text-gray-700">Video URL<input value={String(block.props.videoUrl ?? '')} onChange={(event) => onChange({ videoUrl: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="YouTube, Vimeo, or MP4 URL" /></label>
              <label className="block text-sm font-medium text-gray-700">Aspect Ratio<select value={String(block.props.aspectRatio ?? '16 / 9')} onChange={(event) => onChange({ aspectRatio: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="16 / 9">16:9</option><option value="4 / 3">4:3</option><option value="1 / 1">Square</option></select></label>
            </>
          )}
          {block.props.mode === 'legacy-images' && (
            <>
              <MediaSlidePicker block={block} mediaAssets={mediaAssets} onChange={onChange} />
              <label className="block text-sm font-medium text-gray-700">Height<input type="number" min="120" max="800" value={Number(block.props.height ?? 360)} onChange={(event) => onChange({ height: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Slide Speed (seconds)<input type="number" min="2" max="20" value={Number(block.props.slideSeconds ?? 5)} onChange={(event) => onChange({ slideSeconds: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            </>
          )}
        </>
      )}
      {block.type === 'video' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Video URL<input value={String(block.props.url ?? '')} onChange={(event) => onChange({ url: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="YouTube, Vimeo, or MP4 URL" /></label>
          <label className="block text-sm font-medium text-gray-700">Aspect Ratio<select value={String(block.props.aspectRatio ?? '16 / 9')} onChange={(event) => onChange({ aspectRatio: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="16 / 9">16:9</option><option value="4 / 3">4:3</option><option value="1 / 1">Square</option></select></label>
        </>
      )}
      {block.type === 'sidebar-widgets' && (
        <label className="block text-sm font-medium text-gray-700">Widgets (one per line)<textarea value={String(block.props.itemsText ?? 'Search\nCategories\nRecent posts')} rows={4} onChange={(event) => onChange({ itemsText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
      {block.type === 'product-grid' && (
        <label className="block text-sm font-medium text-gray-700">Products to Show<input type="number" min="1" max="12" value={Number(block.props.limit ?? 3)} onChange={(event) => onChange({ limit: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
      {block.type === 'saved-form' && (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Saved Form
            <select
              value={String(block.props.formId ?? '')}
              onChange={(event) => {
                const selectedForm = savedForms.find((item) => item.id === event.target.value);
                onChange({
                  formId: selectedForm?.id ?? '',
                  formSlug: selectedForm?.slug ?? '',
                  formTitle: selectedForm?.title ?? '',
                });
              }}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Choose a saved form</option>
              {savedForms.map((savedForm) => (
                <option key={savedForm.id} value={savedForm.id}>
                  {savedForm.title} ({savedForm.status.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={block.props.displayTitle !== false}
              onChange={(event) => onChange({ displayTitle: event.target.checked })}
            />
            Show form title
          </label>
          {savedForms.length === 0 && (
            <p className="rounded border border-dashed px-3 py-2 text-xs text-gray-500">
              Create a form under Admin Forms, then refresh this editor to select it.
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface GlobalComponentLite {
  id: string;
  schemaJson: BuilderBlock;
}

/**
 * Drag-and-drop page design canvas (widget palette + live canvas + selected-block panel),
 * shared between the per-page Pages editor and the Theme Builder so both stay rendered
 * identically to the public site.
 */
export function PageDesignCanvas({
  layout,
  onChange,
  saving,
  status,
  error,
  onSave,
  theme = DEFAULT_THEME_PREVIEW_STYLES,
  fullScreen = false,
}: {
  layout: BuilderLayout;
  onChange: (updater: (current: BuilderLayout) => BuilderLayout) => void;
  saving: boolean;
  status: string;
  error: string;
  onSave: () => void;
  theme?: ThemePreviewStyles;
  fullScreen?: boolean;
}) {
  const [widgets, setWidgets] = useState<BuilderWidget[]>(defaultWidgets);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [storePreview, setStorePreview] = useState<StorePreviewData>(emptyStorePreview);
  const [components, setComponents] = useState<GlobalComponentLite[]>([]);
  const [savedForms, setSavedForms] = useState<SavedFormLite[]>([]);
  const [savedSliders, setSavedSliders] = useState<SavedSliderLite[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [dragBlockId, setDragBlockId] = useState('');
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>('desktop');

  const fetchResources = useCallback(async () => {
    try {
      const [widgetsRes, mediaRes, productsRes, categoriesRes, tagsRes, componentsRes, formsRes, slidersRes] = await Promise.all([
        fetch('/api/proxy/admin/builder/widgets'),
        fetch('/api/proxy/media'),
        fetch('/api/proxy/products/all'),
        fetch('/api/proxy/admin/categories'),
        fetch('/api/proxy/admin/tags'),
        fetch('/api/proxy/admin/builder/components'),
        fetch('/api/proxy/admin/forms'),
        fetch('/api/proxy/admin/sliders'),
      ]);
      if (widgetsRes.ok) {
        const nextWidgets = (await widgetsRes.json()) as BuilderWidget[];
        setWidgets(nextWidgets.length > 0 ? mergeWidgets(nextWidgets) : defaultWidgets);
      }
      if (mediaRes.ok) setMediaAssets(((await mediaRes.json()) as MediaAsset[]).filter((asset) => asset.isImage));
      const [products, categories, tags] = await Promise.all([
        productsRes.ok ? productsRes.json() : [],
        categoriesRes.ok ? categoriesRes.json() : [],
        tagsRes.ok ? tagsRes.json() : [],
      ]);
      setStorePreview({ products, categories, tags });
      if (componentsRes.ok) setComponents((await componentsRes.json()) as GlobalComponentLite[]);
      if (formsRes.ok) setSavedForms((await formsRes.json()) as SavedFormLite[]);
      if (slidersRes.ok) setSavedSliders((await slidersRes.json()) as SavedSliderLite[]);
    } catch {
      // Resource loading failures degrade gracefully — palette/preview just show fewer options.
    }
  }, []);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  const groupedWidgets = useMemo(() => groupWidgets(mergeWidgets(widgets)), [widgets]);
  const selectedBlock = useMemo(() => findBlockInLayout(layout, selectedBlockId), [layout, selectedBlockId]);

  function addBlock(type: BuilderBlockType, sectionId?: string) {
    const targetSectionId = sectionId ?? layout.sections[0]?.id;
    if (!targetSectionId) return;
    const block = createBlock(type, widgets.find((widget) => widget.type === type));
    onChange((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === targetSectionId ? { ...section, blocks: [...section.blocks, block] } : section,
      ),
    }));
    setSelectedBlockId(block.id);
  }

  function updateBlock(blockId: string, props: Record<string, unknown>) {
    onChange((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: mapBlocks(section.blocks, (block) =>
          block.id === blockId ? { ...block, props: { ...block.props, ...props } } : block,
        ),
      })),
    }));
  }

  function addChildBlock(parentId: string, type: BuilderBlockType) {
    const block = createBlock(type, widgets.find((widget) => widget.type === type));
    onChange((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: mapBlocks(section.blocks, (candidate) =>
          candidate.id === parentId
            ? { ...candidate, children: [...(candidate.children ?? []), block] }
            : candidate,
        ),
      })),
    }));
    setSelectedBlockId(block.id);
  }

  function removeBlock(blockId: string) {
    onChange((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        blocks: removeBlockById(section.blocks, blockId),
      })),
    }));
    setSelectedBlockId('');
  }

  function moveBlock(targetSectionId: string, targetIndex: number) {
    if (!dragBlockId) return;
    const dragged = layout.sections.flatMap((section) => section.blocks).find((block) => block.id === dragBlockId);
    if (!dragged) return;
    onChange((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        const withoutDragged = section.blocks.filter((block) => block.id !== dragBlockId);
        if (section.id !== targetSectionId) return { ...section, blocks: withoutDragged };
        const nextBlocks = [...withoutDragged];
        nextBlocks.splice(targetIndex, 0, dragged);
        return { ...section, blocks: nextBlocks };
      }),
    }));
    setDragBlockId('');
  }

  function addSection() {
    onChange((current) => ({
      ...current,
      sections: [
        ...current.sections,
        { id: createId('section'), type: 'section', settings: { layout: 'contained', background: '#ffffff', padding: '56px 32px' }, blocks: [] },
      ],
    }));
  }

  return (
    <div
      className={`grid overflow-hidden border border-gray-200 bg-white ${
        fullScreen
          ? 'h-[calc(100vh-72px)] xl:grid-cols-[240px_minmax(0,1fr)_320px]'
          : 'gap-4 rounded-lg xl:grid-cols-[220px_minmax(0,1fr)_300px]'
      }`}
    >
      <aside className="min-h-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          {(['desktop', 'tablet', 'mobile'] as ResponsiveMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setResponsiveMode(mode)}
              className={`rounded border px-2 py-1 text-xs capitalize hover:bg-white ${responsiveMode === mode ? 'border-indigo-500 bg-white text-indigo-700' : 'bg-white'}`}
            >
              {mode}
            </button>
          ))}
        </div>
        {Object.entries(groupedWidgets).map(([category, categoryWidgets]) => (
          <div key={category} className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-gray-400">{category}</h3>
            <div className="grid gap-2">
              {categoryWidgets.map((widget) => (
                <button
                  key={widget.type}
                  type="button"
                  onClick={() => addBlock(widget.type)}
                  className="rounded border bg-white px-3 py-2 text-left text-xs hover:border-indigo-300 hover:bg-indigo-50"
                >
                  {widget.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addSection} className="w-full rounded bg-gray-900 px-3 py-2 text-xs font-medium text-white">Add section</button>
      </aside>

      <section className={`min-h-0 overflow-auto bg-gray-200 ${fullScreen ? 'p-3' : 'p-4'}`}>
        <div className="mx-auto bg-white shadow-xl transition-all" style={{ maxWidth: responsiveWidth(responsiveMode), fontFamily: theme.fontFamily }}>
          <PreviewLayout
            layout={layout}
            active
            showChrome
            components={components}
            savedForms={savedForms}
            savedSliders={savedSliders}
            theme={theme}
            storePreview={storePreview}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onRemoveBlock={removeBlock}
            onDragStart={setDragBlockId}
            onMoveBlock={moveBlock}
            onAddBlock={addBlock}
          />
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Selected Block</h3>
        {selectedBlock ? (
          <BlockEditor
            block={selectedBlock}
            onChange={(props) => updateBlock(selectedBlock.id, props)}
            onAddChild={(type) => addChildBlock(selectedBlock.id, type)}
            onRemove={() => removeBlock(selectedBlock.id)}
            theme={theme}
            mediaAssets={mediaAssets}
            savedForms={savedForms}
            savedSliders={savedSliders}
            widgets={mergeWidgets(widgets)}
          />
        ) : (
          <p className="text-sm text-gray-500">Select content in the live preview to edit it.</p>
        )}
        <div className="mt-5 space-y-2">
          {status && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="button" onClick={onSave} disabled={saving} className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving design...' : 'Save page layout/design'}
          </button>
        </div>
      </aside>
    </div>
  );
}

/** Read-only render of a layout, for static previews (e.g. the Preview tab). */
export function BuilderLayoutPreview({ layout, theme = DEFAULT_THEME_PREVIEW_STYLES }: { layout: BuilderLayout; theme?: ThemePreviewStyles }) {
  return (
    <PreviewLayout
      layout={layout}
      active={false}
      showChrome
      components={[]}
      savedForms={[]}
      savedSliders={[]}
      theme={theme}
      storePreview={emptyStorePreview}
      selectedBlockId=""
      onSelectBlock={() => undefined}
      onRemoveBlock={() => undefined}
      onDragStart={() => undefined}
      onMoveBlock={() => undefined}
      onAddBlock={() => undefined}
    />
  );
}
