'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type BuilderBlockType = 'heading' | 'text' | 'image' | 'button' | 'columns' | 'global';
type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';

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

type ThemePreviewStyles = {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
};

const emptyLayout: BuilderLayout = {
  version: 1,
  type: 'page',
  sections: [
    {
      id: 'section-hero',
      type: 'section',
      settings: { layout: 'contained', background: '#ffffff', padding: '72px 32px' },
      blocks: [
        { id: 'heading-1', type: 'heading', props: { text: 'Design visually', level: 1, align: 'left' } },
        { id: 'text-1', type: 'text', props: { text: 'Edit the global page template and publish it as the active theme.' } },
        { id: 'button-1', type: 'button', props: { label: 'Get Started', href: '#' } },
      ],
    },
  ],
};

const fallbackWidgets: BuilderWidget[] = [
  { type: 'heading', label: 'Heading', category: 'content', enabled: true },
  { type: 'text', label: 'Text', category: 'content', enabled: true },
  { type: 'image', label: 'Image', category: 'media', enabled: true },
  { type: 'button', label: 'Button', category: 'content', enabled: true },
  { type: 'columns', label: 'Columns', category: 'layout', enabled: true },
];

export default function ThemeBuilderPage() {
  const [components, setComponents] = useState<GlobalComponent[]>([]);
  const [themes, setThemes] = useState<CmsTheme[]>([]);
  const [widgets, setWidgets] = useState<BuilderWidget[]>(fallbackWidgets);
  const [layout, setLayout] = useState<BuilderLayout>(emptyLayout);
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
  const enabledWidgets = useMemo(() => widgets.filter((widget) => widget.enabled), [widgets]);
  const selectedBlock = useMemo(
    () => layout.sections.flatMap((section) => section.blocks).find((block) => block.id === selectedBlockId),
    [layout, selectedBlockId],
  );
  const previewTheme = useMemo(() => getThemePreviewStyles(activeTheme, themeForm), [activeTheme, themeForm]);

  const fetchResources = useCallback(async () => {
    setError('');
    try {
      const [componentsRes, themesRes, widgetsRes] = await Promise.all([
        fetch('/api/proxy/admin/builder/components'),
        fetch('/api/proxy/admin/builder/themes'),
        fetch('/api/proxy/admin/builder/widgets'),
      ]);
      if (!componentsRes.ok) throw new Error('Unable to load global components');
      if (!themesRes.ok) throw new Error('Unable to load themes');
      if (!widgetsRes.ok) throw new Error('Unable to load widgets');

      const nextThemes = (await themesRes.json()) as CmsTheme[];
      const nextWidgets = (await widgetsRes.json()) as BuilderWidget[];
      setComponents((await componentsRes.json()) as GlobalComponent[]);
      setThemes(nextThemes);
      setWidgets(nextWidgets.length > 0 ? nextWidgets : fallbackWidgets);

      const nextActiveTheme = nextThemes.find((theme) => theme.isActive) ?? null;
      if (nextActiveTheme) {
        setLayout(getThemePageLayout(nextActiveTheme));
        setThemeForm({
          name: nextActiveTheme.name,
          slug: nextActiveTheme.slug,
          version: nextActiveTheme.version,
          primaryColor: getStringStyle(nextActiveTheme.globalStyles.primaryColor, '#4f46e5'),
          accentColor: getStringStyle(nextActiveTheme.globalStyles.accentColor, '#0f766e'),
          fontFamily: getStringStyle(nextActiveTheme.globalStyles.fontFamily, 'Inter, Arial, sans-serif'),
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading builder');
    }
  }, []);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  async function saveActiveTheme() {
    setError('');
    setStatus('');
    const body = buildThemePayload(themeForm, layout, widgets);
    try {
      const path = activeTheme ? `themes/${activeTheme.id}` : 'themes';
      const res = await fetch(`/api/proxy/admin/builder/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTheme ? body : { ...body, name: themeForm.name, slug: themeForm.slug }),
      });
      if (!res.ok) throw new Error('Theme could not be saved.');
      setStatus(activeTheme ? 'Theme saved.' : 'Theme created and activated.');
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Theme save failed');
    }
  }

  async function createTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const res = await fetch('/api/proxy/admin/builder/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildThemePayload(themeForm, layout, widgets)),
      });
      if (!res.ok) throw new Error('Theme could not be created.');
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
      if (!res.ok) throw new Error('Theme could not be activated.');
      setStatus('Theme activated for the site.');
      await fetchResources();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Theme activation failed');
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
      if (!res.ok) throw new Error('Theme import failed.');
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
          <Link href="/admin" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Admin
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Theme Builder</h1>
            <p className="text-xs text-gray-500">
              {activeTheme ? `${activeTheme.name} is active site-wide` : 'Create or import a theme to begin'}
            </p>
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
          <button onClick={() => void saveActiveTheme()} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
            Save Theme
          </button>
          {activeTheme && (
            <button onClick={() => void exportTheme(activeTheme.id)} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Export ZIP
            </button>
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

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 overflow-y-auto border-r bg-white p-3">
          <Panel title="Widgets">
            <div className="grid gap-2">
              {enabledWidgets.map((widget) => (
                <button
                  key={widget.type}
                  type="button"
                  onClick={() => addBlock(widget.type)}
                  className="rounded border px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="block font-medium">{widget.label}</span>
                  <span className="block text-xs text-gray-500">{widget.category ?? 'core'}</span>
                </button>
              ))}
            </div>
            <button onClick={addSection} className="mt-3 w-full rounded bg-gray-900 px-3 py-2 text-sm text-white">
              Add Section
            </button>
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
                    <button onClick={() => void activateTheme(theme.id)} className="mt-2 text-xs text-indigo-600 hover:underline">
                      Activate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="min-h-0 overflow-auto bg-gray-200 p-4">
          <div className="mx-auto transition-all" style={{ maxWidth: responsiveWidth(responsiveMode) }}>
            <BuilderPreview
              layout={layout}
              components={components}
              theme={previewTheme}
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
            <form onSubmit={createTheme} className="space-y-3">
              <input value={themeForm.name} onChange={(event) => setThemeForm((current) => ({ ...current, name: event.target.value }))} placeholder="Theme name" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={themeForm.slug} onChange={(event) => setThemeForm((current) => ({ ...current, slug: event.target.value }))} placeholder="theme-slug" className="w-full rounded border px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-gray-600">
                  Primary
                  <input type="color" value={themeForm.primaryColor} onChange={(event) => setThemeForm((current) => ({ ...current, primaryColor: event.target.value }))} className="mt-1 h-10 w-full rounded border" />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  Accent
                  <input type="color" value={themeForm.accentColor} onChange={(event) => setThemeForm((current) => ({ ...current, accentColor: event.target.value }))} className="mt-1 h-10 w-full rounded border" />
                </label>
              </div>
              <input value={themeForm.fontFamily} onChange={(event) => setThemeForm((current) => ({ ...current, fontFamily: event.target.value }))} placeholder="Font family" className="w-full rounded border px-3 py-2 text-sm" />
              <button className="w-full rounded bg-gray-900 px-3 py-2 text-sm text-white">
                Create New Theme
              </button>
            </form>
          </Panel>

          <Panel title="Selected Block">
            {selectedBlock ? (
              <BlockEditor block={selectedBlock} onChange={(props) => updateBlock(selectedBlock.id, props)} />
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

function BlockEditor({ block, onChange }: { block: BuilderBlock; onChange: (props: Record<string, unknown>) => void }) {
  const text = String(block.props.text ?? block.props.label ?? '');
  const href = String(block.props.href ?? '');
  const imageUrl = String(block.props.src ?? '');
  return (
    <div className="space-y-3">
      <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">{block.type}</div>
      {['heading', 'text', 'button'].includes(block.type) && (
        <label className="block text-sm font-medium text-gray-700">
          Text
          <textarea
            value={text}
            rows={4}
            onChange={(event) => onChange(block.type === 'button' ? { label: event.target.value } : { text: event.target.value })}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
      )}
      {block.type === 'image' && (
        <label className="block text-sm font-medium text-gray-700">
          Image URL
          <input value={imageUrl} onChange={(event) => onChange({ src: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </label>
      )}
      {block.type === 'button' && (
        <label className="block text-sm font-medium text-gray-700">
          Link
          <input value={href} onChange={(event) => onChange({ href: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </label>
      )}
    </div>
  );
}

function BuilderPreview({
  layout,
  components,
  theme,
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
  selectedBlockId: string;
  onSelectBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onDragStart: (id: string) => void;
  onMoveBlock: (sectionId: string, index: number) => void;
  onAddBlock: (type: BuilderBlockType, sectionId: string) => void;
}) {
  return (
    <div className="min-h-[calc(100vh-112px)] overflow-hidden bg-white shadow-xl" style={{ fontFamily: theme.fontFamily }}>
      {layout.sections.map((section) => (
        <section
          key={section.id}
          style={{ background: section.settings.background, padding: section.settings.padding }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => onMoveBlock(section.id, section.blocks.length)}
          className="group/section relative"
        >
          <div className="absolute right-3 top-3 z-10 hidden gap-2 rounded bg-white/90 p-2 shadow group-hover/section:flex">
            <button onClick={() => onAddBlock('heading', section.id)} className="rounded border px-2 py-1 text-xs">Heading</button>
            <button onClick={() => onAddBlock('text', section.id)} className="rounded border px-2 py-1 text-xs">Text</button>
            <button onClick={() => onAddBlock('button', section.id)} className="rounded border px-2 py-1 text-xs">Button</button>
          </div>
          <div className={section.settings.layout === 'full' ? '' : 'mx-auto max-w-5xl'}>
            {section.blocks.length === 0 ? (
              <button onClick={() => onAddBlock('heading', section.id)} className="w-full rounded border border-dashed p-10 text-sm text-gray-500">
                Add content
              </button>
            ) : (
              section.blocks.map((block, index) => (
                <EditableBlock
                  key={block.id}
                  block={block}
                  components={components}
                  theme={theme}
                  selected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onRemove={() => onRemoveBlock(block.id)}
                  onDragStart={() => onDragStart(block.id)}
                  onDrop={() => onMoveBlock(section.id, index)}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function EditableBlock({
  block,
  components,
  theme,
  selected,
  onSelect,
  onRemove,
  onDragStart,
  onDrop,
}: {
  block: BuilderBlock;
  components: GlobalComponent[];
  theme: ThemePreviewStyles;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      draggable
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={`group/block relative cursor-move rounded px-2 py-1 ${selected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-indigo-300'}`}
    >
      <div className="absolute right-2 top-2 z-20 hidden rounded bg-white shadow group-hover/block:block">
        <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="px-2 py-1 text-xs text-red-600">
          Remove
        </button>
      </div>
      <PreviewBlock block={block} components={components} theme={theme} />
    </div>
  );
}

function PreviewBlock({ block, components, theme }: { block: BuilderBlock; components: GlobalComponent[]; theme: ThemePreviewStyles }) {
  if (block.type === 'heading') {
    return <h1 className="mb-3 text-4xl font-bold" style={{ color: theme.primaryColor }}>{String(block.props.text ?? 'Heading')}</h1>;
  }
  if (block.type === 'text') {
    return <p className="mb-4 text-gray-700">{String(block.props.text ?? 'Text block')}</p>;
  }
  if (block.type === 'image') {
    const src = String(block.props.src ?? '');
    return src ? <img src={src} alt="" className="mb-4 max-h-96 w-full rounded object-cover" /> : <div className="mb-4 rounded bg-gray-100 p-12 text-center text-sm text-gray-500">Image</div>;
  }
  if (block.type === 'button') {
    return <a href={String(block.props.href ?? '#')} className="mb-4 inline-block rounded px-4 py-2 text-white" style={{ backgroundColor: theme.primaryColor }}>{String(block.props.label ?? 'Button')}</a>;
  }
  if (block.type === 'global') {
    const component = components.find((item) => item.id === block.props.componentId);
    return component ? <PreviewBlock block={component.schemaJson} components={components} theme={theme} /> : <div className="rounded border p-3 text-sm text-gray-500">Global component</div>;
  }
  return <div className="mb-4 grid gap-3 md:grid-cols-2"><div className="rounded bg-gray-100 p-4">Column</div><div className="rounded bg-gray-100 p-4">Column</div></div>;
}

function buildThemePayload(
  themeForm: { name: string; slug: string; version: string; primaryColor: string; accentColor: string; fontFamily: string },
  layout: BuilderLayout,
  widgets: BuilderWidget[],
) {
  return {
    name: themeForm.name,
    slug: themeForm.slug,
    version: themeForm.version,
    globalStyles: {
      primaryColor: themeForm.primaryColor,
      accentColor: themeForm.accentColor,
      fontFamily: themeForm.fontFamily,
    },
    templates: {
      header: layout.sections[0] ?? null,
      footer: null,
      pageTypes: { page: layout },
    },
    components: { widgets: widgets.map((widget) => widget.type) },
    widgetRegistry: widgets.filter((widget) => widget.enabled).map((widget) => widget.type),
    schemaJson: { builderVersion: 1, supports: ['global-theme', 'sections', 'blocks', 'responsive-preview'] },
  };
}

function getThemePageLayout(theme: CmsTheme): BuilderLayout {
  const pageType = getObject(theme.templates).pageTypes;
  const pageLayout = getObject(pageType).page;
  return normalizeLayout(pageLayout);
}

function createBlock(type: BuilderBlockType, widget?: BuilderWidget): BuilderBlock {
  const id = createId(type);
  if (widget?.defaultJson) {
    return { ...JSON.parse(JSON.stringify(widget.defaultJson)), id, type };
  }
  if (type === 'heading') return { id, type, props: { text: 'New Heading', level: 2 } };
  if (type === 'text') return { id, type, props: { text: 'New text block.' } };
  if (type === 'image') return { id, type, props: { src: '', alt: '' } };
  if (type === 'button') return { id, type, props: { label: 'Learn More', href: '#' } };
  if (type === 'columns') return { id, type, props: { columns: 2 }, children: [] };
  return { id, type: 'global', props: {} };
}

function normalizeLayout(value: unknown): BuilderLayout {
  if (!value || typeof value !== 'object') return emptyLayout;
  const candidate = value as Partial<BuilderLayout>;
  return {
    version: candidate.version ?? 1,
    type: candidate.type ?? 'page',
    sections: Array.isArray(candidate.sections) ? candidate.sections : emptyLayout.sections,
  };
}

function responsiveWidth(mode: ResponsiveMode) {
  if (mode === 'mobile') return '390px';
  if (mode === 'tablet') return '768px';
  return '100%';
}

function getThemePreviewStyles(
  activeTheme: CmsTheme | null,
  themeForm: { primaryColor: string; accentColor: string; fontFamily: string },
): ThemePreviewStyles {
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
