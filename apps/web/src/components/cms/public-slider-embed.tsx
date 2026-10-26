'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export interface SliderLayer {
  id: string;
  type: 'text' | 'button';
  text: string;
  href?: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily?: string;
  color: string;
  background: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  paddingX?: number;
  paddingY?: number;
  hoverBackground?: string;
  hoverColor?: string;
  buttonStyle?: 'solid' | 'outline';
  /** A button that takes its colors, hover colors and rounding from the Site Defaults page. Unset on older buttons. */
  siteStyle?: boolean;
}

/**
 * Whether a slider button takes its look from the Site Defaults page. Buttons saved before the option existed count
 * when they are still the editor's original purple, which means nobody restyled them.
 */
export function layerFollowsSite(layer: Pick<SliderLayer, 'type' | 'siteStyle' | 'buttonStyle' | 'background'>) {
  if (layer.type !== 'button') return false;
  if (typeof layer.siteStyle === 'boolean') return layer.siteStyle;
  return layer.buttonStyle !== 'outline' && layer.background.trim().toLowerCase() === '#6f21b6';
}

export interface SliderSlide {
  id: string;
  type: 'image' | 'video';
  mediaId?: string;
  src?: string;
  videoUrl?: string;
  alt?: string;
  layers: SliderLayer[];
}

export interface SliderSettings {
  height: number;
  width?: 'content' | 'wide' | 'full';
  autoPlay: boolean;
  slideSeconds: number;
  transition: string;
}

export interface CmsSlider {
  id?: string;
  slug: string;
  title: string;
  description?: string | null;
  status?: string;
  slides: SliderSlide[];
  settings: SliderSettings;
}

export function PublicSliderEmbed({ slug, slider: providedSlider }: { slug?: string; slider?: CmsSlider | null }) {
  const [slider, setSlider] = useState<CmsSlider | null>(providedSlider ?? null);
  const [loading, setLoading] = useState(Boolean(slug) && !providedSlider);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (providedSlider) {
      setSlider(providedSlider);
      setActiveIndex((current) => Math.min(current, Math.max(0, (providedSlider.slides?.length ?? 1) - 1)));
    }
  }, [providedSlider]);

  useEffect(() => {
    async function loadSlider() {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/proxy/sliders/${slug}`);
        setSlider(res.ok ? ((await res.json()) as CmsSlider) : null);
      } finally {
        setLoading(false);
      }
    }

    if (!providedSlider) void loadSlider();
  }, [providedSlider, slug]);

  const slides = useMemo(() => normalizeSlides(slider?.slides), [slider?.slides]);
  const settings = normalizeSettings(slider?.settings);

  useEffect(() => {
    if (!settings.autoPlay || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, settings.slideSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [settings.autoPlay, settings.slideSeconds, slides.length]);

  if (loading) return <div className="mb-6 rounded border p-6 text-sm text-gray-500">Loading slider...</div>;
  if (!slider || slides.length === 0) return <div className="mb-6 rounded border border-dashed p-6 text-sm text-gray-500">No slider selected.</div>;

  const activeSlide = slides[Math.min(activeIndex, slides.length - 1)];

  return (
    <section className={sliderWidthClass(settings.width)} style={{ height: settings.height }}>
      <SliderMedia slide={activeSlide} />
      <div className="absolute inset-0 bg-black/20" />
      {activeSlide.layers.map((layer) => (
        <SliderLayerView key={layer.id} layer={layer} />
      ))}
      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => setActiveIndex((activeIndex - 1 + slides.length) % slides.length)} className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">‹</button>
          <button type="button" onClick={() => setActiveIndex((activeIndex + 1) % slides.length)} className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30">›</button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" onClick={() => setActiveIndex(index)} className={`h-2.5 w-2.5 rounded-full ${index === activeIndex ? 'bg-white' : 'bg-white/40'}`} aria-label={`Go to slide ${index + 1}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SliderMedia({ slide }: { slide: SliderSlide }) {
  if (slide.type === 'video') {
    const embed = videoEmbed(slide.videoUrl ?? slide.src ?? '');
    if (embed) return embed;
  }

  if (!slide.src) {
    return <div className="absolute inset-0 grid place-items-center bg-gray-800 text-sm text-white">Choose an image or video</div>;
  }

  return <img src={slide.src} alt={slide.alt ?? ''} className="absolute inset-0 h-full w-full object-cover" />;
}

function SliderLayerView({ layer }: { layer: SliderLayer }) {
  const style = {
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.width}%`,
    color: layer.color,
    fontSize: `${layer.fontSize}px`,
    fontFamily: layer.fontFamily || undefined,
  };

  if (layer.type === 'button') {
    const isOutline = layer.buttonStyle === 'outline';
    // A button that follows the site reads the Site Defaults variables, and falls back to its own values until one is set.
    const follow = layerFollowsSite(layer);
    const ownBorder = layer.borderColor ?? layer.background;
    const siteBackground = follow ? `var(--site-button-bg, ${layer.background})` : layer.background;
    const siteBorder = follow ? `var(--site-button-bg, ${ownBorder})` : ownBorder;
    const siteText = follow ? `var(--site-button-text, ${layer.color})` : layer.color;
    const siteRadius = follow ? `var(--site-button-radius, ${layer.borderRadius ?? 8}px)` : `${layer.borderRadius ?? 8}px`;
    const background = isOutline ? 'transparent' : siteBackground;
    const color = isOutline ? (layer.borderColor ? siteBorder : siteText) : siteText;
    // Hover: the button's own colors (or, when it follows the site, the site's hover colors, else a darker site color).
    const hoverBackground = follow
      ? `var(--site-button-hover-bg, var(--site-button-hover-auto, ${layer.hoverBackground || background}))`
      : layer.hoverBackground || `var(--site-button-hover-bg, ${background})`;
    const hoverText = follow
      ? `var(--site-button-hover-text, ${layer.hoverColor || color})`
      : layer.hoverColor || `var(--site-button-hover-text, ${color})`;
    return (
      <a
        href={layer.href || '#'}
        className="site-slider-button absolute z-10 inline-flex w-fit font-semibold shadow transition"
        style={
          {
            ...style,
            // A button with no font of its own uses the site's button font (the body font if that is not set either).
            fontFamily: layer.fontFamily || 'var(--site-button-font, inherit)',
            fontSize: follow ? `var(--site-button-size, ${layer.fontSize}px)` : `${layer.fontSize}px`,
            background,
            borderColor: siteBorder,
            borderStyle: 'solid',
            borderWidth: `${layer.borderWidth ?? (isOutline ? 2 : 0)}px`,
            borderRadius: siteRadius,
            color,
            padding: `${layer.paddingY ?? 12}px ${layer.paddingX ?? 20}px`,
            '--slider-hover-bg': hoverBackground,
            '--slider-hover-text': hoverText,
          } as CSSProperties
        }
      >
        {layer.text}
      </a>
    );
  }

  return (
    <div className="absolute z-10 font-semibold leading-tight drop-shadow" style={style}>
      {layer.text}
    </div>
  );
}

function normalizeSettings(settings?: Partial<SliderSettings>): SliderSettings {
  return {
    height: clampNumber(settings?.height, 180, 900, 480),
    width: settings?.width === 'wide' || settings?.width === 'full' ? settings.width : 'content',
    autoPlay: settings?.autoPlay !== false,
    slideSeconds: clampNumber(settings?.slideSeconds, 2, 30, 5),
    transition: settings?.transition ?? 'slide',
  };
}

function sliderWidthClass(width?: SliderSettings['width']) {
  const base = 'relative mb-8 overflow-hidden bg-neutral-950';
  if (width === 'full') return `${base} left-1/2 w-screen -translate-x-1/2`;
  if (width === 'wide') return `${base} mx-auto w-full max-w-[1680px]`;
  return `${base} w-full`;
}

export function normalizeSlides(slides?: SliderSlide[]): SliderSlide[] {
  if (!Array.isArray(slides)) return [];
  return slides.map((slide, index) => ({
    id: String(slide.id || `slide-${index + 1}`),
    type: slide.type === 'video' ? 'video' : 'image',
    mediaId: slide.mediaId ?? '',
    src: slide.src ?? '',
    videoUrl: slide.videoUrl ?? '',
    alt: slide.alt ?? '',
    layers: Array.isArray(slide.layers)
      ? slide.layers.map((layer, layerIndex) => ({
          id: String(layer.id || `layer-${layerIndex + 1}`),
          type: layer.type === 'button' ? 'button' : 'text',
          text: String(layer.text ?? 'Layer text'),
          href: layer.href ?? '#',
          x: clampNumber(layer.x, 0, 100, 12),
          y: clampNumber(layer.y, 0, 100, 35),
          width: clampNumber(layer.width, 10, 100, 36),
          fontSize: clampNumber(layer.fontSize, 10, 96, 32),
          fontFamily: layer.fontFamily ?? '',
          color: layer.color ?? '#ffffff',
          background: layer.background ?? '#6f21b6',
          borderColor: layer.borderColor ?? layer.background ?? '#6f21b6',
          borderWidth: clampNumber(layer.borderWidth, 0, 12, 0),
          borderRadius: clampNumber(layer.borderRadius, 0, 80, 8),
          paddingX: clampNumber(layer.paddingX, 4, 80, 20),
          paddingY: clampNumber(layer.paddingY, 4, 50, 12),
          hoverBackground: layer.hoverBackground ?? '',
          hoverColor: layer.hoverColor ?? '',
          buttonStyle: layer.buttonStyle === 'outline' ? 'outline' : 'solid',
          ...(typeof layer.siteStyle === 'boolean' ? { siteStyle: layer.siteStyle } : {}),
        }))
      : [],
  }));
}

function videoEmbed(url: string) {
  if (!url) return null;
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (youtube) return <iframe src={`https://www.youtube.com/embed/${youtube[1]}`} title="Slider video" className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  if (vimeo) return <iframe src={`https://player.vimeo.com/video/${vimeo[1]}`} title="Slider video" className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  return <video src={url} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline controls={false} />;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
