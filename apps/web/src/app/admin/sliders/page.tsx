'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MediaAsset } from '../../../components/admin/media-library';
import { PublicSliderEmbed, type CmsSlider, type SliderLayer, type SliderSlide } from '../../../components/cms/public-slider-embed';

type SliderStatus = 'DRAFT' | 'PUBLISHED';

const emptySlide: SliderSlide = {
  id: 'slide-1',
  type: 'image',
  src: '',
  alt: '',
  layers: [
    { id: 'layer-1', type: 'text', text: 'New slider', x: 12, y: 34, width: 42, fontSize: 44, color: '#ffffff', background: 'transparent' },
    { id: 'layer-2', type: 'button', text: 'Learn More', href: '#', x: 12, y: 58, width: 20, fontSize: 16, color: '#ffffff', background: '#4f46e5' },
  ],
};

const emptySlider: Omit<CmsSlider, 'id'> = {
  slug: '',
  title: '',
  description: '',
  status: 'DRAFT',
  slides: [emptySlide],
  settings: { height: 480, autoPlay: true, slideSeconds: 5, transition: 'slide' },
};

export default function AdminSlidersPage() {
  const [sliders, setSliders] = useState<CmsSlider[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedSliderId, setSelectedSliderId] = useState<string | null>(null);
  const [slider, setSlider] = useState(emptySlider);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedSlider = useMemo(() => sliders.find((entry) => entry.id === selectedSliderId) ?? null, [selectedSliderId, sliders]);
  const imageAssets = useMemo(() => mediaAssets.filter((asset) => asset.isImage), [mediaAssets]);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [slidersRes, mediaRes] = await Promise.all([fetch('/api/proxy/admin/sliders'), fetch('/api/proxy/media')]);
      if (!slidersRes.ok) throw new Error('Could not load sliders');
      if (!mediaRes.ok) throw new Error('Could not load media');
      const nextSliders = (await slidersRes.json()) as CmsSlider[];
      setSliders(nextSliders);
      setMediaAssets((await mediaRes.json()) as MediaAsset[]);
      if (!selectedSliderId && nextSliders[0]?.id) setSelectedSliderId(nextSliders[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load sliders');
    } finally {
      setLoading(false);
    }
  }, [selectedSliderId]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    if (!selectedSlider) return;
    setSlider({
      slug: selectedSlider.slug,
      title: selectedSlider.title,
      description: selectedSlider.description ?? '',
      status: (selectedSlider.status as SliderStatus) ?? 'DRAFT',
      slides: selectedSlider.slides?.length ? selectedSlider.slides : [emptySlide],
      settings: { ...{ height: 480, autoPlay: true, slideSeconds: 5, transition: 'slide' }, ...selectedSlider.settings },
    });
    setActiveSlideIndex(0);
  }, [selectedSlider]);

  function startNew() {
    setSelectedSliderId(null);
    setSlider({ ...emptySlider, title: 'New Slider', slug: 'new-slider', slides: [{ ...emptySlide, id: createId('slide') }] });
    setActiveSlideIndex(0);
    setMessage('');
    setError('');
  }

  async function saveSlider(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...slider, slug: slugify(slider.slug || slider.title) };
      const res = await fetch(selectedSliderId ? `/api/proxy/admin/sliders/${selectedSliderId}` : '/api/proxy/admin/sliders', {
        method: selectedSliderId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Could not save slider');
      }
      const saved = (await res.json()) as CmsSlider;
      setSelectedSliderId(saved.id ?? null);
      setMessage('Slider saved.');
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save slider');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlider() {
    if (!selectedSliderId || !confirm('Delete this slider?')) return;
    setError('');
    const res = await fetch(`/api/proxy/admin/sliders/${selectedSliderId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Could not delete slider');
      return;
    }
    setSelectedSliderId(null);
    setSlider(emptySlider);
    await fetchResources();
  }

  function updateSlide(index: number, nextSlide: Partial<SliderSlide>) {
    setSlider((current) => ({
      ...current,
      slides: current.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...nextSlide } : slide),
    }));
  }

  function updateLayer(slideIndex: number, layerIndex: number, nextLayer: Partial<SliderLayer>) {
    setSlider((current) => ({
      ...current,
      slides: current.slides.map((slide, currentSlideIndex) =>
        currentSlideIndex === slideIndex
          ? { ...slide, layers: slide.layers.map((layer, currentLayerIndex) => currentLayerIndex === layerIndex ? { ...layer, ...nextLayer } : layer) }
          : slide,
      ),
    }));
  }

  function addSlide(type: 'image' | 'video') {
    setSlider((current) => ({
      ...current,
      slides: [...current.slides, { id: createId('slide'), type, src: '', videoUrl: '', alt: '', layers: [] }],
    }));
    setActiveSlideIndex(slider.slides.length);
  }

  function addLayer(type: 'text' | 'button') {
    const layer: SliderLayer = {
      id: createId('layer'),
      type,
      text: type === 'button' ? 'Click Here' : 'New layer',
      href: '#',
      x: 12,
      y: 35,
      width: type === 'button' ? 20 : 40,
      fontSize: type === 'button' ? 16 : 36,
      color: '#ffffff',
      background: type === 'button' ? '#4f46e5' : 'transparent',
    };
    updateSlide(activeSlideIndex, { layers: [...(slider.slides[activeSlideIndex]?.layers ?? []), layer] });
  }

  const activeSlide = slider.slides[activeSlideIndex] ?? slider.slides[0];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sliders</h1>
          <p className="mt-1 text-sm text-gray-600">Create reusable image and video sliders with layered text and buttons.</p>
        </div>
        <button type="button" onClick={startNew} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">New Slider</button>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Saved Sliders</h2>
          {loading ? <p className="mt-4 text-sm text-gray-500">Loading...</p> : sliders.length === 0 ? <p className="mt-4 text-sm text-gray-500">No sliders saved yet.</p> : (
            <div className="mt-4 space-y-2">
              {sliders.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setSelectedSliderId(entry.id ?? null)} className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${selectedSliderId === entry.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="block font-medium text-gray-900">{entry.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">/{entry.slug} · {entry.status?.toLowerCase()} · {entry.slides?.length ?? 0} slides</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <form onSubmit={saveSlider} className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedSliderId ? 'Edit Slider' : 'Create Slider'}</h2>
                <p className="mt-1 text-sm text-gray-500">Public URL: /sliders/{slider.slug || 'your-slider'}</p>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Slider'}</button>
                {selectedSliderId && <button type="button" onClick={deleteSlider} className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">Delete</button>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">Title<input required value={slider.title} onChange={(event) => setSlider((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Slug<input required value={slider.slug} onChange={(event) => setSlider((current) => ({ ...current, slug: slugify(event.target.value) }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Status<select value={slider.status} onChange={(event) => setSlider((current) => ({ ...current, status: event.target.value as SliderStatus }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label>
              <label className="block text-sm font-medium text-gray-700">Height<input type="number" min="180" max="900" value={slider.settings.height} onChange={(event) => setSlider((current) => ({ ...current, settings: { ...current.settings, height: Number(event.target.value) } }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"><input type="checkbox" checked={slider.settings.autoPlay !== false} onChange={(event) => setSlider((current) => ({ ...current, settings: { ...current.settings, autoPlay: event.target.checked } }))} /> Auto play</label>
              <label className="block text-sm font-medium text-gray-700">Slide seconds<input type="number" min="2" max="30" value={slider.settings.slideSeconds} onChange={(event) => setSlider((current) => ({ ...current, settings: { ...current.settings, slideSeconds: Number(event.target.value) } }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live Preview</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addSlide('image')} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">Add Image Slide</button>
                    <button type="button" onClick={() => addSlide('video')} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">Add Video Slide</button>
                  </div>
                </div>
                <PublicSliderEmbed slider={{ ...slider, slug: slider.slug || 'preview' }} />
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap gap-2">
                  {slider.slides.map((slide, index) => (
                    <button key={slide.id} type="button" onClick={() => setActiveSlideIndex(index)} className={`rounded px-3 py-1.5 text-xs ${index === activeSlideIndex ? 'bg-indigo-600 text-white' : 'border bg-white hover:bg-gray-50'}`}>Slide {index + 1}</button>
                  ))}
                </div>
                {activeSlide && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-medium text-gray-700">Slide Type<select value={activeSlide.type} onChange={(event) => updateSlide(activeSlideIndex, { type: event.target.value as 'image' | 'video' })} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="image">Image</option><option value="video">Video</option></select></label>
                      {activeSlide.type === 'image' ? (
                        <label className="block text-sm font-medium text-gray-700">Image<select value={activeSlide.src ?? ''} onChange={(event) => {
                          const asset = imageAssets.find((item) => item.url === event.target.value);
                          updateSlide(activeSlideIndex, { src: asset?.url ?? '', mediaId: asset?.id, alt: asset?.altText || asset?.title || asset?.originalName || '' });
                        }} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">Choose from media library</option>{imageAssets.map((asset) => <option key={asset.id} value={asset.url}>{asset.title || asset.originalName}</option>)}</select></label>
                      ) : (
                        <label className="block text-sm font-medium text-gray-700">Video URL<input value={activeSlide.videoUrl ?? ''} onChange={(event) => updateSlide(activeSlideIndex, { videoUrl: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="YouTube, Vimeo, or MP4 URL" /></label>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addLayer('text')} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">Add Text Layer</button>
                      <button type="button" onClick={() => addLayer('button')} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">Add Button Layer</button>
                      {slider.slides.length > 1 && <button type="button" onClick={() => {
                        setSlider((current) => ({ ...current, slides: current.slides.filter((_, index) => index !== activeSlideIndex) }));
                        setActiveSlideIndex(0);
                      }} className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">Remove Slide</button>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Layers</h3>
              {!activeSlide || activeSlide.layers.length === 0 ? <p className="text-sm text-gray-500">Add text or button layers to this slide.</p> : (
                <div className="space-y-4">
                  {activeSlide.layers.map((layer, layerIndex) => (
                    <div key={layer.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-gray-500">{layer.type}</span>
                        <button type="button" onClick={() => updateSlide(activeSlideIndex, { layers: activeSlide.layers.filter((_, index) => index !== layerIndex) })} className="text-xs text-red-600">Remove</button>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700">Text<input value={layer.text} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { text: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                        {layer.type === 'button' && <label className="block text-xs font-medium text-gray-700">Link<input value={layer.href ?? ''} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { href: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs font-medium text-gray-700">X %<input type="number" value={layer.x} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { x: Number(event.target.value) })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                          <label className="block text-xs font-medium text-gray-700">Y %<input type="number" value={layer.y} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { y: Number(event.target.value) })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                          <label className="block text-xs font-medium text-gray-700">Width %<input type="number" value={layer.width} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { width: Number(event.target.value) })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                          <label className="block text-xs font-medium text-gray-700">Font<input type="number" value={layer.fontSize} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { fontSize: Number(event.target.value) })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                          <label className="block text-xs font-medium text-gray-700">Color<input type="color" value={layer.color} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { color: event.target.value })} className="mt-1 h-9 w-full rounded border" /></label>
                          <label className="block text-xs font-medium text-gray-700">Background<input type="color" value={layer.background === 'transparent' ? '#4f46e5' : layer.background} onChange={(event) => updateLayer(activeSlideIndex, layerIndex, { background: event.target.value })} className="mt-1 h-9 w-full rounded border" /></label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </section>
        </form>
      </div>
    </div>
  );
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
