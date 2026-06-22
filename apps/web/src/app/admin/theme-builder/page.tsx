'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type BuilderBlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'columns'
  | 'global'
  | 'product-grid'
  | 'product-categories'
  | 'product-tags';
type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';
type EditorTarget = 'theme-page' | 'theme-header' | 'theme-footer' | 'page';

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

interface PageOption {
  id: string;
  title: string;
  slug: string;
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
  currency?: string;
}

interface TaxonomyPreview {
  id: string;
  slug: string;
  name: string;
  postCount?: number;
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
  settings: { layout: 'default', breadcrumbs: true, showTitle: true },
  sections: [
    {
      id: 'section-hero',
      type: 'section',
      settings: { layout: 'contained', background: '#ffffff', padding: '72px 32px' },
      blocks: [
        { id: 'heading-1', type: 'heading', props: { text: 'Design visually', level: 1, align: 'left', fontSize: 48 } },
        {
          id: 'text-1',
          type: 'text',
          props: { text: 'Edit global templates or individual pages with live preview controls.', fontSize: 18 },
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
  { type: 'button', label: 'Button', category: 'content', enabled: true },
  { type: 'columns', label: 'Columns', category: 'layout', enabled: true },
  { type: 'product-grid', label: 'Products', category: 'store', enabled: true },
  { type: 'product-categories', label: 'Product Categories', category: 'store', enabled: true },
  { type: 'product-tags', label: 'Product Tags', category: 'store', enabled: true },
];

const emptyStorePreview: StorePreviewData = { products: [], categories: [], tags: [] };

async function readApiError(res: Response, fallback: string) {
  const payload = (await res.json().catch(() => null)) as { message?: string | string[]; error?: string } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(' ');
  return payload?.message ?? payload?.error ?? fallback;
}

export default function ThemeBuilderPage() {
  const [pages, setPages] = useState<PageOption[]>([]);
  const [components, setComponents] = useState<GlobalComponent[]>([]);
  const [themes, setThemes] = useState<CmsTheme[]>([]);
  const [widgets, setWidgets] = useState<BuilderWidget[]>(defaultWidgets);
  const [storePreview, setStorePreview] = useState<StorePreviewData>(emptyStorePreview);
  const [layout, setLayout] = useState<BuilderLayout>(emptyLayout);
  const [editorTarget, setEditorTarget] = useState<EditorTarget>('theme-page');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [dragBlockId, setDragBlockId] = useState('');
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>('desktop');
  const [themeForm, setThemeForm] = useState({
    name: 'Custom Theme',
    slug: 'custom-theme',
    version: '1.0.0',
    primaryColor: '#4f46e5',
    accentColor: '#0f766e',
    fontFamily: 'Inter, Arial, sans-serif',
  });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const activeTheme = useMemo(() => themes.find((theme) => theme.isActive) ?? null, [themes]);
  const selectedBlock = useMemo(
    () => layout.sections.flatMap((section) => section.blocks).find((block) => block.id === selectedBlockId),
    [layout, selectedBlockId],
  );
  const previewTheme = useMemo(() => getThemePreviewStyles(activeTheme, themeForm), [activeTheme, themeForm]);
  const groupedWidgets = useMemo(() => groupWidgets(mergeWidgets(widgets)), [widgets]);
  const selectedPage = useMemo(() => pages.find((page) => page.id === selectedPageId) ?? null, [pages, selectedPageId]);

  const loadTargetLayout = useCallback(
    async (target: EditorTarget, pageId = selectedPageId, theme = activeTheme) => {
      setSelectedBlockId('');
      if (target === 'page') {
        if (!pageId) {
          setLayout(emptyLayout);
          return;
        }
        const res = await fetch(`/api/proxy/admin/builder/layouts/page/${pageId}`);
        if (!res.ok) throw new Error('Unable to load page layout');
        const data = (await res.json()) as { draftJson?: BuilderLayout };
        setLayout(normalizeLayout(data.draftJson));
        return;
      }
      if (!theme) {
        setLayout(emptyLayout);
        return;
      }
      setLayout(getThemeLayout(theme, target));
    },
    [activeTheme, selectedPageId],
  );

  const fetchResources = useCallback(async () => {
    setError('');
    try {
      await fetch('/api/proxy/admin/builder/defaults/ensure', { method: 'POST' });
      const [pagesRes, componentsRes, themesRes, widgetsRes, productsRes, categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/proxy/pages'),
        fetch('/api/proxy/admin/builder/components'),
        fetch('/api/proxy/admin/builder/themes'),
        fetch('/api/proxy/admin/builder/widgets'),
        fetch('/api/proxy/products/all'),
        fetch('/api/proxy/admin/categories'),
        fetch('/api/proxy/admin/tags'),
      ]);
      if (!pagesRes.ok) throw new Error('Unable to load pages');
      if (!componentsRes.ok) throw new Error('Unable to load global components');
      if (!themesRes.ok) throw new Error('Unable to load themes');
      if (!widgetsRes.ok) throw new Error('Unable to load widgets');

      const nextPages = (await pagesRes.json()) as PageOption[];
      const nextThemes = (await themesRes.json()) as CmsTheme[];
      const nextWidgets = (await widgetsRes.json()) as BuilderWidget[];
      const nextActiveTheme = nextThemes.find((theme) => theme.isActive) ?? null;

      setPages(nextPages);
      setComponents((await componentsRes.json()) as GlobalComponent[]);
      setThemes(nextThemes);
      setWidgets(nextWidgets.length > 0 ? mergeWidgets(nextWidgets) : defaultWidgets);
      setStorePreview({
        products: productsRes.ok ? ((await productsRes.json()) as ProductPreview[]) : [],
        categories: categoriesRes.ok ? ((await categoriesRes.json()) as TaxonomyPreview[]) : [],
        tags: tagsRes.ok ? ((await tagsRes.json()) as TaxonomyPreview[]) : [],
      });
      if (!selectedPageId && nextPages[0]) setSelectedPageId(nextPages[0].id);
      if (nextActiveTheme) {
        setThemeForm({
          name: nextActiveTheme.name,
          slug: nextActiveTheme.slug,
          version: nextActiveTheme.version,
          primaryColor: getStringStyle(nextActiveTheme.globalStyles.primaryColor, '#4f46e5'),
          accentColor: getStringStyle(nextActiveTheme.globalStyles.accentColor, '#0f766e'),
          fontFamily: getStringStyle(nextActiveTheme.globalStyles.fontFamily, 'Inter, Arial, sans-serif'),
        });
      }
      await loadTargetLayout(editorTarget, selectedPageId || nextPages[0]?.id || '', nextActiveTheme);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading builder');
    }
  }, [editorTarget, loadTargetLayout, selectedPageId]);

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

  async function changePage(pageId: string) {
    setSelectedPageId(pageId);
    if (editorTarget !== 'page') return;
    try {
      await loadTargetLayout('page', pageId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load page');
    }
  }

  async function saveCurrentTarget() {
    setError('');
    setStatus('');
    try {
      if (editorTarget === 'page') {
        if (!selectedPageId) throw new Error('Choose a page first.');
        const saveRes = await fetch('/api/proxy/admin/builder/layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityType: 'page', entityId: selectedPageId, layout }),
        });
        if (!saveRes.ok) throw new Error(await readApiError(saveRes, 'Page layout could not be saved.'));
        const publishRes = await fetch(`/api/proxy/admin/builder/layouts/page/${selectedPageId}/publish`, { method: 'POST' });
        if (!publishRes.ok) throw new Error(await readApiError(publishRes, 'Page layout could not be published.'));
        setStatus(`${selectedPage?.title ?? 'Page'} layout saved.`);
        return;
      }

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
          settings: { layout: 'contained', background: '#ffffff', padding: '56px 32px' },
          blocks: [],
        },
      ],
    }));
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
        blocks: section.blocks.map((block) =>
          block.id === blockId ? { ...block, props: { ...block.props, ...props } } : block,
        ),
      })),
    }));
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
        blocks: section.blocks.filter((block) => block.id !== blockId),
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
              {(['theme-page', 'theme-header', 'theme-footer', 'page'] as EditorTarget[]).map((target) => (
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
            {editorTarget === 'page' && (
              <select value={selectedPageId} onChange={(event) => void changePage(event.target.value)} className="mt-3 w-full rounded border px-3 py-2 text-sm">
                {pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
              </select>
            )}
          </Panel>

          <Panel title="Widgets">
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
              components={components}
              theme={previewTheme}
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
              <BlockEditor block={selectedBlock} onChange={(props) => updateBlock(selectedBlock.id, props)} theme={previewTheme} />
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

function BlockEditor({ block, onChange, theme }: { block: BuilderBlock; onChange: (props: Record<string, unknown>) => void; theme: ThemePreviewStyles }) {
  const text = String(block.props.text ?? block.props.label ?? '');
  const href = String(block.props.href ?? '');
  const imageUrl = String(block.props.src ?? '');
  const fontFamily = String(block.props.fontFamily ?? theme.fontFamily);
  const fontSize = Number(block.props.fontSize ?? (block.type === 'heading' ? 42 : 16));
  const color = String(block.props.color ?? (block.type === 'heading' ? theme.primaryColor : '#374151'));
  return (
    <div className="space-y-3">
      <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">{block.type}</div>
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
          <label className="block text-sm font-medium text-gray-700">Image URL<input value={imageUrl} onChange={(event) => onChange({ src: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
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
      {block.type === 'product-grid' && (
        <label className="block text-sm font-medium text-gray-700">Products to Show<input type="number" min="1" max="12" value={Number(block.props.limit ?? 3)} onChange={(event) => onChange({ limit: Number(event.target.value) })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
      )}
    </div>
  );
}

function BuilderPreview({
  layout,
  components,
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
  components: GlobalComponent[];
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
    <div className="min-h-[calc(100vh-112px)] overflow-hidden bg-white shadow-xl" style={{ fontFamily: theme.fontFamily }}>
      {layout.settings?.breadcrumbs !== false && (
        <div className="border-b bg-gray-50 px-8 py-3 text-sm text-gray-500">Home / Preview</div>
      )}
      <div className={pageShellClass(layout.settings?.layout)}>
        {layout.settings?.layout === 'sidebar-left' && <PreviewSidebar />}
        <div>
          {layout.sections.map((section) => (
            <section key={section.id} style={{ background: section.settings.background, padding: section.settings.padding }} onDragOver={(event) => event.preventDefault()} onDrop={() => onMoveBlock(section.id, section.blocks.length)} className="group/section relative">
              <div className="absolute right-3 top-3 z-10 hidden gap-2 rounded bg-white/90 p-2 shadow group-hover/section:flex">
                <button onClick={() => onAddBlock('heading', section.id)} className="rounded border px-2 py-1 text-xs">Heading</button>
                <button onClick={() => onAddBlock('text', section.id)} className="rounded border px-2 py-1 text-xs">Text</button>
                <button onClick={() => onAddBlock('image', section.id)} className="rounded border px-2 py-1 text-xs">Image</button>
              </div>
              <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-5xl'}>
                {section.blocks.length === 0 ? (
                  <button onClick={() => onAddBlock('heading', section.id)} className="w-full rounded border border-dashed p-10 text-sm text-gray-500">Add content</button>
                ) : (
                  section.blocks.map((block, index) => (
                    <EditableBlock key={block.id} block={block} components={components} theme={theme} storePreview={storePreview} selected={selectedBlockId === block.id} onSelect={() => onSelectBlock(block.id)} onRemove={() => onRemoveBlock(block.id)} onDragStart={() => onDragStart(block.id)} onDrop={() => onMoveBlock(section.id, index)} />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
        {layout.settings?.layout === 'sidebar-right' && <PreviewSidebar />}
      </div>
    </div>
  );
}

function EditableBlock({
  block,
  components,
  theme,
  storePreview,
  selected,
  onSelect,
  onRemove,
  onDragStart,
  onDrop,
}: {
  block: BuilderBlock;
  components: GlobalComponent[];
  theme: ThemePreviewStyles;
  storePreview: StorePreviewData;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  return (
    <div draggable onClick={(event) => { event.stopPropagation(); onSelect(); }} onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(); }} className={`group/block relative cursor-move rounded px-2 py-1 ${selected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-indigo-300'}`}>
      <div className="absolute right-2 top-2 z-20 hidden rounded bg-white shadow group-hover/block:block">
        <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="px-2 py-1 text-xs text-red-600">Remove</button>
      </div>
      <PreviewBlock block={block} components={components} theme={theme} storePreview={storePreview} />
    </div>
  );
}

function PreviewBlock({ block, components, theme, storePreview }: { block: BuilderBlock; components: GlobalComponent[]; theme: ThemePreviewStyles; storePreview: StorePreviewData }) {
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
    return component ? <PreviewBlock block={component.schemaJson} components={components} theme={theme} storePreview={storePreview} /> : <div className="rounded border p-3 text-sm text-gray-500">Global component</div>;
  }
  return <div className="mb-4 grid gap-3 md:grid-cols-2"><div className="rounded bg-gray-100 p-4">Column</div><div className="rounded bg-gray-100 p-4">Column</div></div>;
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
  if (editorTarget === 'theme-page' || editorTarget === 'page') {
    templates.pageTypes = { ...getObject(templates.pageTypes), page: layout };
  }
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
    schemaJson: { builderVersion: 1, supports: ['global-theme', 'pages', 'headers', 'footers', 'store-widgets'] },
  };
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
  const pageLayout = getObject(templates.pageTypes).page;
  return normalizeLayout(pageLayout);
}

function createBlock(type: BuilderBlockType, widget?: BuilderWidget): BuilderBlock {
  const id = createId(type);
  if (widget?.defaultJson && Object.keys(widget.defaultJson).length > 0) return { ...JSON.parse(JSON.stringify(widget.defaultJson)), id, type };
  if (type === 'heading') return { id, type, props: { text: 'New Heading', level: 2, fontSize: 36, align: 'left' } };
  if (type === 'text') return { id, type, props: { text: 'New text block.', fontSize: 16, align: 'left' } };
  if (type === 'image') return { id, type, props: { src: '', alt: '', width: 100, height: 320, objectFit: 'cover', align: 'center', borderRadius: 8 } };
  if (type === 'button') return { id, type, props: { label: 'Learn More', href: '#' } };
  if (type === 'columns') return { id, type, props: { columns: 2 }, children: [] };
  if (type === 'product-grid') return { id, type, props: { limit: 3 } };
  if (type === 'product-categories') return { id, type, props: {} };
  if (type === 'product-tags') return { id, type, props: {} };
  return { id, type: 'global', props: {} };
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
  if (target === 'page') return 'Individual Page';
  return 'Global Page Template';
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

function pageShellClass(layout?: string) {
  if (layout === 'full') return '';
  if (layout === 'sidebar-left') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[260px_minmax(0,1fr)]';
  if (layout === 'sidebar-right') return 'mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]';
  return 'mx-auto max-w-5xl';
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
