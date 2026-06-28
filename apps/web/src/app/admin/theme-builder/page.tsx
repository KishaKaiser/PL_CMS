'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { MediaAsset } from '../../../components/admin/media-library';

type BuilderBlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'columns'
  | 'grid'
  | 'icon'
  | 'menu'
  | 'social-icons'
  | 'announcement-bar'
  | 'store-header'
  | 'hero-slider'
  | 'image-slider'
  | 'video'
  | 'sidebar-widgets'
  | 'global'
  | 'product-grid'
  | 'product-categories'
  | 'product-tags';
type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';
type EditorTarget = 'theme-header' | 'theme-footer';

interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  props: Record<string, unknown>;
  children?: BuilderBlock[];
}

interface BuilderSection {
  id: string;
  type: 'section';
  settings: {
    layout?: string;
    background?: string;
    padding?: string;
  };
  blocks: BuilderBlock[];
}

interface BuilderLayout {
  version: number;
  type: string;
  settings?: {
    layout?: string;
    breadcrumbs?: boolean;
    showTitle?: boolean;
  };
  sections: BuilderSection[];
}

interface GlobalComponent {
  id: string;
  name: string;
  componentType: string;
  schemaJson: BuilderBlock;
}

interface CmsTheme {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string | null;
  isActive: boolean;
  globalStyles: Record<string, unknown>;
  templates: Record<string, unknown>;
  components: Record<string, unknown>;
  widgetRegistry: string[];
  schemaJson: Record<string, unknown>;
  assets: Array<{ id: string; assetType: string; path: string; content?: string | null }>;
}

interface BuilderWidget {
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
  regularPrice?: string | number | null;
  salePrice?: string | number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  imageUrl?: string | null;
  featuredMedia?: { url: string; altText?: string | null; title?: string | null } | null;
  orderCount?: number;
}

interface TaxonomyPreview {
  id: string;
  slug: string;
  name: string;
  postCount?: number;
}

interface MenuItem {
  label: string;
  href: string;
}

interface SavedMenu {
  id: string;
  name: string;
  location: 'header' | 'footer' | 'sidebar' | 'custom';
  items: MenuItem[];
}

interface MenusForm {
  header: MenuItem[];
  footer: MenuItem[];
  custom: SavedMenu[];
}

type StorePreviewData = {
  products: ProductPreview[];
  categories: TaxonomyPreview[];
  tags: TaxonomyPreview[];
};

type ThemePreviewStyles = {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
};

const emptyLayout: BuilderLayout = {
  version: 1,
  type: 'page',
  settings: { layout: 'full', breadcrumbs: true, showTitle: true },
  sections: [
    {
      id: 'section-hero',
      type: 'section',
      settings: { layout: 'full', background: '#ffffff', padding: '72px 32px' },
      blocks: [
        { id: 'heading-1', type: 'heading', props: { text: 'Design visually', level: 1, align: 'left', fontSize: 48 } },
        {
          id: 'text-1',
          type: 'text',
          props: { text: 'Edit the global header and footer used across the site.', fontSize: 18 },
        },
        { id: 'button-1', type: 'button', props: { label: 'Get Started', href: '#' } },
      ],
    },
  ],
};

const defaultWidgets: BuilderWidget[] = [
  { type: 'heading', label: 'Heading', category: 'content', enabled: true },
  { type: 'text', label: 'Text', category: 'content', enabled: true },
  { type: 'image', label: 'Image', category: 'media', enabled: true },
  { type: 'image-slider', label: 'Image Slider', category: 'media', enabled: true },
  { type: 'video', label: 'Video Embed', category: 'media', enabled: true },
  { type: 'button', label: 'Button', category: 'content', enabled: true },
  { type: 'icon', label: 'Font Awesome Icon', category: 'content', enabled: true },
  { type: 'announcement-bar', label: 'Announcement Bar', category: 'storefront', enabled: true },
  { type: 'store-header', label: 'Store Header', category: 'storefront', enabled: true },
  { type: 'hero-slider', label: 'Hero Slider', category: 'storefront', enabled: true },
  { type: 'columns', label: 'Columns', category: 'layout', enabled: true },
  { type: 'grid', label: 'Grid', category: 'layout', enabled: true },
  { type: 'menu', label: 'Menu', category: 'navigation', enabled: true },
  { type: 'social-icons', label: 'Social Icons', category: 'navigation', enabled: true },
  { type: 'sidebar-widgets', label: 'Sidebar Widgets', category: 'layout', enabled: true },
  { type: 'product-grid', label: 'Products', category: 'store', enabled: true },
  { type: 'product-categories', label: 'Product Categories', category: 'store', enabled: true },
  { type: 'product-tags', label: 'Product Tags', category: 'store', enabled: true },
];

const emptyStorePreview: StorePreviewData = { products: [], categories: [], tags: [] };
const emptyMenusForm: MenusForm = { header: [], footer: [], custom: [] };
const defaultSocialIconLines = [
  'fa-brands fa-instagram|https://instagram.com|Instagram',
  'fa-brands fa-facebook-f|https://facebook.com|Facebook',
  'fa-brands fa-pinterest-p|https://pinterest.com|Pinterest',
];

async function readApiError(res: Response, fallback: string) {
  const payload = (await res.json().catch(() => null)) as { message?: string | string[]; error?: string } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(' ');
  return payload?.message ?? payload?.error ?? fallback;
}

export default function ThemeBuilderPage() {
  const [components, setComponents] = useState<GlobalComponent[]>([]);
  const [themes, setThemes] = useState<CmsTheme[]>([]);
  const [widgets, setWidgets] = useState<BuilderWidget[]>(defaultWidgets);
  const [storePreview, setStorePreview] = useState<StorePreviewData>(emptyStorePreview);
  const [savedMenus, setSavedMenus] = useState<SavedMenu[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [layout, setLayout] = useState<BuilderLayout>(emptyLayout);
  const [editorTarget, setEditorTarget] = useState<EditorTarget>('theme-header');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [dragBlockId, setDragBlockId] = useState('');
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>('desktop');
  const [themeForm, setThemeForm] = useState({
    name: 'Custom Theme',
    slug: 'custom-theme',
    version: '1.0.0',
    primaryColor: '#6f21b6',
    accentColor: '#0f766e',
    fontFamily: 'Inter, Arial, sans-serif',
  });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const activeTheme = useMemo(() => themes.find((theme) => theme.isActive) ?? null, [themes]);
  const selectedBlock = useMemo(
    () => findBlockInLayout(layout, selectedBlockId),
    [layout, selectedBlockId],
  );
  const previewTheme = useMemo(() => getThemePreviewStyles(activeTheme, themeForm), [activeTheme, themeForm]);
  const groupedWidgets = useMemo(() => groupWidgets(mergeWidgets(widgets)), [widgets]);
  const loadTargetLayout = useCallback(
    async (target: EditorTarget, theme = activeTheme) => {
      setSelectedBlockId('');
      if (!theme) {
        setLayout(emptyLayout);
        return;
      }
      setLayout(getThemeLayout(theme, target));
    },
    [activeTheme],
  );

  const fetchResources = useCallback(async () => {
    setError('');
    try {
      await fetch('/api/proxy/admin/builder/defaults/ensure', { method: 'POST' });
      const [componentsRes, themesRes, widgetsRes, mediaRes, menusRes, productsRes, categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/proxy/admin/builder/components'),
        fetch('/api/proxy/admin/builder/themes'),
        fetch('/api/proxy/admin/builder/widgets'),
        fetch('/api/proxy/media'),
        fetch('/api/proxy/settings/site_menus'),
        fetch('/api/proxy/products/all'),
        fetch('/api/proxy/admin/categories'),
        fetch('/api/proxy/admin/tags'),
      ]);
      if (!componentsRes.ok) throw new Error('Unable to load global components');
      if (!themesRes.ok) throw new Error('Unable to load themes');
      if (!widgetsRes.ok) throw new Error('Unable to load widgets');

      const nextThemes = (await themesRes.json()) as CmsTheme[];
      const nextWidgets = (await widgetsRes.json()) as BuilderWidget[];
      const nextActiveTheme = nextThemes.find((theme) => theme.isActive) ?? null;

      setComponents((await componentsRes.json()) as GlobalComponent[]);
      setThemes(nextThemes);
      setWidgets(nextWidgets.length > 0 ? mergeWidgets(nextWidgets) : defaultWidgets);
      setMediaAssets(mediaRes.ok ? ((await mediaRes.json()) as MediaAsset[]).filter((asset) => asset.isImage) : []);
      setSavedMenus(menusRes.ok ? flattenSavedMenus(normalizeMenusSetting(((await menusRes.json()) as { value?: string } | null)?.value)) : []);
      setStorePreview({
        products: productsRes.ok ? ((await productsRes.json()) as ProductPreview[]) : [],
        categories: categoriesRes.ok ? ((await categoriesRes.json()) as TaxonomyPreview[]) : [],
        tags: tagsRes.ok ? ((await tagsRes.json()) as TaxonomyPreview[]) : [],
      });
      if (nextActiveTheme) {
        setThemeForm({
          name: nextActiveTheme.name,
          slug: nextActiveTheme.slug,
          version: nextActiveTheme.version,
          primaryColor: getStringStyle(nextActiveTheme.globalStyles.primaryColor, '#6f21b6'),
          accentColor: getStringStyle(nextActiveTheme.globalStyles.accentColor, '#0f766e'),
          fontFamily: getStringStyle(nextActiveTheme.globalStyles.fontFamily, 'Inter, Arial, sans-serif'),
        });
      }
      await loadTargetLayout(editorTarget, nextActiveTheme);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading builder');
    }
  }, [editorTarget, loadTargetLayout]);

  useEffect(() => {
    void fetchResources();
  }, []);

  async function changeTarget(target: EditorTarget) {
    setEditorTarget(target);
    try {
      await loadTargetLayout(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load editor target');
    }
  }

  async function saveCurrentTarget() {
    setError('');
    setStatus('');
    try {
      if (!activeTheme) {
        await createThemeFromCurrentLayout();
        return;
      }

      const res = await fetch(`/api/proxy/admin/builder/themes/${activeTheme.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildThemePayload(themeForm, layout, widgets, activeTheme, editorTarget)),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Theme could not be saved.'));
      setStatus(`${editorTargetLabel(editorTarget)} saved.`);
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function createThemeFromCurrentLayout(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError('');
    setStatus('Creating theme...');
    try {
      const requestedSlug = slugify(themeForm.slug || themeForm.name) || 'custom-theme';
      const nextSlug = getUniqueThemeSlug(requestedSlug, themes);
      const nextName = themes.some((theme) => theme.slug === requestedSlug)
        ? `${themeForm.name} Copy`
        : themeForm.name;
      const res = await fetch('/api/proxy/admin/builder/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildThemePayload(
            {
              ...themeForm,
              name: nextName,
              slug: nextSlug,
            },
            layout,
            widgets,
            activeTheme,
            editorTarget,
          ),
        ),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Theme could not be created.'));
      setStatus('Theme created and activated.');
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Theme create failed');
    }
  }

  async function activateTheme(themeId: string) {
    setError('');
    setStatus('');
    try {
      const res = await fetch(`/api/proxy/admin/builder/themes/${themeId}/activate`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiError(res, 'Theme could not be activated.'));
      setStatus('Theme activated for the site.');
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Theme activation failed');
    }
  }

  async function deleteTheme(theme: CmsTheme) {
    if (theme.isActive) {
      setError('Activate another theme before deleting this active theme.');
      return;
    }
    const confirmed = window.confirm(`Delete theme "${theme.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setError('');
    setStatus('');
    try {
      const res = await fetch(`/api/proxy/admin/builder/themes/${theme.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Theme could not be deleted.'));
      setStatus(`Theme "${theme.name}" deleted.`);
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Theme delete failed');
    }
  }

  async function exportTheme(id: string) {
    const res = await fetch(`/api/proxy/admin/builder/themes/${id}/export`);
    const blob = await res.blob();
    downloadBlob('theme.zip', blob);
  }

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    setError('');
    try {
      const res = await fetch('/api/proxy/admin/builder/themes/import', { method: 'POST', body });
      if (!res.ok) throw new Error(await readApiError(res, 'Theme import failed.'));
      setStatus('Theme imported.');
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Theme import failed');
    } finally {
      event.target.value = '';
    }
  }

  function addSection() {
    setLayout((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: createId('section'),
          type: 'section',
          settings: { layout: 'full', background: '#ffffff', padding: '56px 32px' },
          blocks: [],
        },
      ],
    }));
  }

  function loadPsychicLinkPreset() {
    const presetLayout = createPsychicLinkPresetLayout(mediaAssets);
    setLayout(presetLayout);
    setThemeForm((current) => ({
      ...current,
      name: 'Psychic Link Storefront',
      slug: 'psychic-link-storefront',
      primaryColor: '#6f21b6',
      accentColor: '#111111',
      fontFamily: 'Inter, Arial, sans-serif',
    }));
    setSelectedBlockId(presetLayout.sections[0]?.blocks[0]?.id ?? '');
    setStatus('Psychic Link storefront preset loaded. Save current to publish it.');
    setError('');
  }

  function addBlock(type: BuilderBlockType, sectionId?: string) {
    const targetSectionId = sectionId ?? layout.sections[0]?.id;
    if (!targetSectionId) return;
    const block = createBlock(type, widgets.find((widget) => widget.type === type));
    setLayout((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === targetSectionId ? { ...section, blocks: [...section.blocks, block] } : section,
      ),
    }));
    setSelectedBlockId(block.id);
  }

  function updateBlock(blockId: string, props: Record<string, unknown>) {
    setLayout((current) => ({
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
    setLayout((current) => ({
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

  function updateLayoutSettings(settings: NonNullable<BuilderLayout['settings']>) {
    setLayout((current) => ({
      ...current,
      settings: { ...current.settings, ...settings },
    }));
  }

  function removeBlock(blockId: string) {
    setLayout((current) => ({
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
    setLayout((current) => ({
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

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-gray-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Admin</Link>
          <div>
            <h1 className="text-lg font-semibold">Theme Builder</h1>
            <p className="text-xs text-gray-500">{editorTargetLabel(editorTarget)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['desktop', 'tablet', 'mobile'] as ResponsiveMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setResponsiveMode(mode)}
              className={`rounded border px-3 py-2 text-sm capitalize hover:bg-gray-50 ${
                responsiveMode === mode ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''
              }`}
            >
              {mode}
            </button>
          ))}
          <button onClick={() => void saveCurrentTarget()} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
            Save Current
          </button>
          {activeTheme && (
            <button onClick={() => void exportTheme(activeTheme.id)} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Export ZIP</button>
          )}
          <label className="cursor-pointer rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Import ZIP
            <input type="file" accept=".zip,application/zip" onChange={importTheme} className="hidden" />
          </label>
        </div>
      </header>

      {(error || status) && (
        <div className="shrink-0 border-b bg-white px-4 py-2">
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {status && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="min-h-0 overflow-y-auto border-r bg-white p-3">
          <Panel title="Edit">
            <div className="grid gap-2">
              {(['theme-header', 'theme-footer'] as EditorTarget[]).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => void changeTarget(target)}
                  className={`rounded border px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    editorTarget === target ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''
                  }`}
                >
                  {editorTargetLabel(target)}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Widgets">
            <button
              type="button"
              onClick={loadPsychicLinkPreset}
              className="mb-4 w-full rounded bg-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              Load Psychic Link Preset
            </button>
            {Object.entries(groupedWidgets).map(([category, categoryWidgets]) => (
              <div key={category} className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-400">{category}</h3>
                <div className="grid gap-2">
                  {categoryWidgets.map((widget) => (
                    <button
                      key={widget.type}
                      type="button"
                      onClick={() => addBlock(widget.type)}
                      className="rounded border px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      {widget.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={addSection} className="w-full rounded bg-gray-900 px-3 py-2 text-sm text-white">Add Section</button>
          </Panel>
        </aside>

        <section className="min-h-0 overflow-auto bg-gray-200 p-4">
          <div className="mx-auto transition-all" style={{ maxWidth: responsiveWidth(responsiveMode) }}>
            <BuilderPreview
              layout={layout}
              activeTheme={activeTheme}
              editorTarget={editorTarget}
              components={components}
              theme={previewTheme}
              storePreview={storePreview}
              savedMenus={savedMenus}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onRemoveBlock={removeBlock}
              onDragStart={setDragBlockId}
              onMoveBlock={moveBlock}
              onAddBlock={addBlock}
            />
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l bg-white p-3">
          <Panel title="Theme">
            <form onSubmit={createThemeFromCurrentLayout} className="space-y-3">
              {activeTheme && (
                <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Editing active theme: {activeTheme.name}
                </p>
              )}
              <input value={themeForm.name} onChange={(event) => setThemeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Theme name" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={themeForm.slug} onChange={(event) => setThemeForm((current) => ({ ...current, slug: event.target.value }))} placeholder="theme-slug" className="w-full rounded border px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-gray-600">Primary<input type="color" value={themeForm.primaryColor} onChange={(event) => setThemeForm((current) => ({ ...current, primaryColor: event.target.value }))} className="mt-1 h-10 w-full rounded border" /></label>
                <label className="text-xs font-medium text-gray-600">Accent<input type="color" value={themeForm.accentColor} onChange={(event) => setThemeForm((current) => ({ ...current, accentColor: event.target.value }))} className="mt-1 h-10 w-full rounded border" /></label>
              </div>
              <input value={themeForm.fontFamily} onChange={(event) => setThemeForm((current) => ({ ...current, fontFamily: event.target.value }))} placeholder="Font family" className="w-full rounded border px-3 py-2 text-sm" />
              {activeTheme && (
                <button type="button" onClick={() => void saveCurrentTarget()} className="w-full rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700">
                  Save Active Theme
                </button>
              )}
              <button type="submit" className="w-full rounded bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800">
                Duplicate as New Theme
              </button>
            </form>
          </Panel>

          <Panel title="Themes">
            <div className="space-y-2">
              {themes.map((theme) => (
                <div key={theme.id} className="rounded border p-2 text-sm">
                  <div className="font-medium">{theme.name}</div>
                  <div className="text-xs text-gray-500">{theme.version}</div>
                  {theme.isActive ? (
                    <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Active</span>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <button onClick={() => void activateTheme(theme.id)} className="text-indigo-600 hover:underline">Activate</button>
                      <button onClick={() => void deleteTheme(theme)} className="text-red-600 hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Page Options">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Layout
                <select
                  value={layout.settings?.layout ?? 'default'}
                  onChange={(event) => updateLayoutSettings({ layout: event.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="default">Default Width</option>
                  <option value="full">Full Width</option>
                  <option value="sidebar-left">Sidebar Left</option>
                  <option value="sidebar-right">Sidebar Right</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={layout.settings?.breadcrumbs !== false}
                  onChange={(event) => updateLayoutSettings({ breadcrumbs: event.target.checked })}
                />
                Show breadcrumbs
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={layout.settings?.showTitle !== false}
                  onChange={(event) => updateLayoutSettings({ showTitle: event.target.checked })}
                />
                Show page title
              </label>
            </div>
          </Panel>

          <Panel title="Selected Block">
            {selectedBlock ? (
              <BlockEditor
                block={selectedBlock}
                onChange={(props) => updateBlock(selectedBlock.id, props)}
                onAddChild={(type) => addChildBlock(selectedBlock.id, type)}
                onRemove={() => removeBlock(selectedBlock.id)}
                theme={previewTheme}
                mediaAssets={mediaAssets}
                widgets={mergeWidgets(widgets)}
                savedMenus={savedMenus}
              />
            ) : (
              <p className="text-sm text-gray-500">Select content in the live preview.</p>
            )}
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3 rounded border bg-white p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

function BlockEditor({
  block,
  onChange,
  onAddChild,
  onRemove,
  theme,
  mediaAssets,
  widgets,
  savedMenus,
}: {
  block: BuilderBlock;
  onChange: (props: Record<string, unknown>) => void;
  onAddChild: (type: BuilderBlockType) => void;
  onRemove: () => void;
  theme: ThemePreviewStyles;
  mediaAssets: MediaAsset[];
  widgets: BuilderWidget[];
  savedMenus: SavedMenu[];
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
              Upload images in Media Library, then refresh Theme Builder to select them here.
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
          <label className="block text-sm font-medium text-gray-700">
            Menu Title
            <input value={String(block.props.title ?? '')} onChange={(event) => onChange({ title: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Optional title" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Select Saved Menu
            <select value={String(block.props.menuId ?? 'header')} onChange={(event) => onChange({ menuId: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              {savedMenus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Layout
            <select value={String(block.props.orientation ?? 'horizontal')} onChange={(event) => onChange({ orientation: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
        </>
      )}
      {block.type === 'social-icons' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Title<input value={String(block.props.title ?? '')} onChange={(event) => onChange({ title: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Optional title" /></label>
          <label className="block text-sm font-medium text-gray-700">Icons (icon class|url|label per line)<textarea value={String(block.props.linksText ?? '')} rows={5} onChange={(event) => onChange({ linksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Layout<select value={String(block.props.orientation ?? 'horizontal')} onChange={(event) => onChange({ orientation: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
          <label className="block text-sm font-medium text-gray-700">Icon Size<input type="number" min="12" max="72" value={Number(block.props.size ?? 20)} onChange={(event) => onChange({ size: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Color<input type="color" value={String(block.props.color ?? theme.primaryColor)} onChange={(event) => onChange({ color: event.target.value })} className="mt-1 h-10 w-full rounded border" /></label>
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
          <label className="block text-sm font-medium text-gray-700">
            Logo Type
            <select value={String(block.props.logoMode ?? 'text')} onChange={(event) => onChange({ logoMode: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="text">Text logo</option>
              <option value="image">Image logo</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Logo Text<input value={String(block.props.logoText ?? 'The Psychic Link')} onChange={(event) => onChange({ logoText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          {String(block.props.logoMode ?? 'text') === 'image' && (
            <label className="block text-sm font-medium text-gray-700">
              Logo Image
              <select
                value={String(block.props.logoMediaId ?? '')}
                onChange={(event) => {
                  const asset = mediaAssets.find((item) => item.id === event.target.value);
                  onChange(asset ? { logoMediaId: asset.id, logoSrc: asset.url, logoAlt: asset.altText || asset.title || asset.originalName } : { logoMediaId: '', logoSrc: '', logoAlt: '' });
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
          )}
          <label className="block text-sm font-medium text-gray-700">Social Icons (icon class|url|label per line)<textarea value={String(block.props.socialLinksText ?? '')} rows={4} onChange={(event) => onChange({ socialLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Top Links (label|url per line)<textarea value={String(block.props.topLinksText ?? '')} rows={3} onChange={(event) => onChange({ topLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Main Nav (label|url per line)<textarea value={String(block.props.navLinksText ?? '')} rows={5} onChange={(event) => onChange({ navLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Action Icons (icon class|url|label per line)<textarea value={String(block.props.actionLinksText ?? '')} rows={4} onChange={(event) => onChange({ actionLinksText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={block.props.showActions !== false} onChange={(event) => onChange({ showActions: event.target.checked })} /> Show login/search/wishlist/cart icons</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!(block.props.stickyMain === false && block.props.stickyMainTouched === true)} onChange={(event) => onChange({ stickyMain: event.target.checked, stickyMainTouched: true })} /> Sticky main nav and action icons</label>
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
            Width
            <select value={String(block.props.displayWidth ?? 'content')} onChange={(event) => onChange({ displayWidth: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="content">Content width</option>
              <option value="wide">Wide full browser width</option>
            </select>
          </label>
          <MediaSlidePicker block={block} mediaAssets={mediaAssets} onChange={onChange} />
          <label className="block text-sm font-medium text-gray-700">Height<input type="number" min="120" max="800" value={Number(block.props.height ?? 360)} onChange={(event) => onChange({ height: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
          <label className="block text-sm font-medium text-gray-700">Slide Speed (seconds)<input type="number" min="2" max="20" value={Number(block.props.slideSeconds ?? 5)} onChange={(event) => onChange({ slideSeconds: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
      {block.type === 'video' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Video URL<input value={String(block.props.url ?? '')} onChange={(event) => onChange({ url: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="YouTube, Vimeo, or MP4 URL" /></label>
          <label className="block text-sm font-medium text-gray-700">Aspect Ratio<select value={String(block.props.aspectRatio ?? '16 / 9')} onChange={(event) => onChange({ aspectRatio: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="16 / 9">16:9</option><option value="4 / 3">4:3</option><option value="1 / 1">Square</option></select></label>
        </>
      )}
      {block.type === 'sidebar-widgets' && (
        <label className="block text-sm font-medium text-gray-700">Widgets (one per line)<textarea value={String(block.props.itemsText ?? 'Search\\nCategories\\nRecent posts')} rows={4} onChange={(event) => onChange({ itemsText: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
      {block.type === 'product-grid' && (
        <>
          <label className="block text-sm font-medium text-gray-700">Widget Title<input value={String(block.props.title ?? '')} onChange={(event) => onChange({ title: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Featured Products" /></label>
          <label className="block text-sm font-medium text-gray-700">Product Filter<select value={String(block.props.filter ?? 'latest')} onChange={(event) => onChange({ filter: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="latest">Latest products</option><option value="sale">On sale</option><option value="top-sellers">Top sellers</option></select></label>
          <label className="block text-sm font-medium text-gray-700">Products to Show<input type="number" min="1" max="24" value={Number(block.props.limit ?? 3)} onChange={(event) => onChange({ limit: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
        </>
      )}
    </div>
  );
}

function ContainerChildControls({
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

function MediaSlidePicker({
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
        <p className="text-xs text-gray-500">Upload images in Media Library, then refresh Theme Builder.</p>
      )}
    </div>
  );
}

function BuilderPreview({
  layout,
  activeTheme,
  editorTarget,
  components,
  theme,
  storePreview,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  onDragStart,
  onMoveBlock,
  onAddBlock,
  savedMenus,
}: {
  layout: BuilderLayout;
  activeTheme: CmsTheme | null;
  editorTarget: EditorTarget;
  components: GlobalComponent[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  selectedBlockId: string;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onDragStart: (id: string) => void;
  onMoveBlock: (sectionId: string, index: number) => void;
  onAddBlock: (type: BuilderBlockType, sectionId: string) => void;
  savedMenus: SavedMenu[];
}) {
  const headerLayout = editorTarget === 'theme-header' ? layout : activeTheme ? getThemeLayout(activeTheme, 'theme-header') : null;
  const footerLayout = editorTarget === 'theme-footer' ? layout : activeTheme ? getThemeLayout(activeTheme, 'theme-footer') : null;

  return (
    <div className="min-h-[calc(100vh-112px)] overflow-hidden bg-white shadow-xl" style={{ fontFamily: theme.fontFamily }}>
      {headerLayout && (
        <PreviewLayout
          layout={headerLayout}
          active={editorTarget === 'theme-header'}
          showChrome={false}
          components={components}
          theme={theme}
          storePreview={storePreview}
          savedMenus={savedMenus}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onRemoveBlock={onRemoveBlock}
          onDragStart={onDragStart}
          onMoveBlock={onMoveBlock}
          onAddBlock={onAddBlock}
        />
      )}
      <main className="mx-auto max-w-5xl px-8 py-16">
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          Page content is edited from Pages. The header and footer shown here are the global templates used across the site.
        </div>
      </main>
      {footerLayout && (
        <PreviewLayout
          layout={footerLayout}
          active={editorTarget === 'theme-footer'}
          showChrome={false}
          components={components}
          theme={theme}
          storePreview={storePreview}
          savedMenus={savedMenus}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onRemoveBlock={onRemoveBlock}
          onDragStart={onDragStart}
          onMoveBlock={onMoveBlock}
          onAddBlock={onAddBlock}
        />
      )}
    </div>
  );
}

function PreviewLayout({
  layout,
  active,
  showChrome,
  components,
  theme,
  storePreview,
  savedMenus,
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
  components: GlobalComponent[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  savedMenus: SavedMenu[];
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
                    <EditableBlock key={block.id} block={block} components={components} theme={theme} storePreview={storePreview} savedMenus={savedMenus} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onRemoveBlock={onRemoveBlock} onDragStart={() => active && onDragStart(block.id)} onDrop={() => active && onMoveBlock(section.id, index)} active={active} />
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

function EditableBlock({
  block,
  components,
  theme,
  storePreview,
  savedMenus,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  onDragStart,
  onDrop,
  active,
}: {
  block: BuilderBlock;
  components: GlobalComponent[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  savedMenus: SavedMenu[];
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
      <PreviewBlock block={block} components={components} theme={theme} storePreview={storePreview} savedMenus={savedMenus} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onRemoveBlock={onRemoveBlock} active={active} />
    </div>
  );
}

function PreviewBlock({
  block,
  components,
  theme,
  storePreview,
  savedMenus,
  selectedBlockId,
  onSelectBlock,
  onRemoveBlock,
  active,
}: {
  block: BuilderBlock;
  components: GlobalComponent[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  savedMenus: SavedMenu[];
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
    const links = getMenuLinks(block, savedMenus);
    const vertical = block.props.orientation === 'vertical';
    return (
      <nav className="mb-4">
        {block.props.title ? <h3 className="mb-2 text-sm font-semibold text-gray-900">{String(block.props.title)}</h3> : null}
        <div className={`flex ${vertical ? 'flex-col items-start' : 'flex-wrap items-center'} gap-3`}>
          {links.map((link) => <a key={`${link.label}-${link.href}`} href={link.href} className="text-sm font-medium hover:underline" style={{ color: theme.primaryColor }}>{link.label}</a>)}
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
            <a key={`${link.label}-${link.href}`} href={link.href} className="inline-flex items-center gap-2 text-sm hover:underline" style={{ color: String(block.props.color ?? theme.primaryColor) }}>
              <i className={link.iconClass} style={{ fontSize: `${Number(block.props.size ?? 20)}px` }} />
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </nav>
    );
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
    return <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{children.length > 0 ? children.map((child) => <EditableBlock key={child.id} block={child} components={components} theme={theme} storePreview={storePreview} savedMenus={savedMenus} selectedBlockId={selectedBlockId ?? ''} onSelectBlock={onSelectBlock ?? (() => undefined)} onRemoveBlock={onRemoveBlock ?? (() => undefined)} onDragStart={() => undefined} onDrop={() => undefined} active={Boolean(active)} />) : <div className="rounded border border-dashed p-6 text-sm text-gray-500">Select this grid and add widgets from the right panel.</div>}</div>;
  }
  if (block.type === 'image-slider') {
    const slides = getSlides(block);
    const height = `${Number(block.props.height ?? 360)}px`;
    const content = <AnimatedSlider slides={slides} height={height} seconds={Number(block.props.slideSeconds ?? 5)} fallback="Select images for this slider." />;
    return block.props.displayWidth === 'wide' ? <div className="relative left-1/2 mb-6 w-screen -translate-x-1/2">{content}</div> : content;
  }
  if (block.type === 'video') {
    const url = String(block.props.url ?? '');
    return <div className="mb-6 overflow-hidden rounded border bg-black" style={{ aspectRatio: String(block.props.aspectRatio ?? '16 / 9') }}>{url ? videoEmbed(url) : <div className="flex h-full items-center justify-center text-sm text-white">Video embed</div>}</div>;
  }
  if (block.type === 'sidebar-widgets') {
    return <aside className="mb-6 rounded border bg-gray-50 p-4">{getLines(block.props.itemsText, ['Search', 'Categories', 'Recent posts']).map((item) => <div key={item} className="border-b py-2 text-sm last:border-b-0">{item}</div>)}</aside>;
  }
  if (block.type === 'product-grid') {
    const products = getProductPreviewItems(storePreview.products, block);
    const title = String(block.props.title ?? '').trim();
    return (
      <div className="mb-8">
        {title && <h2 className="mb-5 text-2xl font-semibold text-gray-950">{title}</h2>}
        <div className="grid gap-4 md:grid-cols-3">
          {products.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="aspect-[4/3] bg-gray-100">
                {product.imageSrc ? (
                  <img src={product.imageSrc} alt={product.imageAlt} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">No image</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-950">{product.name}</h3>
                <p className="mt-3 text-xl font-bold" style={{ color: theme.primaryColor }}>${Number(product.price).toFixed(2)}</p>
                <span className="mt-4 inline-block rounded px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: theme.primaryColor }}>
                  Add to Cart
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === 'product-categories') {
    return <div className="mb-6 flex flex-wrap gap-2">{storePreview.categories.map((category) => <span key={category.id} className="rounded-full border px-3 py-1 text-sm">{category.name}</span>)}</div>;
  }
  if (block.type === 'product-tags') {
    return <div className="mb-6 flex flex-wrap gap-2">{storePreview.tags.map((tag) => <span key={tag.id} className="rounded bg-gray-100 px-3 py-1 text-sm">#{tag.name}</span>)}</div>;
  }
  if (block.type === 'global') {
    const component = components.find((item) => item.id === block.props.componentId);
    return component ? <PreviewBlock block={component.schemaJson} components={components} theme={theme} storePreview={storePreview} savedMenus={savedMenus} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} onRemoveBlock={onRemoveBlock} active={active} /> : <div className="rounded border p-3 text-sm text-gray-500">Global component</div>;
  }
  const columns = Math.min(6, Math.max(2, Number(block.props.columns ?? 2)));
  const children = block.children ?? [];
  return <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{children.length > 0 ? children.map((child) => <EditableBlock key={child.id} block={child} components={components} theme={theme} storePreview={storePreview} savedMenus={savedMenus} selectedBlockId={selectedBlockId ?? ''} onSelectBlock={onSelectBlock ?? (() => undefined)} onRemoveBlock={onRemoveBlock ?? (() => undefined)} onDragStart={() => undefined} onDrop={() => undefined} active={Boolean(active)} />) : <div className="rounded border border-dashed p-6 text-sm text-gray-500">Select this container and add widgets from the right panel.</div>}</div>;
}

function buildThemePayload(
  themeForm: { name: string; slug: string; version: string; primaryColor: string; accentColor: string; fontFamily: string },
  layout: BuilderLayout,
  widgets: BuilderWidget[],
  activeTheme: CmsTheme | null,
  editorTarget: EditorTarget,
) {
  const templates = { ...getObject(activeTheme?.templates) };
  if (editorTarget === 'theme-header') templates.header = layout;
  if (editorTarget === 'theme-footer') templates.footer = layout;
  return {
    name: themeForm.name,
    slug: themeForm.slug,
    version: themeForm.version,
    globalStyles: {
      primaryColor: themeForm.primaryColor,
      accentColor: themeForm.accentColor,
      fontFamily: themeForm.fontFamily,
    },
    templates,
    components: { widgets: widgets.map((widget) => widget.type) },
    widgetRegistry: mergeWidgets(widgets).filter((widget) => widget.enabled).map((widget) => widget.type),
    schemaJson: { builderVersion: 1, supports: ['global-theme', 'headers', 'footers', 'store-widgets'] },
  };
}

function StoreHeaderPreview({ block }: { block: BuilderBlock }) {
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
        <div className="justify-self-center">
          {block.props.logoMode === 'image' && block.props.logoSrc ? (
            <img src={String(block.props.logoSrc)} alt={String(block.props.logoAlt ?? block.props.logoText ?? 'The Psychic Link')} className="max-h-16 max-w-[220px] object-contain" />
          ) : (
            <div className="font-serif text-3xl italic text-black">{String(block.props.logoText ?? 'The Psychic Link')}</div>
          )}
        </div>
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

function HeroSliderPreview({ block, theme }: { block: BuilderBlock; theme: ThemePreviewStyles }) {
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

function AnimatedSlider({ slides, height, seconds, fallback }: { slides: Array<{ src: string; alt: string }>; height: string; seconds: number; fallback: string }) {
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

function getUniqueThemeSlug(value: string, themes: CmsTheme[]) {
  const existingSlugs = new Set(themes.map((theme) => theme.slug));
  const baseSlug = slugify(value) || 'custom-theme';
  if (!existingSlugs.has(baseSlug)) return baseSlug;

  let index = 2;
  let nextSlug = `${baseSlug}-${index}`;
  while (existingSlugs.has(nextSlug)) {
    index += 1;
    nextSlug = `${baseSlug}-${index}`;
  }
  return nextSlug;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getThemeLayout(theme: CmsTheme, target: EditorTarget): BuilderLayout {
  const templates = getObject(theme.templates);
  if (target === 'theme-header') return normalizeLayout(templates.header);
  if (target === 'theme-footer') return normalizeLayout(templates.footer);
  return emptyLayout;
}

function createBlock(type: BuilderBlockType, widget?: BuilderWidget): BuilderBlock {
  const id = createId(type);
  if (widget?.defaultJson && Object.keys(widget.defaultJson).length > 0) return { ...JSON.parse(JSON.stringify(widget.defaultJson)), id, type };
  if (type === 'heading') return { id, type, props: { text: 'New Heading', level: 2, fontSize: 36, align: 'left' } };
  if (type === 'text') return { id, type, props: { text: 'New text block.', fontSize: 16, align: 'left' } };
  if (type === 'image') return { id, type, props: { mediaId: '', src: '', alt: '', width: 100, height: 320, objectFit: 'cover', align: 'center', borderRadius: 8 } };
  if (type === 'image-slider') return { id, type, props: { mediaIds: [], slides: [], height: 360, displayWidth: 'content' } };
  if (type === 'video') return { id, type, props: { url: '', aspectRatio: '16 / 9' } };
  if (type === 'button') return { id, type, props: { label: 'Learn More', href: '#' } };
  if (type === 'icon') return { id, type, props: { iconClass: 'fa-solid fa-star', label: 'Icon label', size: 36, color: '#6f21b6' } };
  if (type === 'announcement-bar') return { id, type, props: { text: 'Free shipping on all domestic orders over $35', background: '#6f21b6', color: '#ffffff' } };
  if (type === 'store-header') return { id, type, props: { logoMode: 'text', logoText: 'The Psychic Link', logoMediaId: '', logoSrc: '', logoAlt: 'The Psychic Link', socialLinksText: 'fa-brands fa-instagram|https://instagram.com|Instagram\nfa-brands fa-facebook-f|https://facebook.com|Facebook\nfa-brands fa-pinterest-p|https://pinterest.com|Pinterest', topLinksText: 'About Us|/about-us\nContact|/contact\nWishlist|/wishlist', navLinksText: 'Home|/\nBlog|/blog\nShop|/shop\nHoroscopes|/horoscopes\nPhone Readings|/phone-readings', actionLinksText: 'text|/login|Login\nfa-solid fa-magnifying-glass|/search|Search\nfa-regular fa-heart|/wishlist|Wishlist\nfa-solid fa-bag-shopping|/shop/cart|Cart', showActions: true, stickyMain: true } };
  if (type === 'hero-slider') return { id, type, props: { mediaIds: [], slides: [], mediaId: '', src: '', alt: '', heading: 'Welcome', buttonLabel: 'SHOP NOW', buttonHref: '/shop', height: 610, slideSeconds: 5 } };
  if (type === 'columns') return { id, type, props: { columns: 2 }, children: [] };
  if (type === 'grid') return { id, type, props: { columns: 3, itemsText: 'Grid item\nGrid item\nGrid item' } };
  if (type === 'menu') return { id, type, props: { title: '', menuId: 'header', orientation: 'horizontal', linksText: 'Home|/\nShop|/shop\nBlog|/blog' } };
  if (type === 'social-icons') return { id, type, props: { title: '', orientation: 'horizontal', size: 20, color: '#6f21b6', linksText: defaultSocialIconLines.join('\n') } };
  if (type === 'sidebar-widgets') return { id, type, props: { itemsText: 'Search\nCategories\nRecent posts' } };
  if (type === 'product-grid') return { id, type, props: { title: 'Featured Products', filter: 'latest', limit: 3 } };
  if (type === 'product-categories') return { id, type, props: {} };
  if (type === 'product-tags') return { id, type, props: {} };
  return { id, type: 'global', props: {} };
}

function createPsychicLinkPresetLayout(mediaAssets: MediaAsset[]): BuilderLayout {
  const heroImage = mediaAssets[0] ?? null;
  return {
    version: 1,
    type: 'page',
    settings: { layout: 'full', breadcrumbs: false, showTitle: false },
    sections: [
      {
        id: createId('section'),
        type: 'section',
        settings: { layout: 'full', background: '#ffffff', padding: '0' },
        blocks: [
          createBlock('announcement-bar'),
          createBlock('store-header'),
          {
            id: createId('hero-slider'),
            type: 'hero-slider',
            props: {
              mediaId: heroImage?.id ?? '',
              mediaIds: heroImage ? [heroImage.id] : [],
              slides: heroImage ? [{ id: heroImage.id, src: heroImage.url, alt: heroImage.altText || heroImage.title || heroImage.originalName }] : [],
              src: heroImage?.url ?? '',
              alt: heroImage?.altText || heroImage?.title || heroImage?.originalName || '',
              heading: 'Welcome',
              buttonLabel: 'SHOP NOW',
              buttonHref: '/shop',
              height: 610,
              slideSeconds: 5,
            },
          },
        ],
      },
    ],
  };
}

function normalizeLayout(value: unknown): BuilderLayout {
  if (!value || typeof value !== 'object') return emptyLayout;
  const candidate = value as Partial<BuilderLayout>;
  return {
    version: candidate.version ?? 1,
    type: candidate.type ?? 'page',
    settings: candidate.settings && typeof candidate.settings === 'object' ? candidate.settings : emptyLayout.settings,
    sections: Array.isArray(candidate.sections) ? candidate.sections : emptyLayout.sections,
  };
}

function findBlockInLayout(layout: BuilderLayout, blockId: string) {
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

function mapBlocks(blocks: BuilderBlock[], mapper: (block: BuilderBlock) => BuilderBlock): BuilderBlock[] {
  return blocks.map((block) => {
    const mapped = mapper(block);
    return mapped.children ? { ...mapped, children: mapBlocks(mapped.children, mapper) } : mapped;
  });
}

function removeBlockById(blocks: BuilderBlock[], blockId: string): BuilderBlock[] {
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) => ({
      ...block,
      children: block.children ? removeBlockById(block.children, blockId) : block.children,
    }));
}

function mergeWidgets(widgets: BuilderWidget[]) {
  const map = new Map<BuilderBlockType, BuilderWidget>();
  [...defaultWidgets, ...widgets].forEach((widget) => map.set(widget.type, { ...widget, enabled: widget.enabled !== false }));
  return Array.from(map.values());
}

function groupWidgets(widgets: BuilderWidget[]) {
  return widgets.filter((widget) => widget.enabled).reduce<Record<string, BuilderWidget[]>>((groups, widget) => {
    const category = widget.category ?? 'content';
    groups[category] = [...(groups[category] ?? []), widget];
    return groups;
  }, {});
}

function editorTargetLabel(target: EditorTarget) {
  if (target === 'theme-header') return 'Header';
  if (target === 'theme-footer') return 'Footer';
  return 'Header';
}

function responsiveWidth(mode: ResponsiveMode) {
  if (mode === 'mobile') return '390px';
  if (mode === 'tablet') return '768px';
  return '100%';
}

function textStyle(block: BuilderBlock, theme: ThemePreviewStyles, fallbackSize: number) {
  return {
    color: String(block.props.color ?? (block.type === 'heading' ? theme.primaryColor : '#374151')),
    fontFamily: String(block.props.fontFamily ?? theme.fontFamily),
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

function getMenuLinks(block: BuilderBlock, savedMenus: SavedMenu[]) {
  const menuId = String(block.props.menuId ?? block.props.source ?? '');
  const savedMenu = savedMenus.find((menu) => menu.id === menuId);
  if (savedMenu) return savedMenu.items;
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

function normalizeMenusSetting(value?: string): MenusForm {
  if (!value) return emptyMenusForm;
  try {
    const parsed = JSON.parse(value) as Partial<MenusForm> | null;
    if (!parsed || typeof parsed !== 'object') return emptyMenusForm;
    return {
      header: normalizeMenuItems(parsed.header),
      footer: normalizeMenuItems(parsed.footer),
      custom: Array.isArray(parsed.custom)
        ? parsed.custom.map(normalizeSavedMenu).filter((menu): menu is SavedMenu => menu !== null)
        : [],
    };
  } catch {
    return emptyMenusForm;
  }
}

function flattenSavedMenus(menus: MenusForm): SavedMenu[] {
  const defaultMenus: SavedMenu[] = [
    { id: 'header', name: 'Header Menu', location: 'header', items: menus.header },
    { id: 'footer', name: 'Footer Menu', location: 'footer', items: menus.footer },
  ];
  return [
    ...defaultMenus,
    ...menus.custom,
  ].filter((menu) => menu.items.length > 0);
}

function normalizeSavedMenu(value: unknown): SavedMenu | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<SavedMenu>;
  const id = typeof source.id === 'string' && source.id.trim() ? source.id : '';
  if (!id) return null;
  return {
    id,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Saved Menu',
    location: normalizeMenuLocation(source.location),
    items: normalizeMenuItems(source.items),
  };
}

function normalizeMenuItems(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const source = item as Partial<MenuItem>;
      const label = typeof source.label === 'string' ? source.label.trim() : '';
      const href = typeof source.href === 'string' ? source.href.trim() : '';
      return label && href ? { label, href } : null;
    })
    .filter((item): item is MenuItem => item !== null);
}

function normalizeMenuLocation(value: unknown): SavedMenu['location'] {
  return value === 'header' || value === 'footer' || value === 'sidebar' || value === 'custom'
    ? value
    : 'custom';
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

function pageShellClass(layout?: string) {
  if (layout === 'full') return '';
  if (layout === 'sidebar-left') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]';
  if (layout === 'sidebar-right') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]';
  return 'mx-auto max-w-5xl';
}

function getProductPreviewItems(products: ProductPreview[], block: BuilderBlock) {
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
    imageSrc: product.featuredMedia?.url || product.imageUrl || null,
    imageAlt: product.featuredMedia?.altText || product.featuredMedia?.title || product.name,
  }));
}

function isProductOnSale(product: ProductPreview) {
  if (product.salePrice == null) return false;
  const now = Date.now();
  const startsAt = product.saleStartsAt ? new Date(product.saleStartsAt).getTime() : null;
  const endsAt = product.saleEndsAt ? new Date(product.saleEndsAt).getTime() : null;
  return (startsAt == null || startsAt <= now) && (endsAt == null || endsAt >= now);
}

function PreviewSidebar() {
  return (
    <aside className="rounded border bg-gray-50 p-4 text-sm text-gray-500">
      Sidebar content
    </aside>
  );
}

function getThemePreviewStyles(activeTheme: CmsTheme | null, themeForm: { primaryColor: string; accentColor: string; fontFamily: string }): ThemePreviewStyles {
  const globalStyles = activeTheme?.globalStyles ?? {};
  return {
    primaryColor: getStringStyle(globalStyles.primaryColor, themeForm.primaryColor),
    accentColor: getStringStyle(globalStyles.accentColor, themeForm.accentColor),
    fontFamily: getStringStyle(globalStyles.fontFamily, themeForm.fontFamily),
  };
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringStyle(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
